import { type ActionFunctionArgs, type LoaderFunctionArgs, json } from '@remix-run/cloudflare';
import * as Sentry from '@sentry/remix';
import { getPlatformUserId } from '~/lib/cloud/cloudPlatformAuth';
import { recordMessageUsageInBackground } from '~/lib/cloud/messageUsage';
import { readR2Config } from '~/lib/.server/media/r2';
import { copyVideoToR2 } from '~/lib/.server/media/video/store';
import { JOB_ID_REGEX } from '~/lib/.server/media/skeleton7-image-set';
import {
  VideoProviderError,
  defaultVideoProviderName,
  getVideoProvider,
  isVideoProviderName,
  type VideoEnv,
  type VideoProviderName,
} from '~/lib/.server/media/video';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('api.media-video');

/**
 * 히어로 이미지 1장 → 5초 무음 루프 영상. 비동기 2단계:
 *   POST { jobId, imageUrl, provider?, prompt? }        → { provider, model, taskId }
 *   GET  ?jobId=&provider=&taskId=&chatId=              → { status } 또는 완료 시 { status:'succeeded', url, costUsd }
 * 완료 시 공급자 임시 URL의 영상을 R2 `media/{jobId}/hero.mp4`로 복사하고 message_usage.video_cost에 남긴다.
 * 클라이언트는 그동안 정지 이미지를 보여주다가 url이 오면 교체한다.
 */

function readEnv(context: ActionFunctionArgs['context']): Record<string, string | undefined> {
  const env = (context?.cloudflare?.env as unknown as Record<string, string | undefined> | undefined) ?? {};

  return new Proxy(env, {
    get: (target, key: string) => target[key] ?? process.env[key],
  });
}

function resolveProvider(env: Record<string, string | undefined>, requested: unknown) {
  const name: VideoProviderName = isVideoProviderName(requested)
    ? requested
    : defaultVideoProviderName(env as VideoEnv);
  const provider = getVideoProvider(name, env as VideoEnv);

  return { name, provider };
}

export async function action({ request, context }: ActionFunctionArgs) {
  const env = readEnv(context);

  let body: { jobId?: string; imageUrl?: string; provider?: string; prompt?: string; model?: string; loop?: boolean };

  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid body' }, { status: 400 });
  }

  const jobId = typeof body.jobId === 'string' && JOB_ID_REGEX.test(body.jobId) ? body.jobId : '';
  const imageUrl = typeof body.imageUrl === 'string' && /^https:\/\//.test(body.imageUrl) ? body.imageUrl : '';

  if (!jobId || !imageUrl) {
    return json({ error: 'jobId, https imageUrl required' }, { status: 400 });
  }

  const { name, provider } = resolveProvider(env, body.provider);

  if (!provider) {
    return json({ error: `video provider ${name} not configured` }, { status: 503 });
  }

  try {
    const { taskId } = await provider.createTask({
      imageUrl,
      prompt: typeof body.prompt === 'string' ? body.prompt.slice(0, 500) : undefined,
      durationSec: 5,
      model: typeof body.model === 'string' ? body.model.slice(0, 80) : undefined,
      loop: body.loop !== false,
    });

    logger.info('video task created', { provider: name, model: provider.model, taskId, jobId });

    return json({ provider: name, model: provider.model, taskId });
  } catch (error) {
    const status = error instanceof VideoProviderError ? error.status : 0;
    logger.error('video task create failed', error instanceof Error ? error.message : error);
    Sentry.captureException(error, {
      tags: { route: 'api.media-video', kind: 'create', provider: name },
      extra: { jobId },
    });

    return json({ error: 'video task create failed', provider: name, status }, { status: 502 });
  }
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  const env = readEnv(context);
  const url = new URL(request.url);
  const jobId = url.searchParams.get('jobId') ?? '';
  const taskId = url.searchParams.get('taskId') ?? '';
  const chatId = url.searchParams.get('chatId') ?? '';

  if (!JOB_ID_REGEX.test(jobId) || !taskId) {
    return json({ error: 'jobId, taskId required' }, { status: 400 });
  }

  const { name, provider } = resolveProvider(env, url.searchParams.get('provider'));

  if (!provider) {
    return json({ error: `video provider ${name} not configured` }, { status: 503 });
  }

  try {
    const state = await provider.getTask(taskId);

    if (state.status !== 'succeeded') {
      if (state.status === 'failed') {
        Sentry.captureMessage('video task failed', {
          level: 'warning',
          tags: { route: 'api.media-video', kind: 'failed', provider: name },
          extra: { jobId, taskId, error: state.error },
        });
      }

      return json({ provider: name, status: state.status, error: state.error });
    }

    if (!state.videoUrl) {
      return json({ provider: name, status: 'failed', error: 'no video url' });
    }

    const r2 = readR2Config(env);

    if (!r2) {
      return json({ provider: name, status: 'succeeded', url: state.videoUrl, stored: false });
    }

    const stored = await copyVideoToR2(state.videoUrl, r2, `media/${jobId}/hero-${name}.mp4`);
    const cost = provider.estimateCost(state, { durationSec: 5 });

    if (chatId) {
      recordMessageUsageInBackground(
        {
          userId: await getPlatformUserId(request),
          chatId,
          messageId: `media-video-${name}-${taskId}`,
          promptTokens: 0,
          completionTokens: state.usage?.completion_tokens ?? 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          model: `${name}/${provider.model}`,
          isAutoFix: false,
          videoCost: cost.usd,
        },
        env as any,
        context?.cloudflare?.ctx as ExecutionContext | undefined,
      );
    }

    logger.info('video stored', { provider: name, jobId, bytes: stored.bytes, costUsd: cost.usd });

    return json({
      provider: name,
      model: provider.model,
      status: 'succeeded',
      url: stored.url,
      sourceUrl: state.videoUrl,
      costUsd: cost.usd,
      costBasis: cost.basis,
      bytes: stored.bytes,
      stored: true,
    });
  } catch (error) {
    logger.error('video poll failed', error instanceof Error ? error.message : error);
    Sentry.captureException(error, {
      tags: { route: 'api.media-video', kind: 'poll', provider: name },
      extra: { jobId, taskId },
    });

    return json({ error: 'video poll failed', provider: name }, { status: 502 });
  }
}
