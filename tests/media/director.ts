/*
 * AD 루프 — 아트디렉터(LLM) + 생성기 + 크리틱(LLM vision). "프롬프트 한 줄 → 이미지"가 만드는 '결함 없는 평균'을 깨기 위한 것.
 *
 *   1) Fable 5.1이 브랜드·세계관에서 사진가 급 샷 브리프 N개를 쓴다(렌즈·시간·소품의 마모·비대칭·여백·금지).
 *   2) Nano Banana가 생성(스타일 앵커 레퍼런스 이미지 동봉 가능).
 *   3) Fable 5.1 vision이 각 장을 0~10 채점 + "AI 티" 체크리스트 + 수정 지시. --critic both 면 GPT-6 Astra가 2차 심사(둘의 최소값).
 *   4) 임계값(기본 8.5) 미만이면 크리틱을 반영해 브리프를 고쳐 다음 라운드(최대 --rounds).
 *
 *   node tests/skeleton7-dom/bundleAndRun.cjs tests/media/director.ts --world photo-editorial [--n 4] [--rounds 3] [--threshold 8.5]
 *       [--brand "밀도 — 연남동 소금빵집 …"] [--ref <url>,<url>] [--critic claude|both] [--accent #b45309]
 * 출력: tests/media/director-<job>.json (브리프·URL·점수·크리틱 전부), 콘솔 요약
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { generateGeminiImage } from '~/lib/.server/media/gemini-image';
import { putR2Object, readR2Config } from '~/lib/.server/media/r2';
import { getWorld, type WorldId } from '~/lib/media/style-locks';
import { getLook, lookToPrompt, pickLook, type LookId } from '~/lib/media/look-bibles';

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

const CLAUDE_MODEL = 'claude-fable-5-1';
const ASTRA_MODEL = 'gpt-6-astra';

/** gpt-image-2.5-flare 등 OpenAI 이미지 API — 회화·수채·잉크 세계관의 기본 생성기(베이크오프에서 인물 +1점). */
async function openaiImage(
  env: Record<string, string>,
  model: string,
  prompt: string,
): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model, prompt, n: 1, size: '1536x1024', quality: 'high', output_format: 'jpeg' }),
  });
  const body = (await res.json()) as { data?: Array<{ b64_json?: string }>; error?: { message?: string } };

  if (!res.ok || !body.data?.[0]?.b64_json) {
    throw new Error(`${model}: ${res.status} ${body.error?.message || ''}`);
  }

  return { bytes: new Uint8Array(Buffer.from(body.data[0].b64_json, 'base64')), mimeType: 'image/jpeg' };
}

interface Brief {
  title: string;
  prompt: string;
  negative: string;
}

interface Critique {
  index: number;
  score: number;
  tells: string[];
  fix: string;
}

interface Shot {
  round: number;
  index: number;
  brief: Brief;
  url: string;
  costUsd: number;
  gen?: string;
  editedFrom?: number;
  repairedFrom?: number;
  claude?: Critique;
  astra?: Critique;
  score?: number;
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

async function fetchBytes(url: string): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`fetch ${url} → ${res.status}`);
  }

  return { bytes: new Uint8Array(await res.arrayBuffer()), mimeType: res.headers.get('content-type') || 'image/jpeg' };
}

import { existsSync, readdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

// ---- ④ 수리 루프: 결함 bbox → 마스크 inpaint 1회 (inpaint.ts 검증: 6.5/7 → 8.5/8, 2회째는 하락) ----
function crc32(buf: Uint8Array): number {
  let c = ~0;

  for (const b of buf) {
    c ^= b;

    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
  }

  return ~c >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);

  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, Buffer.from(data)])));

  return Buffer.concat([len, t, Buffer.from(data), crc]);
}

function buildMask(width: number, height: number, bbox: [number, number, number, number], pad = 0.04): Uint8Array {
  const [bx, by, bw, bh] = bbox;
  const x0 = Math.max(0, Math.floor((bx - pad) * width));
  const y0 = Math.max(0, Math.floor((by - pad) * height));
  const x1 = Math.min(width, Math.ceil((bx + bw + pad) * width));
  const y1 = Math.min(height, Math.ceil((by + bh + pad) * height));
  const raw = Buffer.alloc((width * 4 + 1) * height);

  for (let y = 0; y < height; y++) {
    const row = y * (width * 4 + 1);

    for (let x = 0; x < width; x++) {
      const i = row + 1 + x * 4;
      raw[i + 3] = x >= x0 && x < x1 && y >= y0 && y < y1 ? 0 : 255;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  return new Uint8Array(
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      pngChunk('IHDR', ihdr),
      pngChunk('IDAT', deflateSync(raw)),
      pngChunk('IEND', new Uint8Array(0)),
    ]),
  );
}

