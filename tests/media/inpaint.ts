/*
 * ④ 마스크 inpaint — 전체 편집(v3)은 그림 전체가 흔들려 실패했다. 이번엔 심사가 지적한 영역만 마스크로 잘라 그 부분만 재생성한다.
 *   1) Fable vision에게 이미지와 tells를 주고 결함 영역 bbox(비율)를 받는다
 *   2) 그 bbox(+여유)만 투명한 PNG 마스크를 만들어 gpt-image edits(mask)로 지시("crumb texture 진짜 빵처럼" 등)
 *   3) 원본·결과를 같은 심사로 비교
 *
 *   node tests/skeleton7-dom/bundleAndRun.cjs tests/media/inpaint.ts --image <url|file> --world photo-editorial [--model gpt-image-2.5-flare] [--n 2]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
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

type Img = { bytes: Uint8Array; mimeType: string };

async function load(src: string): Promise<Img> {
  if (/^https?:/.test(src)) {
    const res = await fetch(src);
    return {
      bytes: new Uint8Array(await res.arrayBuffer()),
      mimeType: res.headers.get('content-type') || 'image/jpeg',
    };
  }

  return { bytes: new Uint8Array(readFileSync(src)), mimeType: 'image/jpeg' };
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
): Promise<string> {
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
        max_tokens: 4000,
        system,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'high' },
        messages: [{ role: 'user', content }],
      }),
    });
    const body = (await res.json()) as { content?: Array<{ type: string; text?: string }> };

    if (res.ok) {
      return (body.content || [])
        .filter((c) => c.type === 'text')
        .map((c) => c.text || '')
        .join('');
    }

    if ((res.status === 529 || res.status >= 500) && attempt < 3) {
      await new Promise((r) => setTimeout(r, [5000, 15000, 40000][attempt]));
      continue;
    }

    throw new Error(`claude ${res.status}`);
  }
}

const LOCATE_SYSTEM = `You are a retoucher's assistant. Given a hero image, find the ONE region whose rendering most betrays it as AI-generated (melted texture, plastic gloss, impossible join, duplicated detail). Return JSON only: {"bbox":[x,y,w,h],"problem":"...","instruction":"one sentence telling an inpainting model what to paint there instead, photographic, matching the surrounding light"} where bbox values are fractions of image width/height (0..1) and the box is tight around the defect but includes a little context.`;

const CRITIC_SYSTEM = `You are a jury member for a web design award, judging hero photography. Score each image 0-10 (9+ = commissioned editorial on a Site-of-the-Day winner, 8 = one visible tell, 7 = competent stock, ≤6 = obvious AI). List AI tells (≤4, ≤12 words). Return JSON only: [{"index":0,"score":7.5,"tells":["..."]}]`;

interface Locate {
  bbox: [number, number, number, number];
  problem: string;
  instruction: string;
}

interface Critique {
  index: number;
  score: number;
  tells: string[];
}

/** 이미지 크기의 PNG 마스크 — bbox 영역만 투명(알파 0), 나머지 불투명. OpenAI edits 규격. 의존성 없이 RGBA PNG 인코딩. */
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

function chunk(type: string, data: Uint8Array): Uint8Array {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);

  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, Buffer.from(data)])));

  return Buffer.concat([len, t, Buffer.from(data), crc]);
}

async function buildMask(
  width: number,
  height: number,
  bbox: [number, number, number, number],
  pad = 0.04,
): Promise<Uint8Array> {
  const [bx, by, bw, bh] = bbox;
  const x0 = Math.max(0, Math.floor((bx - pad) * width));
  const y0 = Math.max(0, Math.floor((by - pad) * height));
  const x1 = Math.min(width, Math.ceil((bx + bw + pad) * width));
  const y1 = Math.min(height, Math.ceil((by + bh + pad) * height));
  const raw = Buffer.alloc((width * 4 + 1) * height);

  for (let y = 0; y < height; y++) {
    const row = y * (width * 4 + 1);
    raw[row] = 0; // filter none

    for (let x = 0; x < width; x++) {
      const i = row + 1 + x * 4;
      const inside = x >= x0 && x < x1 && y >= y0 && y < y1;
      raw[i] = 0;
      raw[i + 1] = 0;
      raw[i + 2] = 0;
      raw[i + 3] = inside ? 0 : 255;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return new Uint8Array(
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(raw)),
      chunk('IEND', new Uint8Array(0)),
    ]),
  );
}

async function imageSize(img: Img): Promise<{ width: number; height: number }> {
  // JPEG SOF 파싱(의존성 없이)
  const b = img.bytes;
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

async function openaiInpaint(
  env: Record<string, string>,
  model: string,
  prompt: string,
  image: Img,
  mask: Uint8Array,
): Promise<Img> {
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

async function main() {
  const env = loadEnv();
  const r2 = readR2Config(env as never);
  const src = argValue('--image');
  const world = getWorld((argValue('--world') || 'photo-editorial') as WorldId);
  const model = argValue('--model') || 'gpt-image-2.5-flare';
  const n = Number(argValue('--n') || 2);

  if (!src || !r2 || !env.ANTHROPIC_API_KEY || !env.OPENAI_API_KEY) {
    throw new Error('--image + ANTHROPIC/OPENAI/R2 env required');
  }

  const image = await load(src);
  const { width, height } = await imageSize(image);
  const locate = extractJson<Locate>(
    await claude(env, LOCATE_SYSTEM, [
      { type: 'text', text: `World: ${world.label}. Find the worst AI-tell region.` },
      {
        type: 'image',
        source: { type: 'base64', media_type: image.mimeType, data: Buffer.from(image.bytes).toString('base64') },
      },
    ]),
  );
  console.log(
    `defect: ${locate.problem}\n  bbox ${locate.bbox.map((v) => v.toFixed(2)).join(',')}\n  instruction: ${locate.instruction}`,
  );

  const mask = await buildMask(width, height, locate.bbox);
  const job = `inp-${Date.now().toString(36)}`;
  const outs: Img[] = [];

  for (let k = 0; k < n; k++) {
    try {
      const out = await openaiInpaint(
        env,
        model,
        `${locate.instruction} Match the surrounding lighting, grain and colour exactly; change nothing outside the masked area.`,
        image,
        mask,
      );
      const url = await putR2Object(r2, `media/inpaint/${job}/${k}.jpg`, out.bytes, out.mimeType);
      outs.push(out);
      console.log(`  inpaint ${k} → ${url}`);
    } catch (error) {
      console.log(`  inpaint ${k} failed: ${String((error as Error).message).slice(0, 140)}`);
    }
  }

  const all = [image, ...outs];
  const content: Array<Record<string, unknown>> = [
    { type: 'text', text: `World: ${world.label}. index 0 = original, others = local inpaint of the defect region.` },
  ];
  all.forEach((img, i) => {
    content.push({ type: 'text', text: `image index ${i}` });
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: img.mimeType, data: Buffer.from(img.bytes).toString('base64') },
    });
  });

  const scores = extractJson<Critique[]>(await claude(env, CRITIC_SYSTEM, content));
  console.log('\n| # | Fable | tells |\n|---|---|---|');
  scores.forEach((c) =>
    console.log(`| ${c.index === 0 ? '원본' : `inpaint ${c.index - 1}`} | ${c.score} | ${c.tells.join('; ')} |`),
  );
  writeFileSync(`tests/media/inpaint-${job}.json`, JSON.stringify({ job, src, locate, scores }, null, 2));
}

main().catch((error) => {
  console.error('inpaint failed:', error);
  process.exit(1);
});
