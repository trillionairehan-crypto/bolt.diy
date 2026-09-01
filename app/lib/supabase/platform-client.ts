import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_PLATFORM_SUPABASE_URL;
const anonKey = import.meta.env.VITE_PLATFORM_SUPABASE_ANON_KEY;

export const isPlatformSupabaseConfigured = Boolean(url && anonKey);

export const platformSupabase = isPlatformSupabaseConfigured ? createClient(url, anonKey) : null;

/**
 * 미터링 재로그인 버그 확정 원인 — platformSupabase.rpc()는 매 요청마다 auth.getSession()으로
 * access_token을 새로 읽어 실어 보내야 정상인데(supabase-js의 fetchWithAuth), 실측(진단 로그)상
 * 재로그인 직후 RPC가 서버에서 auth.uid() = null(=anon 취급)로 도착했다 — 정확히 어느 내부 상태가
 * 어긋나는지보다, 그 어떤 내부 상태에도 의존하지 않는 경로가 필요해서 RPC를 SDK의 .rpc()가 아니라
 * 직접 fetch로 쏜다. Authorization 헤더에 호출부가 방금 getSession()으로 받은 access_token을
 * 그대로 박아 넣으므로, 클라이언트 인스턴스의 내부 캐시/타이밍과 완전히 무관하다.
 */
export async function callPlatformRpc<T = unknown>(
  fn: string,
  accessToken: string,
): Promise<{ data: T | null; error: { message: string } | null }> {
  const response = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    return { data: null, error: { message: message || response.statusText } };
  }

  const data = (await response.json().catch(() => null)) as T | null;

  return { data, error: null };
}
