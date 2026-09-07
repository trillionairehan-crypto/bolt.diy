import { createClient } from '@supabase/supabase-js';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('utmAttribution');

export interface UtmAttributionEntry {
  userId: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
}

/**
 * message_usage.ts/onboardingResponses.ts와 완전히 같은 패턴 — PLATFORM_SUPABASE_SERVICE_ROLE_KEY가
 * 없으면 조용히 건너뛴다. `on conflict (user_id) do nothing`으로 이미 행이 있으면(재가입 판정이
 * 어긋나 두 번 불려도, 혹은 auth 이벤트가 중복 발화해도) 절대 덮어쓰지 않는다 — 첫 귀속만 유지.
 */
export async function recordUtmAttribution(
  entry: UtmAttributionEntry,
  env: { VITE_PLATFORM_SUPABASE_URL?: string; PLATFORM_SUPABASE_SERVICE_ROLE_KEY?: string } | undefined,
): Promise<void> {
  try {
    const platformUrl = env?.VITE_PLATFORM_SUPABASE_URL;
    const serviceRoleKey = env?.PLATFORM_SUPABASE_SERVICE_ROLE_KEY;

    if (!platformUrl || !serviceRoleKey) {
      return;
    }

    const client = createClient(platformUrl, serviceRoleKey, { auth: { persistSession: false } });

    const { error } = await client.from('utm_attribution').upsert(
      {
        user_id: entry.userId,
        utm_source: entry.utmSource,
        utm_medium: entry.utmMedium,
        utm_campaign: entry.utmCampaign,
        utm_content: entry.utmContent,
      },
      { onConflict: 'user_id', ignoreDuplicates: true },
    );

    if (error) {
      throw error;
    }
  } catch (error) {
    logger.warn('Failed to record UTM attribution (non-fatal)', error);
  }
}

/** messageUsage.ts의 recordMessageUsageInBackground와 같은 waitUntil 래핑. */
export function recordUtmAttributionInBackground(
  entry: UtmAttributionEntry,
  env: { VITE_PLATFORM_SUPABASE_URL?: string; PLATFORM_SUPABASE_SERVICE_ROLE_KEY?: string } | undefined,
  ctx: ExecutionContext | undefined,
): void {
  const promise = recordUtmAttribution(entry, env);

  if (ctx && typeof ctx.waitUntil === 'function') {
    ctx.waitUntil(promise);
  } else {
    void promise;
  }
}
