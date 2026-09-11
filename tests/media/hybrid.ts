/*
 * 하이브리드 — 사용자 실사진을 입력으로, 생성기는 "촬영감독처럼 다시 찍기"(조명·배경·정리)만 한다. 질감은 실물에서 온다.
 * 심사가 잡는 결함(단면·알갱이·리넨 질감)이 전부 '생성된 질감'에서 나오므로, 실사 기반이면 8.5+ 가능성이 가장 높은 경로.
 *
 *   node tests/skeleton7-dom/bundleAndRun.cjs tests/media/hybrid.ts --photo <file|url> --world photo-editorial [--look editorial-food]
 *       [--n 3] [--gens dola-seedream-5-0-pro-260628,gpt-image-2.5-flare] [--brand "..."]
 * 출력: R2 media/hybrid/<job>/, 콘솔에 심사표. 편집 지시는 룩 바이블(카메라·조명·구도)에서 만든다 — 피사체는 절대 바꾸지 않는다.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { putR2Object, readR2Config } from '~/lib/.server/media/r2';
import { getWorld, type WorldId } from '~/lib/media/style-locks';
import { getLook, pickLook, type LookId } from '~/lib/media/look-bibles';

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

type Img = { bytes: Uint8Array; mimeType: string };

async function load(src: string): Promise<Img> {
  if (/^https?:/.test(src)) {
    const res = await fetch(src);
    return {
      bytes: new Uint8Array(await res.arrayBuffer()),
      mimeType: res.headers.get('content-type') || 'image/jpeg',
    };
  }

  return { bytes: new Uint8Array(readFileSync(src)), mimeType: src.endsWith('.png') ? 'image/png' : 'image/jpeg' };
}

const b64 = (img: Img) => `data:${img.mimeType};base64,${Buffer.from(img.bytes).toString('base64')}`;

async function seedreamEdit(env: Record<string, string>, model: string, prompt: string, photo: Img): Promise<Img> {
  const res = await fetch('https://ark.ap-southeast.bytepluses.com/api/v3/images/generations', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.ARK_API_KEY}` },
    body: JSON.stringify({
      model,
      prompt,
      image: [b64(photo)],
      size: '2048x1152',
      response_format: 'url',
      watermark: false,
    }),
  });
  const data = (await res.json()) as { data?: Array<{ url?: string }>; error?: { message?: string } };

  if (!res.ok || !data.data?.[0]?.url) {
    throw new Error(`${model}: ${res.status} ${data.error?.message || JSON.stringify(data).slice(0, 160)}`);
  }

  return load(data.data[0].url);
}

async function openaiEdit(env: Record<string, string>, model: string, prompt: string, photo: Img): Promise<Img> {
  const form = new FormData();
  form.append('model', model);
  form.append('prompt', prompt);
  form.append('size', '1536x1024');
  form.append('quality', 'high');
  form.append('output_format', 'jpeg');
  form.append('image[]', new Blob([photo.bytes], { type: photo.mimeType }), 'photo.jpg');

  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: form,
  });
  const body = (await res.json()) as { data?: Array<{ b64_json?: string }>; error?: { message?: string } };

  if (!res.ok || !body.data?.[0]?.b64_json) {
    throw new Error(`${model} edit: ${res.status} ${body.error?.message || ''}`);
  }

  return { bytes: new Uint8Array(Buffer.from(body.data[0].b64_json, 'base64')), mimeType: 'image/jpeg' };
}

const CRITIC_SYSTEM = `You are a jury member for a web design award, judging hero photography. Score each image 0-10 where 9+ means it would pass unnoticed as a commissioned editorial shot on a Site-of-the-Day winner, 8 = good but one visible tell, 7 = competent stock, ≤6 = obvious AI/generic.
Judge cinematography like a DP: one motivated key light with a believable ratio and a real contact shadow; light quality consistent with its source; deliberate camera height and focal length.
List every AI tell that applies (≤4, ≤12 words each): centred-symmetric subject; plastic highlights; flawless surfaces; stock composition; sourceless lighting; melted/duplicated details; text scribbles; oversaturation; render-look; no headline room; wrong scale; style drift.
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

async function juryClaude(env: Record<string, string>, header: string, imgs: Img[]): Promise<Critique[]> {
  const content: Array<Record<string, unknown>> = [{ type: 'text', text: header }];
  imgs.forEach((img, i) => {
    content.push({ type: 'text', text: `image index ${i}` });
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: img.mimeType, data: Buffer.from(img.bytes).toString('base64') },
    });
  });

  for (let attempt = 0; ; attempt++) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-fable-5-1',
        max_tokens: 6000,
        system: CRITIC_SYSTEM,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'high' },
        messages: [{ role: 'user', content }],
      }),
    });
    const body = (await res.json()) as { content?: Array<{ type: string; text?: string }> };

    if (res.ok) {
      return extractJson<Critique[]>(
        (body.content || [])
          .filter((c) => c.type === 'text')
          .map((c) => c.text || '')
          .join(''),
      );
    }

    if ((res.status === 529 || res.status >= 500) && attempt < 3) {
      await new Promise((r) => setTimeout(r, [5000, 15000, 40000][attempt]));
      continue;
    }

    throw new Error(`claude ${res.status}`);
  }
}

async function juryAstra(env: Record<string, string>, header: string, imgs: Img[]): Promise<Critique[]> {
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: 'gpt-6-astra',
      store: false,
      max_output_tokens: 6000,
      input: [
        { role: 'system', content: [{ type: 'input_text', text: CRITIC_SYSTEM }] },
        {
          role: 'user',
          content: [
            { type: 'input_text', text: header },
            ...imgs.map((img) => ({ type: 'input_image', image_url: b64(img) })),
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
    throw new Error(`astra ${res.status}`);
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

async function main() {
  const env = loadEnv();
  const r2 = readR2Config(env as never);
  const photoSrc = argValue('--photo');
  const world = getWorld((argValue('--world') || 'photo-editorial') as WorldId);
  const look = getLook((argValue('--look') as LookId) || pickLook(world.id, [], world.theme, true));
  const n = Number(argValue('--n') || 3);
  const gens = (argValue('--gens') || 'dola-seedream-5-0-pro-260628,gpt-image-2.5-flare').split(',');
  const brand = argValue('--brand') || '밀도 — 연남동 소금빵집';

  if (!photoSrc || !r2 || !env.ARK_API_KEY || !env.OPENAI_API_KEY) {
    throw new Error('--photo, ARK_API_KEY, OPENAI_API_KEY, R2 env required');
  }

  const photo = await load(photoSrc);
  const job = `hyb-${Date.now().toString(36)}`;
  const base = `This is a real photograph supplied by the client (${brand}). Re-shoot it as an award-winning editorial hero image WITHOUT changing the subject: keep the exact same objects, their shapes, textures, colours and arrangement — no new objects, no removed objects, no text.`;
  const variants = [
    `${base} Change only the lighting and the background treatment to this cinematography: ${look.light} Camera: ${look.camera} Grade: ${look.grade} Composition: keep the subject where it is but let the background recede into clean negative space in the upper-left third for a headline.`,
    `${base} Relight it: ${look.light} Remove clutter and distracting elements behind the subject, replace with a simple surface and wall consistent with the scene. Grade: ${look.grade}`,
    `${base} Keep everything; only improve the light quality and depth (one motivated key, real contact shadow, gentle falloff) and apply this grade: ${look.grade}. Photographic, film-like, no smoothing of textures.`,
  ].slice(0, n);
  const results: Array<{
    gen: string;
    variant: number;
    url: string;
    img: Img;
    fable?: number;
    astra?: number;
    score?: number;
    tells?: string[];
  }> = [];

  for (const gen of gens) {
    for (const [vi, prompt] of variants.entries()) {
      try {
        const img = /seedream/.test(gen)
          ? await seedreamEdit(env, gen, prompt, photo)
          : await openaiEdit(env, gen, prompt, photo);
        const url = await putR2Object(r2, `media/hybrid/${job}/${gen}-${vi}.jpg`, img.bytes, img.mimeType);
        results.push({ gen, variant: vi, url, img });
        console.log(`  ${gen} v${vi} → ${url}`);
      } catch (error) {
        console.log(`  ${gen} v${vi} failed: ${String((error as Error).message).slice(0, 120)}`);
      }
    }
  }

  const header = `World: ${world.label}. Look: ${look.label}. ${results.length + 1} images: index 0 is the client's ORIGINAL photo (score it too), the rest are re-lit versions of it.`;
  const imgs = [photo, ...results.map((r) => r.img)];
  let c1: Critique[] = [];

  try {
    c1 = await juryClaude(env, header, imgs);
  } catch (error) {
    console.log(`claude jury unavailable: ${String((error as Error).message)}`);
  }

  const c2 = await juryAstra(env, header, imgs);
  const orig = { fable: c1.find((c) => c.index === 0)?.score, astra: c2.find((c) => c.index === 0)?.score };
  console.log(`\n| 소스 | Fable | Astra | min | tells |\n|---|---|---|---|---|`);
  console.log(
    `| 원본 | ${orig.fable ?? '-'} | ${orig.astra ?? '-'} | ${Math.min(orig.fable ?? 10, orig.astra ?? 10)} | ${(c1.find((c) => c.index === 0) ?? c2.find((c) => c.index === 0))?.tells.join('; ')} |`,
  );
  results.forEach((r, i) => {
    r.fable = c1.find((c) => c.index === i + 1)?.score;
    r.astra = c2.find((c) => c.index === i + 1)?.score;
    r.score = Math.min(r.fable ?? 10, r.astra ?? 10);
    r.tells = (c1.find((c) => c.index === i + 1) ?? c2.find((c) => c.index === i + 1))?.tells;
    console.log(
      `| ${r.gen} v${r.variant} | ${r.fable ?? '-'} | ${r.astra ?? '-'} | ${r.score} | ${(r.tells || []).join('; ')} |`,
    );
  });
  writeFileSync(
    `tests/media/hybrid-${job}.json`,
    JSON.stringify(
      { job, photoSrc, world: world.id, look: look.id, results: results.map(({ img, ...r }) => r) },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error('hybrid failed:', error);
  process.exit(1);
});
