/*
 * 회화 스타일 정지 컷 실험 — Pear(pear.no) 문법. 신고전주의 회화 속 인물이 오브젝트를 다루는 한 장면을 Nano Banana로 뽑아 R2에 올린다.
 * 실사 인물 금지 규칙은 유지하되 회화·일러스트 인물은 허용(2026-09-11 사용자 결정). 얼굴 클로즈업 없이 중경·측면.
 *
 *   node tests/skeleton7-dom/bundleAndRun.cjs tests/media/painterly.ts [--subject "..."] [--n 2]
 */
import { readFileSync } from 'node:fs';
import { generateGeminiImage } from '~/lib/.server/media/gemini-image';
import { putR2Object, readR2Config } from '~/lib/.server/media/r2';

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = { ...(process.env as Record<string, string>) };

  // CLOUDFLARE_ACCOUNT_ID 는 .env 에, 나머지 시크릿은 .env.local 에 있다 — 둘 다 읽는다(smoke.ts 와 동일).
  for (const file of ['.env.local', '.env']) {
    try {
      for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);

        if (m && !env[m[1]]) {
          env[m[1]] = m[2].replace(/^["']|["']$/g, '');
        }
      }
    } catch {
      /* optional file */
    }
  }

  return env;
}

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const STYLE =
  'Neoclassical oil painting in the manner of Jacques-Louis David and Ingres: smooth glazed brushwork, warm ochre and umber flesh tones, deep ultramarine sky, gilded details, dramatic chiaroscuro from the upper left, faint canvas texture and craquelure. Figures are painted, never photographic; shown at medium distance, faces turned three-quarter or away, hands simplified. No text, no watermark, no frame. Composition leaves the upper third mostly sky for a headline.';

async function main() {
  const env = loadEnv();
  const apiKey = env.GOOGLE_GENERATIVE_AI_API_KEY;
  const r2 = readR2Config(env as never);

  if (!apiKey || !r2) {
    throw new Error('GOOGLE_GENERATIVE_AI_API_KEY / R2 env missing');
  }

  const subject =
    argValue('--subject') ||
    'Two draped figures in classical robes tend a young pear tree on a marble terrace; one waters it from a bronze ewer, the other prunes a branch; a single enormous golden pear rests on a plinth beside them.';
  const n = Number(argValue('--n') || 2);
  const job = `paint-${Date.now().toString(36)}`;
  const started = Date.now();
  let cost = 0;

  for (let i = 0; i < n; i++) {
    const image = await generateGeminiImage({ apiKey, prompt: `${subject} ${STYLE}`, aspectRatio: '16:9' });
    const url = await putR2Object(r2, `media/${job}/still-${i}.jpg`, image.bytes, image.mimeType);
    cost += image.costUsd;
    console.log(`[${i}] ${url} (${Math.round(image.bytes.byteLength / 1024)} KB, $${image.costUsd.toFixed(3)})`);
  }

  console.log(`job ${job} total $${cost.toFixed(3)} ${Date.now() - started}ms`);
}

main().catch((error) => {
  console.error('painterly failed:', error);
  process.exit(1);
});
