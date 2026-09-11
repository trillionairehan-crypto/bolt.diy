/*
 * 생성기 베이크오프 — 같은 브리프를 여러 이미지 모델에 넣고 같은 심사(Fable+Astra)로 채점. AD 루프가 8.0에서 막힌 게
 * 브리프 문제인지 생성기 한계인지 가른다.
 *
 *   node tests/skeleton7-dom/bundleAndRun.cjs tests/media/bakeoff.ts --from tests/media/director-<job>.json --top 2
 *       [--models gemini-3.1-flash-image,gemini-3-pro-image,gpt-image-2.5-sunburst,gpt-image-2.5-flare,gpt-image-2]
 * 출력: tests/media/bakeoff-<ts>.json + 콘솔 표 (모델 × 브리프 점수)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { generateGeminiImage } from '~/lib/.server/media/gemini-image';
import { putR2Object, readR2Config } from '~/lib/.server/media/r2';
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

async function fetchBytes(url: string): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const res = await fetch(url);
  return { bytes: new Uint8Array(await res.arrayBuffer()), mimeType: res.headers.get('content-type') || 'image/jpeg' };
}

async function critiqueClaude(env: Record<string, string>, header: string, urls: string[]): Promise<Critique[]> {
  const images = await Promise.all(urls.map(fetchBytes));
  const content: Array<Record<string, unknown>> = [{ type: 'text', text: header }];
  images.forEach((img, i) => {
    content.push({ type: 'text', text: `image index ${i}` });
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: img.mimeType, data: Buffer.from(img.bytes).toString('base64') },
    });
  });

  const res = await fetch('https://api.anthropic.com/v1/messages', {
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
      messages: [{ role: 'user', content }],
    }),
  });
  const body = (await res.json()) as { content?: Array<{ type: string; text?: string }> };

  if (!res.ok) {
    throw new Error(`claude ${res.status}: ${JSON.stringify(body).slice(0, 200)}`);
  }

  return extractJson<Critique[]>(
    (body.content || [])
      .filter((c) => c.type === 'text')
      .map((c) => c.text || '')
      .join(''),
  );
}

async function critiqueAstra(env: Record<string, string>, header: string, urls: string[]): Promise<Critique[]> {
  const images = await Promise.all(urls.map(fetchBytes));
  const res = await fetch('https://api.openai.com/v1/responses', {
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
  });
  const body = (await res.json()) as {
    output_text?: string;
    output?: Array<{ content?: Array<{ type: string; text?: string }> }>;
  };

  if (!res.ok) {
    throw new Error(`astra ${res.status}: ${JSON.stringify(body).slice(0, 200)}`);
  }

  return extractJson<Critique[]>(
    body.output_text ??
      (body.output ?? [])
        .flatMap((o) => o.content ?? [])
        .filter((c) => c.type === 'output_text')
        .map((c) => c.text || '')
        .join(''),
  );
}

async function openaiImage(
  env: Record<string, string>,
  model: string,
  prompt: string,
): Promise<{ bytes: Uint8Array; mimeType: string; usage?: unknown }> {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model, prompt, n: 1, size: '1536x1024', quality: 'high', output_format: 'jpeg' }),
  });
  const body = (await res.json()) as {
    data?: Array<{ b64_json?: string; url?: string }>;
    usage?: unknown;
    error?: { message?: string };
  };

  if (!res.ok || !body.data?.[0]) {
    throw new Error(`${model}: ${res.status} ${body.error?.message || JSON.stringify(body).slice(0, 200)}`);
  }

  const d = body.data[0];

  if (d.b64_json) {
    return { bytes: new Uint8Array(Buffer.from(d.b64_json, 'base64')), mimeType: 'image/jpeg', usage: body.usage };
  }

  return { ...(await fetchBytes(d.url!)), usage: body.usage };
}

/** ByteDance Seedream (BytePlus ModelArk images API) — ARK_API_KEY. 모델 활성화가 안 돼 있으면 InvalidEndpointOrModel.NotFound */
async function seedreamImage(
  env: Record<string, string>,
  model: string,
  prompt: string,
): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const res = await fetch('https://ark.ap-southeast.bytepluses.com/api/v3/images/generations', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.ARK_API_KEY}` },
    body: JSON.stringify({ model, prompt, size: '2K', response_format: 'url', watermark: false }),
  });
  const body = (await res.json()) as {
    data?: Array<{ url?: string; b64_json?: string }>;
    error?: { message?: string };
  };

  if (!res.ok || !body.data?.[0]) {
    throw new Error(`${model}: ${res.status} ${body.error?.message || JSON.stringify(body).slice(0, 160)}`);
  }

  if (body.data[0].b64_json) {
    return { bytes: new Uint8Array(Buffer.from(body.data[0].b64_json, 'base64')), mimeType: 'image/jpeg' };
  }

  return fetchBytes(body.data[0].url!);
}

/** Black Forest Labs FLUX.2 Pro — BFL_API_KEY. 비동기(polling_url) */
async function fluxImage(
  env: Record<string, string>,
  model: string,
  prompt: string,
): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const create = await fetch(`https://api.bfl.ai/v1/${model}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-key': env.BFL_API_KEY },
    body: JSON.stringify({ prompt, width: 1536, height: 864, output_format: 'jpeg' }),
  });
  const task = (await create.json()) as { id?: string; polling_url?: string; error?: string; detail?: unknown };

  if (!create.ok || !task.polling_url) {
    throw new Error(`${model}: ${create.status} ${task.error || JSON.stringify(task.detail || task).slice(0, 160)}`);
  }

  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2000));

    const poll = await fetch(task.polling_url, { headers: { 'x-key': env.BFL_API_KEY } });
    const state = (await poll.json()) as { status?: string; result?: { sample?: string } };

    if (state.status === 'Ready' && state.result?.sample) {
      return fetchBytes(state.result.sample);
    }

    if (state.status && /fail|error|moderat/i.test(state.status)) {
      throw new Error(`${model}: ${state.status}`);
    }
  }

  throw new Error(`${model}: timeout`);
}

