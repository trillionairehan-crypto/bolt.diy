import { createClient } from '@supabase/supabase-js';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('messageUsage');

export interface MessageUsageEntry {
  /** 게스트는 null — RLS가 auth.uid()=user_id로만 select를 허용해 게스트 행은 아무도 못 본다. */
  userId: string | null;
  chatId: string;
  messageId: string;
  promptTokens: number;
  completionTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  model: string;
  isAutoFix: boolean;
}

/*
 * 토큰 로깅 라운드 — PLATFORM_SUPABASE_SERVICE_ROLE_KEY는 이 샌드박스에 없는 새 시크릿이라, 배포된
 * 프로덕션에도 사용자가 Cloudflare Pages 환경변수로 직접 추가하기 전까지는 없다. 키가 없으면 로깅을
 * 조용히 건너뛴다 — 없다고 생성 자체가 실패하면 안 된다는 게 명시된 요구사항. context.cloudflare.env로만
 * 값을 읽는다(VITE_ 접두사 없음 — cloudSupabaseClient.ts와 같은 패턴, 클라이언트 번들에 절대 안 들어감).
 */
export async function recordMessageUsage(
  entry: MessageUsageEntry,
  env: { VITE_PLATFORM_SUPABASE_URL?: string; PLATFORM_SUPABASE_SERVICE_ROLE_KEY?: string } | undefined,
): Promise<void> {
  try {
    const platformUrl = env?.VITE_PLATFORM_SUPABASE_URL;
    const serviceRoleKey = env?.PLATFORM_SUPABASE_SERVICE_ROLE_KEY;

    if (!platformUrl || !serviceRoleKey) {
      return;
    }

    const client = createClient(platformUrl, serviceRoleKey, { auth: { persistSession: false } });

    const { error } = await client.from('message_usage').insert({
      user_id: entry.userId,
      chat_id: entry.chatId,
      message_id: entry.messageId,
      prompt_tokens: entry.promptTokens,
      completion_tokens: entry.completionTokens,
      cache_read_tokens: entry.cacheReadTokens,
      cache_write_tokens: entry.cacheWriteTokens,
      model: entry.model,
      is_auto_fix: entry.isAutoFix,
    });

    if (error) {
      throw error;
    }
  } catch (error) {
    logger.warn('Failed to record message usage (non-fatal)', error);
  }
}