function jpegSize(b: Uint8Array): { width: number; height: number } {
  let i = 2;

  while (i < b.length) {
    if (b[i] !== 0xff) {
      i++;
      continue;
    }

    const marker = b[i + 1];

    if (marker >= 0xc0 && marker <= 0xc3) {
      return { height: (b[i + 5] << 8) | b[i + 6], width: (b[i + 7] << 8) | b[i + 8] };
    }

    i += 2 + ((b[i + 2] << 8) | b[i + 3]);
  }

  throw new Error('not a baseline jpeg');
}

const LOCATE_SYSTEM = `You are a retoucher's assistant. Given a hero image, find the ONE region whose rendering most betrays it as AI-generated (melted texture, plastic gloss, impossible join, duplicated detail). Return JSON only: {"bbox":[x,y,w,h],"problem":"...","instruction":"one sentence telling an inpainting model what to paint there instead, photographic, matching the surrounding light"} where bbox values are fractions of image width/height (0..1), tight around the defect with a little context.`;

interface Locate {
  bbox: [number, number, number, number];
  problem: string;
  instruction: string;
}

async function openaiInpaint(
  env: Record<string, string>,
  model: string,
  prompt: string,
  image: { bytes: Uint8Array; mimeType: string },
  mask: Uint8Array,
): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const form = new FormData();
  form.append('model', model);
  form.append('prompt', prompt);
  form.append('size', '1536x1024');
  form.append('quality', 'high');
  form.append('output_format', 'jpeg');
  form.append('image[]', new Blob([image.bytes], { type: image.mimeType }), 'image.jpg');
  form.append('mask', new Blob([mask], { type: 'image/png' }), 'mask.png');

  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: form,
  });
  const body = (await res.json()) as { data?: Array<{ b64_json?: string }>; error?: { message?: string } };

  if (!res.ok || !body.data?.[0]?.b64_json) {
    throw new Error(`${model} inpaint: ${res.status} ${body.error?.message || ''}`);
  }

  return { bytes: new Uint8Array(Buffer.from(body.data[0].b64_json, 'base64')), mimeType: 'image/jpeg' };
}

/** 로컬 파일 또는 URL */
async function loadImage(src: string): Promise<{ bytes: Uint8Array; mimeType: string }> {
  if (/^https?:/.test(src)) {
    return fetchBytes(src);
  }

  return { bytes: new Uint8Array(readFileSync(src)), mimeType: src.endsWith('.png') ? 'image/png' : 'image/jpeg' };
}

/** OpenAI 이미지 편집(레퍼런스 동봉 생성에도 씀) — image[] + prompt, 마스크 없음 */
async function openaiEdit(
  env: Record<string, string>,
  model: string,
  prompt: string,
  images: Array<{ bytes: Uint8Array; mimeType: string }>,
): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const form = new FormData();
  form.append('model', model);
  form.append('prompt', prompt);
  form.append('size', '1536x1024');
  form.append('quality', 'high');
  form.append('output_format', 'jpeg');

  for (const [i, img] of images.entries()) {
    form.append('image[]', new Blob([img.bytes], { type: img.mimeType }), `ref-${i}.jpg`);
  }

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

