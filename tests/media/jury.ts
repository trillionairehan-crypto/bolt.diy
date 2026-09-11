/*
 * 심사 캘리브레이션 — 실제 수상작 프레임(사람이 만든 9점대)을 우리 심사(Fable+Astra)에 넣어 척도를 확인한다.
 * 우리 생성물이 7.5인데 Pear 실제 프레임도 7.5면 심사가 과하게 가혹한 것이고, Pear가 9면 척도가 맞는 것.
 *
 *   node tests/skeleton7-dom/bundleAndRun.cjs tests/media/jury.ts --world neoclassical-painting --urls <u1>,<u2> [--files a.jpg,b.jpg]
 */
import { readFileSync } from 'node:fs';
import { getWorld, type WorldId } from '~/lib/media/style-locks';

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = { ...(process.env as Record<string, string>) };

  for (const file of ['.env.local', '.env']) {
    try {
      for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);

        if (m && !env[m[1]]) {
          env[m[1]] = m[2].replace(/^["']|["']$/g, '');
        }
      }
    } catch {
      /* optional */
    }
  }

  return env;
}

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const CRITIC_SYSTEM = `You are a jury member for a web design award, judging hero photography/illustration. Score each image 0-10 where 9+ means it would pass unnoticed as a commissioned editorial shot on a Site-of-the-Day winner, 8 = good but one visible tell, 7 = competent stock, ≤6 = obvious AI/generic.
Check these AI tells and list every one that applies: centred-symmetric subject; plastic/over-glossy highlights; flawless too-perfect surfaces; generic stock composition; uniform lighting with no shadow anchor; melted/duplicated/impossible details; wrong hands or text-like scribbles; oversaturation; render-look where a photo was intended; no room for a headline; subject too small or too large; style drift from the requested world.
Be harsh. Return JSON only: [{"index":0,"score":7.5,"tells":["..."],"fix":"..."}]`;

interface Critique {
  index: number;
  score: number;
  tells: string[];
  fix: string;
}

function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = Math.min(...['[', '{'].map((c) => (raw.indexOf(c) < 0 ? Infinity : raw.indexOf(c))));

  return JSON.parse(raw.slice(start)) as T;
}

async function load(src: string): Promise<{ bytes: Uint8Array; mimeType: string }> {
  if (/^https?:/.test(src)) {
    const res = await fetch(src);
    return {
      bytes: new Uint8Array(await res.arrayBuffer()),
      mimeType: res.headers.get('content-type') || 'image/jpeg',
    };
  }

  return { bytes: new Uint8Array(readFileSync(src)), mimeType: src.endsWith('.png') ? 'image/png' : 'image/jpeg' };
}

async function main() {
  const env = loadEnv();
  const world = getWorld((argValue('--world') || 'photo-editorial') as WorldId);
  const srcs = [...(argValue('--urls') || '').split(','), ...(argValue('--files') || '').split(',')].filter(Boolean);
  const images = await Promise.all(srcs.map(load));
  const header = `World: ${world.label} (${world.id}). ${images.length} candidate hero images, index 0..${images.length - 1}.`;

  const claudeContent: Array<Record<string, unknown>> = [{ type: 'text', text: header }];
  images.forEach((img, i) => {
    claudeContent.push({ type: 'text', text: `image index ${i}` });
    claudeContent.push({
      type: 'image',
      source: { type: 'base64', media_type: img.mimeType, data: Buffer.from(img.bytes).toString('base64') },
    });
  });

  const c = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-fable-5-1',
      max_tokens: 3000,
      system: CRITIC_SYSTEM,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high' },
      messages: [{ role: 'user', content: claudeContent }],
    }),
  }).then((r) => r.json() as Promise<{ content?: Array<{ type: string; text?: string }> }>);
  const fable = extractJson<Critique[]>(
    (c.content || [])
      .filter((x) => x.type === 'text')
      .map((x) => x.text || '')
      .join(''),
  );

  const a = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: 'gpt-6-astra',
      store: false,
      max_output_tokens: 3000,
      input: [
        { role: 'system', content: [{ type: 'input_text', text: CRITIC_SYSTEM }] },
        {
          role: 'user',
          content: [
            { type: 'input_text', text: header },
            ...images.map((img) => ({
              type: 'input_image',
              image_url: `data:${img.mimeType};base64,${Buffer.from(img.bytes).toString('base64')}`,
            })),
          ],
        },
      ],
    }),
  }).then(
    (r) =>
      r.json() as Promise<{
        output_text?: string;
        output?: Array<{ content?: Array<{ type: string; text?: string }> }>;
      }>,
  );
  const astra = extractJson<Critique[]>(
    a.output_text ??
      (a.output ?? [])
        .flatMap((o) => o.content ?? [])
        .filter((x) => x.type === 'output_text')
        .map((x) => x.text || '')
        .join(''),
  );

  console.log('| # | 소스 | Fable | Astra | Fable tells |\n|---|---|---|---|---|');
  srcs.forEach((s, i) => {
    const f = fable.find((x) => x.index === i);
    const g = astra.find((x) => x.index === i);
    console.log(
      `| ${i} | ${s.slice(-48)} | ${f?.score ?? '-'} | ${g?.score ?? '-'} | ${(f?.tells || []).join('; ').slice(0, 140)} |`,
    );
  });
}

main().catch((error) => {
  console.error('jury failed:', error);
  process.exit(1);
});
