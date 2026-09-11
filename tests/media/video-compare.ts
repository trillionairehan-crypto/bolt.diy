/**
 * 같은 이미지 1장 → Seedance·Kling 각각 5초 루프 영상. 나란히 비교용. 판정은 사람이 한다.
 *
 * 사용법:
 *   node tests/skeleton7-dom/bundleAndRun.cjs tests/media/video-compare.ts [--image <https url>] [--only seedance|kling]
 *
 * 필요 환경변수(.env.local): ARK_API_KEY (Seedance), KLING_ACCESS_KEY + KLING_SECRET_KEY (Kling),
 *   R2 5종(결과를 R2에 복사). 한쪽 키가 없으면 그 공급자만 건너뛴다.
 * 출력: 콘솔 표 + tests/media/video-compare-<날짜>.md
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { readR2Config } from '~/lib/.server/media/r2';
import { getVideoProvider, type VideoProvider, type VideoProviderName } from '~/lib/.server/media/video';
import { copyVideoToR2 } from '~/lib/.server/media/video/store';

const DEFAULT_IMAGE =
  'https://pub-b08f99b5ccf040e4b6b0293f2d95f744.r2.dev/media/smoke-1789109212936/1789109212936-hero.jpg';
const POLL_INTERVAL_MS = 10_000;
const POLL_TIMEOUT_MS = 12 * 60_000;

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
      // optional
    }
  }

  return env;
}

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);

  return index >= 0 ? process.argv[index + 1] : undefined;
}

interface Row {
  provider: VideoProviderName;
  model: string;
  outcome: 'ok' | 'failed' | 'skipped';
  createMs?: number;
  totalMs?: number;
  costUsd?: number;
  costBasis?: string;
  sourceUrl?: string;
  r2Url?: string;
  error?: string;
}

async function runOne(
  provider: VideoProvider,
  imageUrl: string,
  jobId: string,
  env: Record<string, string>,
): Promise<Row> {
  const started = Date.now();

  try {
    const { taskId } = await provider.createTask({ imageUrl, durationSec: 5 });
    const createMs = Date.now() - started;
    console.log(`[${provider.name}] task ${taskId} created in ${createMs}ms`);

    while (Date.now() - started < POLL_TIMEOUT_MS) {
      const state = await provider.getTask(taskId);
      console.log(`[${provider.name}] ${Math.round((Date.now() - started) / 1000)}s ${state.status}`);

      if (state.status === 'failed') {
        return {
          provider: provider.name,
          model: provider.model,
          outcome: 'failed',
          createMs,
          totalMs: Date.now() - started,
          error: state.error,
        };
      }

      if (state.status === 'succeeded' && state.videoUrl) {
        const cost = provider.estimateCost(state, { durationSec: 5 });
        const r2 = readR2Config(env);
        const r2Url = r2
          ? (await copyVideoToR2(state.videoUrl, r2, `media/${jobId}/hero-${provider.name}.mp4`)).url
          : undefined;

        return {
          provider: provider.name,
          model: provider.model,
          outcome: 'ok',
          createMs,
          totalMs: Date.now() - started,
          costUsd: cost.usd,
          costBasis: cost.basis,
          sourceUrl: state.videoUrl,
          r2Url,
        };
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    return {
      provider: provider.name,
      model: provider.model,
      outcome: 'failed',
      createMs,
      totalMs: Date.now() - started,
      error: 'poll timeout',
    };
  } catch (error) {
    return {
      provider: provider.name,
      model: provider.model,
      outcome: 'failed',
      totalMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  const env = loadEnv();
  const imageUrl = argValue('--image') || DEFAULT_IMAGE;
  const only = argValue('--only');
  const jobId = `cmp${Date.now().toString(36)}`;
  const names: VideoProviderName[] = ['seedance', 'kling'];
  const rows: Row[] = [];
  const runs: Promise<Row>[] = [];

  for (const name of names) {
    if (only && only !== name) {
      continue;
    }

    const provider = getVideoProvider(name, env);

    if (!provider) {
      rows.push({ provider: name, model: '-', outcome: 'skipped', error: 'env missing' });
      continue;
    }

    runs.push(runOne(provider, imageUrl, jobId, env));
  }

  rows.push(...(await Promise.all(runs)));

  const lines = [
    `# 영상 비교 ${new Date().toISOString().slice(0, 16)} — 이미지: ${imageUrl}`,
    '',
    '| 공급자 | 모델 | 결과 | 생성 요청 | 총 소요 | 원가(USD) | 근거 | 결과 URL(R2) | 원본 URL |',
    '|---|---|---|---|---|---|---|---|---|',
    ...rows.map(
      (r) =>
        `| ${r.provider} | ${r.model} | ${r.outcome}${r.error ? ` (${r.error})` : ''} | ${r.createMs ?? '-'}ms | ${r.totalMs ? Math.round(r.totalMs / 1000) + 's' : '-'} | ${r.costUsd ?? '-'} | ${r.costBasis ?? '-'} | ${r.r2Url ?? '-'} | ${r.sourceUrl ?? '-'} |`,
    ),
  ];

  const out = `tests/media/video-compare-${new Date().toISOString().slice(0, 10)}.md`;
  writeFileSync(out, `${lines.join('\n')}\n`, 'utf8');
  console.log(`\n${lines.join('\n')}\n\nsaved: ${out}`);
}

main().catch((error) => {
  console.error('video-compare failed:', error);
  process.exit(1);
});