/** ByteDance Seedream 5.0 Pro (ModelArk) — ARK_API_KEY, 16:9, 레퍼런스 앵커는 image[] 로 동봉(스타일 참조) */
async function seedreamImage(
  env: Record<string, string>,
  model: string,
  prompt: string,
  refs: Array<{ bytes: Uint8Array; mimeType: string }> = [],
): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const body: Record<string, unknown> = { model, prompt, size: '2048x1152', response_format: 'url', watermark: false };

  if (refs.length) {
    body.image = refs.slice(0, 4).map((r) => `data:${r.mimeType};base64,${Buffer.from(r.bytes).toString('base64')}`);
  }

  const res = await fetch('https://ark.ap-southeast.bytepluses.com/api/v3/images/generations', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.ARK_API_KEY}` },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { data?: Array<{ url?: string }>; error?: { message?: string } };

  if (!res.ok || !data.data?.[0]?.url) {
    throw new Error(`${model}: ${res.status} ${data.error?.message || JSON.stringify(data).slice(0, 160)}`);
  }

  return fetchBytes(data.data[0].url);
}

function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = Math.min(...['[', '{'].map((c) => (raw.indexOf(c) < 0 ? Infinity : raw.indexOf(c))));

  return JSON.parse(raw.slice(start)) as T;
}

async function claude(
  env: Record<string, string>,
  system: string,
  content: Array<Record<string, unknown>>,
  maxTokens = 4000,
): Promise<string> {
  // 529 overloaded / 5xx 는 5s·15s·40s 백오프로 3회 재시도
  for (let attempt = 0; ; attempt++) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: maxTokens,
        system,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'high' },
        messages: [{ role: 'user', content }],
      }),
    });
    const body = (await res.json()) as { content?: Array<{ type: string; text?: string }>; error?: unknown };

    if (res.ok) {
      return (body.content || [])
        .filter((c) => c.type === 'text')
        .map((c) => c.text || '')
        .join('');
    }

    if ((res.status === 529 || res.status >= 500 || res.status === 429) && attempt < 3) {
      const wait = [5000, 15000, 40000][attempt];
      console.log(`  claude ${res.status} — retry in ${wait / 1000}s`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }

    throw new Error(`claude ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
  }
}

