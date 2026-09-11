import { type ActionFunctionArgs, json } from '@remix-run/cloudflare';
import * as Sentry from '@sentry/remix';
import { getPlatformUserId } from '~/lib/cloud/cloudPlatformAuth';
import { recordMessageUsageInBackground } from '~/lib/cloud/messageUsage';
import { GeminiImageError } from '~/lib/.server/media/gemini-image';
import { R2UploadError, readR2Config } from '~/lib/.server/media/r2';
import { generateSkeleton7ImageSet } from '~/lib/.server/media/skeleton7-image-set';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('api.media-images');

/**
 * 골격 7 이미지 세트(히어로 + ch1~ch3, 4장) 생성 → R2 업로드 → 공개 URL 4개 반환.
 * 키(GOOGLE_GENERATIVE_AI_API_KEY, R2_*)가 하나라도 없으면 503 — 클라이언트는 조용히 플레이스홀더로 남긴다.
 * 원가는 message_usage.image_cost에 남긴다(토큰 컬럼은 이미지 토큰을 그대로 싣는다).
 */

interface MediaImagesBody {
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
      { chatId, industry, prompt, accentHex, darkPalette },
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
