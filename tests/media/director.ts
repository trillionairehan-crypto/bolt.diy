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

  if (!res.ok) {
    throw new Error(`claude ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
  }

  return (body.content || [])
    .filter((c) => c.type === 'text')
    .map((c) => c.text || '')
    .join('');
}

async function astra(env: Record<string, string>, system: string, text: string, images: string[]): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: ASTRA_MODEL,
      store: false,
      max_output_tokens: 3000,
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
Write in English. Return JSON only.`;

const CRITIC_SYSTEM = `You are a jury member for a web design award, judging hero photography/illustration. Score each image 0-10 where 9+ means it would pass unnoticed as a commissioned editorial shot on a Site-of-the-Day winner, 8 = good but one visible tell, 7 = competent stock, ≤6 = obvious AI/generic.
Check these AI tells and list every one that applies: centred-symmetric subject; plastic/over-glossy highlights; flawless too-perfect surfaces; generic stock composition; uniform lighting with no shadow anchor; melted/duplicated/impossible details; wrong hands or text-like scribbles; oversaturation; render-look where a photo was intended; no room for a headline; subject too small or too large; style drift from the requested world.
Be harsh. Return JSON only: [{"index":0,"score":7.5,"tells":["..."],"fix":"one concrete instruction for the next shot"}]`;

async function writeBriefs(
  env: Record<string, string>,
  world: ReturnType<typeof getWorld>,
  brand: string,
  n: number,
  accent: string,
  prior?: { briefs: Brief[]; critiques: Critique[] },
): Promise<Brief[]> {
  const text = [
    `Brand: ${brand}`,
    `World / style lock (must be obeyed verbatim in every prompt): ${world.styleLock(accent)}`,
    `People policy: ${world.peoplePolicy === 'none' ? 'no people at all' : 'painted/illustrated figures allowed, faces turned away or small'}`,
    prior
      ? `Previous round briefs and jury critiques (fix every tell, keep what scored well):\n${prior.briefs.map((b, i) => `#${i} ${b.title}\nPROMPT: ${b.prompt}\nJURY: score ${prior.critiques[i]?.score} tells ${JSON.stringify(prior.critiques[i]?.tells)} fix: ${prior.critiques[i]?.fix}`).join('\n\n')}`
      : '',
    `Write ${n} distinct hero shot briefs for this brand in this world. Each brief: {"title": "...", "prompt": "120-200 words, photographer-level, ends with the style lock verbatim", "negative": "what must not appear"}. Vary composition and props across the ${n}. Return a JSON array.`,
  ]
    .filter(Boolean)
    .join('\n\n');
  const out = await claude(env, AD_SYSTEM, [{ type: 'text', text }], 6000);

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

    return extractJson<Critique[]>(await claude(env, CRITIC_SYSTEM, content, 3000));
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
  const threshold = Number(argValue('--threshold') || 8.5);
  const accent = argValue('--accent') || '#b45309';
  const brand =
    argValue('--brand') ||
    '밀도 — 연남동 소금빵집. 매일 새벽 네 시에 굽고 하루 세 번, 다 팔리면 문을 닫는다. 국산 밀·발효 버터·굵은 소금.';
  const critic = (argValue('--critic') || 'claude') as 'claude' | 'both';
  const refUrls = (argValue('--ref') || '').split(',').filter(Boolean);
  const r2 = readR2Config(env as never);

  if (!env.GOOGLE_GENERATIVE_AI_API_KEY || !env.ANTHROPIC_API_KEY || !r2) {
    throw new Error('GOOGLE_GENERATIVE_AI_API_KEY / ANTHROPIC_API_KEY / R2 env missing');
  }

  const job = `dir-${Date.now().toString(36)}`;
  const references = await Promise.all(refUrls.map(fetchBytes));
  const shots: Shot[] = [];
  let briefs = await writeBriefs(env, world, brand, n, accent);
  let cost = 0;
  const started = Date.now();

  for (let round = 1; round <= rounds; round++) {
    console.log(`\n== round ${round} — ${briefs.length} briefs`);

    const roundShots: Shot[] = [];

    for (const [i, brief] of briefs.entries()) {
      const image = await generateGeminiImage({
        apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY,
        prompt: brief.prompt,
        aspectRatio: '16:9',
        references,
      });
      const url = await putR2Object(r2, `media/director/${job}/r${round}-${i}.jpg`, image.bytes, image.mimeType);
      cost += image.costUsd;
      roundShots.push({ round, index: i, brief, url, costUsd: image.costUsd });
      console.log(`  [${i}] ${brief.title} → ${url}`);
    }

    const c1 = await critique(env, world, roundShots, 'claude');
    let c2: Critique[] | undefined;

    if (critic === 'both' && env.OPENAI_API_KEY) {
      c2 = await critique(env, world, roundShots, 'astra');
    }

    for (const s of roundShots) {
      s.claude = c1.find((c) => c.index === s.index);
      s.astra = c2?.find((c) => c.index === s.index);
      s.score = Math.min(s.claude?.score ?? 0, s.astra?.score ?? 10);
      console.log(
        `  [${s.index}] score ${s.score} (fable ${s.claude?.score}${s.astra ? ` / astra ${s.astra.score}` : ''}) tells: ${(s.claude?.tells || []).join('; ')}`,
      );
    }

    shots.push(...roundShots);
    writeFileSync(
      `tests/media/director-${job}.json`,
      JSON.stringify({ job, world: world.id, brand, threshold, refUrls, shots, costUsd: cost }, null, 2),
    );

    const keepers = roundShots.filter((s) => (s.score ?? 0) >= threshold);

    if (keepers.length >= 1 || round === rounds) {
      break;
    }

    briefs = await writeBriefs(env, world, brand, n, accent, {
      briefs,
      critiques: c1.map((c) => ({
        ...c,
        ...(c2?.find((x) => x.index === c.index) && {
          score: Math.min(c.score, c2.find((x) => x.index === c.index)!.score),
        }),
      })),
    });
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
