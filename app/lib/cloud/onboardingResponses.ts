import { createClient } from '@supabase/supabase-js';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('onboardingResponses');

export interface OnboardingResponseEntry {
  /** 게스트는 null. */
  userId: string | null;

  /** message_usage와 같은 식별자(ensureChatId 재사용) — 앱 하나당 온보딩 답을 나중에 조인할 때 쓴다. */
  chatId: string;
  q1Audience: string | null;
  q2Storage: string | null;
  q3Industry: string | null;
  q3Raw: string | null;
  q3MappedSkeleton: number | null;
  q4Integrations: string[];
  q5Palette: string | null;
}

/**
 * message_usage.ts와 완전히 같은 패턴 — PLATFORM_SUPABASE_SERVICE_ROLE_KEY가 없으면(로컬 dev 등)
 * 조용히 건너뛴다. 설문 저장 실패가 온보딩 진행에 영향을 주면 안 된다는 게 명시된 요구사항이라, 여기서도
 * 모든 에러를 삼키고 로그만 남긴다.
 */
export async function recordOnboardingResponse(
  entry: OnboardingResponseEntry,
  env: { VITE_PLATFORM_SUPABASE_URL?: string; PLATFORM_SUPABASE_SERVICE_ROLE_KEY?: string } | undefined,
): Promise<void> {
  try {
    const platformUrl = env?.VITE_PLATFORM_SUPABASE_URL;
    const serviceRoleKey = env?.PLATFORM_SUPABASE_SERVICE_ROLE_KEY;

    if (!platformUrl || !serviceRoleKey) {
      return;
    }

    const client = createClient(platformUrl, serviceRoleKey, { auth: { persistSession: false } });

    const { error } = await client.from('onboarding_responses').insert({
      user_id: entry.userId,
      chat_id: entry.chatId,
      q1_audience: entry.q1Audience,
      q2_storage: entry.q2Storage,
      q3_industry: entry.q3Industry,
      q3_raw: entry.q3Raw,
      q3_mapped_skeleton: entry.q3MappedSkeleton,
      q4_integrations: entry.q4Integrations,
      q5_palette: entry.q5Palette,
    });

    if (error) {
      throw error;
    }
  } catch (error) {
    logger.warn('Failed to record onboarding response (non-fatal)', error);
  }
}

/**
 * messageUsage.ts의 recordMessageUsageInBackground와 같은 waitUntil 래핑 — Cloudflare Workers는
 * ctx.waitUntil() 없이 던진 비동기 작업을 응답 종료 후 취소할 수 있다.
 */
export function recordOnboardingResponseInBackground(
  entry: OnboardingResponseEntry,
  env: { VITE_PLATFORM_SUPABASE_URL?: string; PLATFORM_SUPABASE_SERVICE_ROLE_KEY?: string } | undefined,
  ctx: ExecutionContext | undefined,
): void {
  const promise = recordOnboardingResponse(entry, env);

  if (ctx && typeof ctx.waitUntil === 'function') {
    ctx.waitUntil(promise);
  } else {
    void promise;
  }
}
