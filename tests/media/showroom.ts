/*
 * 쇼룸 미디어 — 딥 브리프 B1 카드용. 가상 브랜드 "밀도"(연남동 소금빵집) 하나를 세계관 6종으로 렌더한다.
 * 세계관당 스틸 N장을 뽑아 R2 media/showroom/<world>/still-<i>.jpg 에 올리고, 사람이 고른 뒤 --video <world>=<url> 로
 * Seedance 루프를 만든다. 품질 기준 9.0: 결함 0, 세계관 문법 충실, 헤드라인 자리 확보.
 *
 *   node tests/skeleton7-dom/bundleAndRun.cjs tests/media/showroom.ts stills [--world <id>] [--n 3] [--gen gemini|openai]
 *   node tests/skeleton7-dom/bundleAndRun.cjs tests/media/showroom.ts video --world <id> --image <url> [--no-loop]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { generateGeminiImage } from '~/lib/.server/media/gemini-image';
import { putR2Object, readR2Config } from '~/lib/.server/media/r2';
import { getVideoProvider } from '~/lib/.server/media/video';
import { copyVideoToR2 } from '~/lib/.server/media/video/store';
import { WORLDS, buildWorldMotionPrompt, getWorld, type WorldId } from '~/lib/media/style-locks';

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

const ACCENT = '#b45309';

/** 세계관별 히어로 피사체 — 같은 가게(밀도 소금빵)를 각 세계관의 문법으로. */
const SUBJECT: Record<WorldId, string> = {
  'photo-editorial':
    'Three Korean salt-bread rolls (소금빵) with coarse salt flakes on a scorched wooden board, a curl of steam, a plaster wall behind, morning light from a window at left.',
  'neoclassical-painting':
    'Two draped figures in classical robes at a marble table present a basket of golden salt-bread rolls as an offering; a bronze ewer, a linen cloth and a small pear tree in a terracotta pot; a Mediterranean bakery arcade behind, deep blue sky.',
  'watercolor-illustration':
    'A single salt-bread roll with flaking salt crystals, painted loosely, with a tiny bakery shopfront sketched below it in a few ink lines.',
  'product-3d':
    'A single perfect salt-bread roll as a hero object: glossy golden crust, coarse salt crystals catching the light, floating above a soft warm-grey gradient.',

  // 1차(price tag)는 글자 없는 주황 덩어리로 렌더돼 결함처럼 보였다 → 색 포인트를 "빵 하나의 크러스트"로 바꾼다.
  'mono-brutal':
    'A stack of salt-bread rolls shot top-down on a black steel tray, one roll broken open, coarse salt scattered; exactly one roll keeps its natural burnt-orange crust color while everything else is monochrome.',

  // 잉크 그래픽 노블(Santioni Spirits 문법): 한 덩어리의 굵은 실루엣 + 종이 여백 + 스팟 컬러 하나.
  'ink-graphic-novel':
    'A baker seen from behind at medium distance, drawn in a few confident brush strokes, sliding a tray of salt-bread rolls into a towering brick oven; the oven mouth is the single spot-color glow; the rest is black ink on paper with cross-hatched shadow.',
};

const LOG = 'tests/media/showroom-2026-09-11.json';

function readLog(): Record<string, unknown> {
  return existsSync(LOG) ? JSON.parse(readFileSync(LOG, 'utf8')) : {};
}

/** gpt-image(회화·잉크 세계관의 고정 생성기) — bakeoff.ts와 같은 호출. 원가는 high 1536x1024 기준 $0.19/장(실측). */
async function openaiImage(
  env: Record<string, string>,
  prompt: string,
): Promise<{ bytes: Uint8Array; mimeType: string; costUsd: number }> {
  const model = 'gpt-image-2.5-flare';
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model, prompt, n: 1, size: '1536x1024', quality: 'high', output_format: 'jpeg' }),
  });
  const body = (await res.json()) as { data?: Array<{ b64_json?: string }>; error?: { message?: string } };

  if (!res.ok || !body.data?.[0]?.b64_json) {
    throw new Error(`${model}: ${res.status} ${body.error?.message || ''}`);
  }

  return { bytes: new Uint8Array(Buffer.from(body.data[0].b64_json, 'base64')), mimeType: 'image/jpeg', costUsd: 0.19 };
}

