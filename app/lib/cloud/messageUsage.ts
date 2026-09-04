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

/*
 * 실측(2026-09-04): api.chat.ts/api.llmcall.ts 둘 다 `void recordMessageUsage(...)`로 던지고 바로
 * 응답을 끝냈다 — Cloudflare Workers 런타임은 응답이 끝나면 ctx.waitUntil()로 등록되지 않은 대기 중
 * 비동기 작업을 취소할 수 있어(로컬 dev의 node 프로세스는 안 그러니 로컬에서만 항상 통과해온 것),
 * 프로덕션에서 이 호출이 유실될 위험이 있었다. 호출부는 이제 이 헬퍼를 거친다 — waitUntil이 있으면
 * 그걸로 감싸고, 없으면(로컬 dev — wrangler의 PlatformProxy 문서상 ctx는 no-op 목이라 실제로는
 * 항상 존재하지만, 다른 런타임 변형에도 안전하게) 기존과 같은 fire-and-forget로 떨어진다.
 * recordMessageUsage 자체가 모든 에러를 삼키므로(위 catch) 여기서 추가로 .catch()할 필요는 없다.
 */
export function recordMessageUsageInBackground(
  entry: MessageUsageEntry,
  env: { VITE_PLATFORM_SUPABASE_URL?: string; PLATFORM_SUPABASE_SERVICE_ROLE_KEY?: string } | undefined,
  ctx: ExecutionContext | undefined,
): void {
  const promise = recordMessageUsage(entry, env);

  if (ctx && typeof ctx.waitUntil === 'function') {
    ctx.waitUntil(promise);
  } else {
    void promise;
  }
}
