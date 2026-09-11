/**
 * 골격 7 이미지 파이프라인 스모크 — Gemini 1장(히어로) 생성 → R2 업로드 → 공개 URL HEAD 확인.
 * UI 없이 서버 모듈만 직접 호출한다. --full 이면 4장 세트(체이닝)까지 돈다.
 *
 * 사용법:
 *   node tests/skeleton7-dom/bundleAndRun.cjs tests/media/smoke.ts [--full]
 *
 * 필요 환경변수(.env.local): GOOGLE_GENERATIVE_AI_API_KEY, CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID,
 *   R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_BASE_URL
 */

import { readFileSync } from 'node:fs';
import { generateGeminiImage } from '~/lib/.server/media/gemini-image';
import { putR2Object, readR2Config } from '~/lib/.server/media/r2';
import { generateSkeleton7ImageSet } from '~/lib/.server/media/skeleton7-image-set';

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = { ...(process.env as Record<string, string>) };

  for (const file of ['.env.local', '.env']) {
    try {
      for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
        const match = line.match(/^([A-Z0-9_]+)=(.*)$/);

        if (match && !env[match[1]]) {
          env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
        }
      }
    } catch {
      // optional file
    }
  }

  return env;
}

async function main() {
  const env = loadEnv();
  const apiKey = env.GOOGLE_GENERATIVE_AI_API_KEY;
  const r2 = readR2Config(env);

  if (!r2) {
    throw new Error(
      'R2 env incomplete (CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_BASE_URL)',
    );
  }

  const full = process.argv.includes('--full');
  const r2Only = process.argv.includes('--r2-only');
  const started = Date.now();

  if (r2Only) {
    // Gemini 없이 R2 자격증명·버킷·공개 URL만 확인: 1KB 텍스트 PUT → 공개 URL HEAD.
    const key = `media/smoke/${started}-ping.txt`;
    const url = await putR2Object(r2, key, new TextEncoder().encode(`ping ${started}`), 'text/plain');
    const head = await fetch(url, { method: 'HEAD' });
    console.log('r2 put ok', url);
    console.log('public HEAD', head.status, head.headers.get('content-type'));
    console.log('total ms', Date.now() - started);

    return;
  }

  if (!apiKey) {
    throw new Error('GOOGLE_GENERATIVE_AI_API_KEY missing');
  }

  if (full) {
    const set = await generateSkeleton7ImageSet(
      {
        jobId: `smoke-${started}`,
        chatId: `smoke-${started}`,
        industry: '카페·음식점',
        prompt: '동네 소금빵 전문 빵집 소개 페이지',
        accentHex: '#b45309',
        darkPalette: false,
      },
      { apiKey, r2 },
    );

    console.log(JSON.stringify(set, null, 2));
  } else {
    const image = await generateGeminiImage({
      apiKey,
      prompt:
        'Hero photograph of a small Korean bakery counter with salt bread, soft window light, editorial, no text.',
      aspectRatio: '16:9',
    });

    console.log('gemini ok', {
      model: image.model,
      mime: image.mimeType,
      bytes: image.bytes.byteLength,
      tokens: { prompt: image.promptTokens, output: image.outputTokens },
      costUsd: image.costUsd,
      elapsedMs: Date.now() - started,
    });

    const ext = image.mimeType === 'image/jpeg' ? 'jpg' : 'png';
    const url = await putR2Object(r2, `media/smoke/${started}-hero.${ext}`, image.bytes, image.mimeType);
    console.log('r2 ok', url);
  }

  console.log('total ms', Date.now() - started);
}

main().catch((error) => {
  console.error('smoke failed:', error);
  process.exit(1);
});