async function stills(env: Record<string, string>) {
  const apiKey = env.GOOGLE_GENERATIVE_AI_API_KEY;
  const r2 = readR2Config(env as never);
  const gen = argValue('--gen') || 'gemini';

  if (!apiKey || !r2 || (gen === 'openai' && !env.OPENAI_API_KEY)) {
    throw new Error('GOOGLE_GENERATIVE_AI_API_KEY / OPENAI_API_KEY / R2 env missing');
  }

  const only = argValue('--world') as WorldId | undefined;
  const n = Number(argValue('--n') || 3);
  const log = readLog();
  let total = 0;

  for (const world of WORLDS.filter((w) => !only || w.id === only)) {
    const urls: string[] = [];

    for (let i = 0; i < n; i++) {
      const started = Date.now();
      const prompt = `${SUBJECT[world.id]} ${world.styleLock(ACCENT)}`;
      const image =
        gen === 'openai'
          ? await openaiImage(env, prompt)
          : await generateGeminiImage({ apiKey, prompt, aspectRatio: '16:9' });
      const url = await putR2Object(
        r2,
        `media/showroom/${world.id}/still-${Date.now().toString(36)}-${i}.jpg`,
        image.bytes,
        image.mimeType,
      );
      urls.push(url);
      total += image.costUsd;
      console.log(`[${world.id} ${i}] ${url} $${image.costUsd.toFixed(3)} ${Date.now() - started}ms`);
    }

    log[world.id] = {
      ...(log[world.id] as object),
      stills: [...((log[world.id] as { stills?: string[] })?.stills || []), ...urls],
    };
    writeFileSync(LOG, JSON.stringify(log, null, 2));
  }

  console.log(`stills total $${total.toFixed(2)}`);
}

async function video(env: Record<string, string>) {
  const worldId = argValue('--world') as WorldId;
  const imageUrl = argValue('--image');
  const r2 = readR2Config(env as never);

  if (!worldId || !imageUrl || !r2) {
    throw new Error('--world, --image, R2 env required');
  }

  const world = getWorld(worldId);
  const provider = getVideoProvider('seedance', env as never);

  if (!provider) {
    throw new Error('ARK_API_KEY missing');
  }

  const loop = !process.argv.includes('--no-loop');
  const started = Date.now();
  const { taskId } = await provider.createTask({
    imageUrl,
    durationSec: 5,
    loop,
    prompt: buildWorldMotionPrompt(world, loop),
  });

  for (;;) {
    await new Promise((r) => setTimeout(r, 6000));

    const state = await provider.getTask(taskId);

    if (state.status === 'succeeded' && state.videoUrl) {
      const key = `media/showroom/${world.id}/hero-${Date.now().toString(36)}.mp4`;
      const { url } = await copyVideoToR2(state.videoUrl, r2, key);
      const log = readLog();
      log[world.id] = { ...(log[world.id] as object), picked: imageUrl, video: url, usage: state.usage ?? null };
      writeFileSync(LOG, JSON.stringify(log, null, 2));
      console.log(
        `[${world.id}] video ${url} usage ${JSON.stringify(state.usage ?? {})} ${Math.round((Date.now() - started) / 1000)}s`,
      );

      return;
    }

    if (state.status === 'failed') {
      throw new Error(`video failed: ${state.error}`);
    }

    if (Date.now() - started > 600000) {
      throw new Error('video timeout');
    }
  }
}

async function main() {
  const env = loadEnv();
  const mode = process.argv[2];

  if (mode === 'stills') {
    await stills(env);
  } else if (mode === 'video') {
    await video(env);
  } else {
    throw new Error('usage: showroom.ts stills|video');
  }
}

main().catch((error) => {
  console.error('showroom failed:', error);
  process.exit(1);
});
