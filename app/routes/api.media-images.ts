import { type ActionFunctionArgs, json } from '@remix-run/cloudflare';
import * as Sentry from '@sentry/remix';
import { getPlatformUserId } from '~/lib/cloud/cloudPlatformAuth';
import { recordMessageUsageInBackground } from '~/lib/cloud/messageUsage';
import { GeminiImageError } from '~/lib/.server/media/gemini-image';
import { R2UploadError, r2PublicUrl, readR2Config } from '~/lib/.server/media/r2';
import { JOB_ID_REGEX, generateSkeleton7ImageSet, skeleton7ImageUrls } from '~/lib/.server/media/skeleton7-image-set';
import { defaultVideoProviderName, getVideoProvider, type VideoEnv } from '~/lib/.server/media/video';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('api.media-images');

/**
 * 골격 7 이미지 세트(히어로 + ch1~ch3, 4장) 생성 → R2 업로드 → 공개 URL 4개 반환.
 * 키(GOOGLE_GENERATIVE_AI_API_KEY, R2_*)가 하나라도 없으면 503 — 클라이언트는 조용히 플레이스홀더로 남긴다.
 * 원가는 message_usage.image_cost에 남긴다(토큰 컬럼은 이미지 토큰을 그대로 싣는다).
 */

interface MediaImagesBody {
  /** true면 생성 없이 jobId에 대한 공개 URL 4개만 돌려준다(프롬프트에 먼저 넣기 위함). */
  reserve?: boolean;
  jobId?: string;
  chatId?: string;
  industry?: string;
  prompt?: string;
  accentHex?: string;
  darkPalette?: boolean;
}

const MAX_PROMPT_CHARS = 600;
const MAX_INDUSTRY_CHARS = 80;
const TOTAL_TIMEOUT_MS = 240_000;

export async function action({ request, context }: ActionFunctionArgs) {
  const env = context?.cloudflare?.env as unknown as Record<string, string | undefined> | undefined;
  const apiKey = env?.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const r2 = readR2Config({
    CLOUDFLARE_ACCOUNT_ID: env?.CLOUDFLARE_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID,
    R2_ACCESS_KEY_ID: env?.R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: env?.R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME: env?.R2_BUCKET_NAME || process.env.R2_BUCKET_NAME,
    R2_PUBLIC_BASE_URL: env?.R2_PUBLIC_BASE_URL || process.env.R2_PUBLIC_BASE_URL,
  });

  if (!apiKey || !r2) {
    return json({ error: 'media generation not configured' }, { status: 503 });
  }

  let body: MediaImagesBody;

  try {
    body = (await request.json()) as MediaImagesBody;
  } catch {
    return json({ error: 'invalid body' }, { status: 400 });
  }

  const jobId = typeof body.jobId === 'string' && JOB_ID_REGEX.test(body.jobId) ? body.jobId : '';

  if (!jobId) {
    return json({ error: 'jobId required' }, { status: 400 });
  }

  if (body.reserve === true) {
    /*
     * 영상 공급자가 설정돼 있으면 히어로 영상 URL도 미리 정해 준다 — 키 `media/{jobId}/hero-{provider}.mp4`는
     * api.media-video.ts가 완료 시 쓰는 키와 같아야 한다. 프롬프트에 <video src>로 먼저 들어가고, 파일은 나중에 생긴다.
     */
    const videoEnv = {
      VIDEO_PROVIDER: env?.VIDEO_PROVIDER || process.env.VIDEO_PROVIDER,
      ARK_API_KEY: env?.ARK_API_KEY || process.env.ARK_API_KEY,
      KLING_API_KEY: env?.KLING_API_KEY || process.env.KLING_API_KEY,
      KLING_ACCESS_KEY: env?.KLING_ACCESS_KEY || process.env.KLING_ACCESS_KEY,
      KLING_SECRET_KEY: env?.KLING_SECRET_KEY || process.env.KLING_SECRET_KEY,
    } satisfies VideoEnv;
    const providerName = defaultVideoProviderName(videoEnv);
    const video = getVideoProvider(providerName, videoEnv)
      ? { provider: providerName, url: r2PublicUrl(r2, `media/${jobId}/hero-${providerName}.mp4`) }
      : undefined;

    return json({ jobId, images: skeleton7ImageUrls(r2, jobId), video });
  }

  const chatId = typeof body.chatId === 'string' ? body.chatId.trim() : '';
  const industry = typeof body.industry === 'string' ? body.industry.trim().slice(0, MAX_INDUSTRY_CHARS) : '';
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim().slice(0, MAX_PROMPT_CHARS) : '';
  const accentHex =
    typeof body.accentHex === 'string' && /^#[0-9a-fA-F]{6}$/.test(body.accentHex) ? body.accentHex : '#FF5330';
  const darkPalette = body.darkPalette === true;

  if (!chatId || !industry || !prompt) {
    return json({ error: 'chatId, industry, prompt required' }, { status: 400 });
  }

  const userId = await getPlatformUserId(request);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TOTAL_TIMEOUT_MS);

  try {
    const set = await generateSkeleton7ImageSet(
      { jobId, chatId, industry, prompt, accentHex, darkPalette },
      { apiKey, r2, signal: controller.signal },
    );

    logger.info('image set generated', {
      chatId,
      model: set.model,
      costUsd: set.costUsd,
      elapsedMs: set.elapsedMs,
    });

    recordMessageUsageInBackground(
      {
        userId,
        chatId,
        messageId: `media-images-${Date.now()}`,
        promptTokens: set.promptTokens,
        completionTokens: set.outputTokens,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        model: set.model,
        isAutoFix: false,
        imageCost: set.costUsd,
      },
      env as any,
      context?.cloudflare?.ctx as ExecutionContext | undefined,
    );

    return json({ images: set.images, costUsd: set.costUsd, elapsedMs: set.elapsedMs });
  } catch (error) {
    const kind =
      error instanceof GeminiImageError
        ? `gemini_${error.kind}`
        : error instanceof R2UploadError
          ? 'r2_upload'
          : controller.signal.aborted
            ? 'total_timeout'
            : 'unknown';

    logger.error('image set failed', kind, error instanceof Error ? error.message : error);
    Sentry.captureException(error, { tags: { route: 'api.media-images', kind }, extra: { chatId, industry } });

    return json({ error: 'image generation failed', kind }, { status: 502 });
  } finally {
    clearTimeout(timeoutId);
  }
}