async function main() {
  const env = loadEnv();
  const r2 = readR2Config(env as never);
  const from = argValue('--from');
  const top = Number(argValue('--top') || 2);
  const models = (
    argValue('--models') ||
    'gemini-3.1-flash-image,gemini-3-pro-image,gpt-image-2.5-sunburst,gpt-image-2.5-flare,gpt-image-2'
  ).split(',');

  if (!from || !r2 || !env.GOOGLE_GENERATIVE_AI_API_KEY || !env.OPENAI_API_KEY) {
    throw new Error('--from + GOOGLE/OPENAI/ANTHROPIC/R2 env required');
  }

  const run = JSON.parse(readFileSync(from, 'utf8')) as {
    world: WorldId;
    shots: Array<{ brief: { title: string; prompt: string }; score?: number }>;
  };
  const world = getWorld(run.world);
  const briefs = [...run.shots]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, top)
    .map((s) => s.brief);
  const ts = Date.now().toString(36);
  const results: Array<{
    model: string;
    brief: string;
    url: string;
    ms: number;
    error?: string;
    fable?: number;
    astra?: number;
    score?: number;
    tells?: string[];
  }> = [];

  for (const [bi, brief] of briefs.entries()) {
    const urls: Array<{ model: string; url: string }> = [];

    for (const model of models) {
      const t0 = Date.now();

      try {
        const img = model.startsWith('gemini')
          ? await generateGeminiImage({
              apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY,
              prompt: brief.prompt,
              aspectRatio: '16:9',
              model,
            })
          : model.startsWith('seedream')
            ? await seedreamImage(env, model, brief.prompt)
            : model.startsWith('flux')
              ? await fluxImage(env, model, brief.prompt)
              : await openaiImage(env, model, brief.prompt);
        const url = await putR2Object(r2, `media/bakeoff/${ts}/${bi}-${model}.jpg`, img.bytes, img.mimeType);
        urls.push({ model, url });
        results.push({ model, brief: brief.title, url, ms: Date.now() - t0 });
        console.log(`  [${bi}] ${model} → ${url} (${Date.now() - t0}ms)`);
      } catch (error) {
        results.push({
          model,
          brief: brief.title,
          url: '',
          ms: Date.now() - t0,
          error: String((error as Error).message).slice(0, 160),
        });
        console.log(`  [${bi}] ${model} FAILED ${String((error as Error).message).slice(0, 160)}`);
      }
    }

    if (urls.length === 0) {
      continue;
    }

    const header = `World: ${world.label} (${world.id}). Brief: "${brief.title}". ${urls.length} candidates from different generators, index 0..${urls.length - 1}.`;
    const [c1, c2] = await Promise.all([
      critiqueClaude(
        env,
        header,
        urls.map((u) => u.url),
      ),
      critiqueAstra(
        env,
        header,
        urls.map((u) => u.url),
      ),
    ]);

    urls.forEach((u, i) => {
      const r = results.find((x) => x.url === u.url)!;
      r.fable = c1.find((c) => c.index === i)?.score;
      r.astra = c2.find((c) => c.index === i)?.score;
      r.score = Math.min(r.fable ?? 0, r.astra ?? 10);
      r.tells = c1.find((c) => c.index === i)?.tells;
    });
  }

  writeFileSync(
    `tests/media/bakeoff-${ts}.json`,
    JSON.stringify({ world: run.world, briefs, models, results }, null, 2),
  );
  console.log(`\n| 모델 | 브리프 | 점수(min) | Fable | Astra | ms |\n|---|---|---|---|---|---|`);

  for (const r of results) {
    console.log(
      `| ${r.model} | ${r.brief.slice(0, 28)} | ${r.error ? 'FAIL' : r.score} | ${r.fable ?? '-'} | ${r.astra ?? '-'} | ${r.ms} |`,
    );
  }
}

main().catch((error) => {
  console.error('bakeoff failed:', error);
  process.exit(1);
});