async function astra(env: Record<string, string>, system: string, text: string, images: string[]): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: ASTRA_MODEL,
      store: false,
      max_output_tokens: 8000,
      input: [
        { role: 'system', content: [{ type: 'input_text', text: system }] },
        {
          role: 'user',
          content: [
            { type: 'input_text', text },
            ...images.map((dataUrl) => ({ type: 'input_image', image_url: dataUrl })),
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
    throw new Error(`astra ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
  }

  return (
    body.output_text ??
    (body.output ?? [])
      .flatMap((o) => o.content ?? [])
      .filter((c) => c.type === 'output_text')
      .map((c) => c.text || '')
      .join('')
  );
}

const AD_SYSTEM = `You are the art director and stills photographer for an award-winning web studio (CSS Design Awards / Awwwards tier). You write shot briefs the way a working photographer would brief a shoot — never like an AI image prompt.
Rules that separate award-grade stills from generic AI output:
- Specificity beats adjectives. Name the lens (e.g. 80mm f/2.8 medium format), time of day, light direction, exact props and their wear (chipped enamel, flour fingerprints, torn parchment, a slightly burnt roll). Every frame has at least two imperfections that prove a human made the food/object.
- Composition: subject OFF-centre, rule of thirds or deliberate edge placement, a foreground element cut by the frame, generous negative space in the upper-left third for a headline. Never a centred, symmetric, floating hero unless the world explicitly demands it.
- Light: one motivated source with a real shadow anchor. Avoid uniform soft light and plastic specular highlights.
- Texture over gloss: matte, dust, crumbs, grain. Colour restrained.
- Nothing that reads as a render when the world is photographic. No text, no logos, no watermarks. No photoreal people (painted or illustrated figures only if the world allows, faces turned away or small).
- OBJECT BUDGET: at most 3 distinct objects/props per frame, never a crowd or a row of identical items (generators clone them), never packaging with printed text, never visible hands unless the world is painted and hands are simplified. Fewer things, rendered perfectly, beats more things.
- MEDIUM UNITY: in a painted/illustrated world every element, including food and props, must be rendered in that medium — never a photoreal object pasted onto a painted background. ERA GUARD: every object must plausibly exist in the world's era (no electric lamps, plastic, modern packaging in a neoclassical scene).
- REVISION RULE: when revising after jury notes, only SUBTRACT or SIMPLIFY (remove the failing prop, reduce object count, lower complexity of lighting). Never add new props to fix a problem.
Write in English. Return JSON only.`;

const CRITIC_SYSTEM = `You are a jury member for a web design award, judging hero photography/illustration. Score each image 0-10 where 9+ means it would pass unnoticed as a commissioned editorial shot on a Site-of-the-Day winner, 8 = good but one visible tell, 7 = competent stock, ≤6 = obvious AI/generic.
Also judge cinematography like a DP: is there ONE motivated key light with a believable ratio and a real contact/anchor shadow? Is the light quality (hard/soft) consistent with its source? Is the camera height and focal length deliberate? Flat, sourceless, multi-directional or 'everything evenly lit' lighting is a tell.
Check these AI tells and list every one that applies: centred-symmetric subject; plastic/over-glossy highlights; flawless too-perfect surfaces; generic stock composition; uniform lighting with no shadow anchor; melted/duplicated/impossible details; wrong hands or text-like scribbles; oversaturation; render-look where a photo was intended; no room for a headline; subject too small or too large; style drift from the requested world.
Be harsh. Keep each tell under 12 words and at most 4 tells per image. Return JSON only: [{"index":0,"score":7.5,"tells":["..."],"fix":"one concrete instruction for the next shot"}]`;

async function writeBriefs(
  env: Record<string, string>,
  world: ReturnType<typeof getWorld>,
  look: ReturnType<typeof getLook>,
  brand: string,
  n: number,
  accent: string,
  prior?: { briefs: Brief[]; critiques: Critique[] },
): Promise<Brief[]> {
  const text = [
    `Brand: ${brand}`,
    `World / style lock (must be obeyed verbatim in every prompt): ${world.styleLock(accent)}`,
    `Cinematography look (obey every line — this is how a DP would light and frame it; quote the Light and Camera lines inside each prompt): ${lookToPrompt(look)}`,
    `People policy: ${world.peoplePolicy === 'none' ? 'no people at all' : 'painted/illustrated figures allowed, faces turned away or small'}`,
    prior
      ? `Previous round briefs and jury critiques (fix every tell, keep what scored well):\n${prior.briefs.map((b, i) => `#${i} ${b.title}\nPROMPT: ${b.prompt}\nJURY: score ${prior.critiques[i]?.score} tells ${JSON.stringify(prior.critiques[i]?.tells)} fix: ${prior.critiques[i]?.fix}`).join('\n\n')}`
      : '',
    `Write ${n} distinct hero shot briefs for this brand in this world. Each brief: {"title": "...", "prompt": "120-200 words, photographer-level, ends with the style lock verbatim", "negative": "what must not appear"}. Vary composition and props across the ${n}. Return a JSON array.`,
  ]
    .filter(Boolean)
    .join('\n\n');

  // 사용자 결정(2026-09-11): AD = GPT-6 Astra 고정, --ad claude 로 스위치 가능
  const ad = argValue('--ad') || 'astra';
  const out =
    ad === 'astra' && env.OPENAI_API_KEY
      ? await astra(env, AD_SYSTEM, text, [])
      : await claude(env, AD_SYSTEM, [{ type: 'text', text }], 6000);

  return extractJson<Brief[]>(out).slice(0, n);
}

async function critique(
  env: Record<string, string>,
  world: ReturnType<typeof getWorld>,
  shots: Shot[],
  which: 'claude' | 'astra',
): Promise<Critique[]> {
  const images = await Promise.all(shots.map((s) => fetchBytes(s.url)));
  const header = `World: ${world.label} (${world.id}). ${shots.length} candidate hero images follow, index 0..${shots.length - 1} in order. Brief titles: ${shots.map((s, i) => `#${i} ${s.brief.title}`).join('; ')}.`;

  if (which === 'claude') {
    const content: Array<Record<string, unknown>> = [{ type: 'text', text: header }];

    images.forEach((img, i) => {
      content.push({ type: 'text', text: `image index ${i}` });
      content.push({ type: 'image', source: { type: 'base64', media_type: img.mimeType, data: toBase64(img.bytes) } });
    });

    return extractJson<Critique[]>(await claude(env, CRITIC_SYSTEM, content, 8000));
  }

  return extractJson<Critique[]>(
    await astra(
      env,
      CRITIC_SYSTEM,
      header,
      images.map((img) => `data:${img.mimeType};base64,${toBase64(img.bytes)}`),
    ),
  );
}

async function main() {
  const env = loadEnv();
  const worldId = (argValue('--world') || 'photo-editorial') as WorldId;
  const world = getWorld(worldId);
  const n = Number(argValue('--n') || 4);
  const rounds = Number(argValue('--rounds') || 3);
  const threshold = Number(argValue('--threshold') || world.targetScore);
  const samples = Number(argValue('--samples') || world.samples);
  const accent = argValue('--accent') || '#b45309';
  const brand =
    argValue('--brand') ||
    '밀도 — 연남동 소금빵집. 매일 새벽 네 시에 굽고 하루 세 번, 다 팔리면 문을 닫는다. 국산 밀·발효 버터·굵은 소금.';
  const critic = (argValue('--critic') || 'both') as 'claude' | 'both';
  const refUrls = (argValue('--ref') || '').split(',').filter(Boolean);
  const r2 = readR2Config(env as never);

  if (!env.GOOGLE_GENERATIVE_AI_API_KEY || !env.ANTHROPIC_API_KEY || !r2) {
    throw new Error('GOOGLE_GENERATIVE_AI_API_KEY / ANTHROPIC_API_KEY / R2 env missing');
  }

  const job = `dir-${Date.now().toString(36)}`;

  // 레퍼런스 앵커: --ref URL + tests/media/anchors/<world>/*.jpg (실제 수상작 사진 — 스타일 앵커, 내용 복제 아님)
  const anchorDir = `tests/media/anchors/${world.id}`;
  const anchorFiles = existsSync(anchorDir)
    ? readdirSync(anchorDir)
        .filter((f) => /\.(jpe?g|png)$/i.test(f))
        .map((f) => `${anchorDir}/${f}`)
    : [];
  const references = await Promise.all([...refUrls, ...anchorFiles].map(loadImage));
  const gens = (argValue('--gens') || world.generator).split(',');
  const editTop = Number(argValue('--edit') || 0);
  const repairTop = Number(argValue('--repair') || 0);
  console.log(`anchors ${references.length} · generators ${gens.join(',')} · samples ${samples} · edit top ${editTop}`);

  const shots: Shot[] = [];
  const lookId =
    (argValue('--look') as LookId) ||
    pickLook(
      world.id,
      (argValue('--mood') || '').split(',').filter(Boolean),
      world.theme,
      /빵|카페|음식|food|bakery/i.test(brand),
    );
  const look = getLook(lookId);
  console.log(`look ${look.id} — ${look.label}`);

  let briefs = await writeBriefs(env, world, look, brand, n, accent);
  let cost = 0;
  const started = Date.now();

  for (let round = 1; round <= rounds; round++) {
    console.log(`\n== round ${round} — ${briefs.length} briefs`);

    const roundShots: Shot[] = [];

    // 세계관별 생성기 + 브리프당 samples 장(생성 편차를 선별로 이용)
    let idx = 0;

    const generate = async (gen: string, prompt: string) => {
      if (/seedream/.test(gen)) {
        const refPrompt = references.length
          ? `Use the attached images only as a reference for lighting, colour grading, texture and composition style — do not copy their content. ${prompt}`
          : prompt;

        return { ...(await seedreamImage(env, gen, refPrompt, references)), costUsd: 0.075 };
      }

      if (gen.startsWith('gpt-image')) {
        const refPrompt = references.length
          ? `Use the attached images only as a reference for lighting, colour grading, texture and composition style — do not copy their content. ${prompt}`
          : prompt;
        const img = references.length
          ? await openaiEdit(env, gen, refPrompt, references)
          : await openaiImage(env, gen, prompt);

        return { ...img, costUsd: 0.1 };
      }

      return generateGeminiImage({
        apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY,
        prompt: references.length
          ? `The attached images are style references only (light, grading, texture, composition) — do not reproduce their subjects. ${prompt}`
          : prompt,
        aspectRatio: '16:9',
        references,
        model: gen,
      });
    };

    for (const brief of briefs) {
      for (const gen of gens) {
        for (let k = 0; k < samples; k++) {
          let image;

          try {
            image = await generate(gen, brief.prompt);
          } catch (error) {
            console.log(`  [${idx}] ${gen} failed: ${String((error as Error).message).slice(0, 100)}`);
            continue;
          }

          const url = await putR2Object(r2, `media/director/${job}/r${round}-${idx}.jpg`, image.bytes, image.mimeType);
          cost += image.costUsd;
          roundShots.push({ round, index: idx, brief, url, costUsd: image.costUsd, gen });
          console.log(`  [${idx}] ${brief.title} · ${gen} #${k} → ${url}`);
          idx++;
        }
      }
    }

    // Claude가 과부하(529)면 Astra 단독 심사로 진행 — 루프가 멈추는 것보다 낫다
    let c1: Critique[] = [];
    let c2: Critique[] | undefined;

    try {
      c1 = await critique(env, world, roundShots, 'claude');
    } catch (error) {
      console.log(`  claude critic unavailable (${String((error as Error).message).slice(0, 60)}) — astra only`);
    }

    if ((critic === 'both' || c1.length === 0) && env.OPENAI_API_KEY) {
      c2 = await critique(env, world, roundShots, 'astra');
    }

    for (const [pos, s] of roundShots.entries()) {
      s.claude = c1.find((c) => c.index === pos);
      s.astra = c2?.find((c) => c.index === pos);
      s.score = Math.min(s.claude?.score ?? 10, s.astra?.score ?? 10);
      console.log(
        `  [${s.index}] score ${s.score} (fable ${s.claude?.score}${s.astra ? ` / astra ${s.astra.score}` : ''}) tells: ${(s.claude?.tells || []).join('; ')}`,
      );
    }

    shots.push(...roundShots);
    writeFileSync(
      `tests/media/director-${job}.json`,
      JSON.stringify({ job, world: world.id, brand, threshold, refUrls, shots, costUsd: cost }, null, 2),
    );

    // 결함 부분 수정 루프: 7.3 이상·임계 미만 상위 editTop 장에 심사의 fix를 편집 지시로 적용 → 재심사
    if (editTop > 0) {
      const candidates = roundShots
        .filter((s) => (s.score ?? 0) >= 7.3 && (s.score ?? 0) < threshold)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, editTop);
      const edited: Shot[] = [];

      for (const s of candidates) {
        const fix = (s.claude ?? s.astra)?.fix || '';
        const tells = ((s.claude ?? s.astra)?.tells || []).join('; ');
        const instruction = `Edit this exact image. Fix only these problems: ${tells}. Do this: ${fix}. Keep the composition, camera, lighting, colours and every other element identical. Photographic realism, no text, no new objects.`;
        const src = await fetchBytes(s.url);

        try {
          const img = (s.gen || world.generator).startsWith('gpt-image')
            ? { ...(await openaiEdit(env, s.gen || world.generator, instruction, [src])), costUsd: 0.1 }
            : await generateGeminiImage({
                apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY,
                prompt: instruction,
                aspectRatio: '16:9',
                reference: src,
                model: s.gen && s.gen.startsWith('gemini') ? s.gen : undefined,
              });
          const url = await putR2Object(r2, `media/director/${job}/r${round}-${idx}-edit.jpg`, img.bytes, img.mimeType);
          cost += img.costUsd;
          edited.push({
            round,
            index: idx,
            brief: s.brief,
            url,
            costUsd: img.costUsd,
            gen: s.gen,
            editedFrom: s.index,
          });
          console.log(`  [${idx}] edit of ${s.index} (${s.score}) → ${url}`);
          idx++;
        } catch (error) {
          console.log(`  edit of ${s.index} failed: ${String((error as Error).message).slice(0, 100)}`);
        }
      }

      if (edited.length) {
        let e1: Critique[] = [];

        try {
          e1 = await critique(env, world, edited, 'claude');
        } catch {
          /* astra only */
        }

        const e2 = env.OPENAI_API_KEY ? await critique(env, world, edited, 'astra') : undefined;

        edited.forEach((s, i) => {
          s.claude = e1.find((c) => c.index === i);
          s.astra = e2?.find((c) => c.index === i);
          s.score = Math.min(s.claude?.score ?? 10, s.astra?.score ?? 10);
          console.log(
            `  [${s.index}] edited score ${s.score} (from ${s.editedFrom}) tells: ${((s.claude ?? s.astra)?.tells || []).join('; ')}`,
          );
        });
        roundShots.push(...edited);
        shots.push(...edited);
        writeFileSync(
          `tests/media/director-${job}.json`,
          JSON.stringify({ job, world: world.id, brand, threshold, refUrls, shots, costUsd: cost }, null, 2),
        );
      }
    }

    // ④ 수리 루프 — 7.0 이상·임계 미만 상위 repairTop 장: Fable가 결함 bbox → 마스크 inpaint 1회 → 재심사
    if (repairTop > 0 && env.OPENAI_API_KEY) {
      const candidates = roundShots
        .filter((s) => (s.score ?? 0) >= 7.0 && (s.score ?? 0) < threshold && !s.repairedFrom)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, repairTop);
      const repaired: Shot[] = [];

      for (const s of candidates) {
        try {
          const src = await fetchBytes(s.url);
          const locate = extractJson<Locate>(
            await claude(env, LOCATE_SYSTEM, [
              {
                type: 'text',
                text: `World: ${world.label}. Jury tells: ${((s.claude ?? s.astra)?.tells || []).join('; ')}`,
              },
              { type: 'image', source: { type: 'base64', media_type: src.mimeType, data: toBase64(src.bytes) } },
            ]),
          );
          const { width, height } = jpegSize(src.bytes);
          const mask = buildMask(width, height, locate.bbox);
          const img = await openaiInpaint(
            env,
            'gpt-image-2.5-flare',
            `${locate.instruction} Match the surrounding lighting, grain and colour exactly; change nothing outside the masked area.`,
            src,
            mask,
          );
          const url = await putR2Object(
            r2,
            `media/director/${job}/r${round}-${idx}-repair.jpg`,
            img.bytes,
            img.mimeType,
          );
          cost += 0.1;
          repaired.push({ round, index: idx, brief: s.brief, url, costUsd: 0.1, gen: s.gen, repairedFrom: s.index });
          console.log(`  [${idx}] repair of ${s.index} (${s.score}) — ${locate.problem.slice(0, 70)} → ${url}`);
          idx++;
        } catch (error) {
          console.log(`  repair of ${s.index} failed: ${String((error as Error).message).slice(0, 100)}`);
        }
      }

      if (repaired.length) {
        let p1: Critique[] = [];

        try {
          p1 = await critique(env, world, repaired, 'claude');
        } catch {
          /* astra only */
        }

        const p2 = await critique(env, world, repaired, 'astra');

        repaired.forEach((s, i) => {
          s.claude = p1.find((c) => c.index === i);
          s.astra = p2.find((c) => c.index === i);
          s.score = Math.min(s.claude?.score ?? 10, s.astra?.score ?? 10);
          console.log(
            `  [${s.index}] repaired score ${s.score} (fable ${s.claude?.score ?? '-'} / astra ${s.astra?.score ?? '-'}) from ${s.repairedFrom} tells: ${((s.claude ?? s.astra)?.tells || []).join('; ')}`,
          );
        });
        roundShots.push(...repaired);
        shots.push(...repaired);
        writeFileSync(
          `tests/media/director-${job}.json`,
          JSON.stringify({ job, world: world.id, brand, threshold, refUrls, shots, costUsd: cost }, null, 2),
        );
      }
    }

    const keepers = roundShots.filter((s) => (s.score ?? 0) >= threshold);

    if (keepers.length >= 1 || round === rounds) {
      break;
    }

    // 브리프별 최고 샘플의 심사만 AD에게 넘긴다(빼기/단순화 규칙으로 고치게)
    const perBrief = briefs.map((brief, bi) => {
      const best = roundShots.filter((s) => s.brief === brief).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];

      return {
        index: bi,
        score: best?.score ?? 0,
        tells: (best?.claude ?? best?.astra)?.tells ?? [],
        fix: (best?.claude ?? best?.astra)?.fix ?? '',
      };
    });
    briefs = await writeBriefs(env, world, look, brand, n, accent, { briefs, critiques: perBrief });
  }

  const best = [...shots].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 3);
  console.log(
    `\n== best (threshold ${threshold}) — images $${cost.toFixed(2)}, ${Math.round((Date.now() - started) / 1000)}s`,
  );

  for (const s of best) {
    console.log(`  ${s.score}  r${s.round}-${s.index}  ${s.url}\n      ${s.brief.title}\n      fix: ${s.claude?.fix}`);
  }
}

main().catch((error) => {
  console.error('director failed:', error);
  process.exit(1);
});
