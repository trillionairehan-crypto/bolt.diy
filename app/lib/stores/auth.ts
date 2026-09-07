import { atom } from 'nanostores';
import type { User } from '@supabase/supabase-js';
import { platformSupabase } from '~/lib/supabase/platform-client';
import { getPlatformAuthHeaders } from '~/lib/supabase/platformAuthHeader';
import { getStoredUtmParams } from '~/utils/utm';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('auth');

export const authUserStore = atom<User | null>(null);

/*
 * 1-2: authUserStore alone can't distinguish "confirmed logged out" from "haven't checked yet" —
 * both are the same `null`. Routes that must not flash the wrong UI before the session check
 * resolves (the landing page) read this instead.
 */
export const authResolvedStore = atom<boolean>(false);

/**
 * 브랜드 디테일 라운드 4 — 소셜 버튼 클릭 직전 로고가 한 번 튀는 반응을 트리거하는 신호.
 * SocialAuthButtons(자식)가 켜고, AuthPageShell(로고를 실제로 그리는 부모)이 구독한다 — 둘 사이에
 * children으로 콜백을 뚫는 대신 짧게 쓰고 버리는 신호라 nanostore가 더 간단하다.
 */
export const authLogoPulseStore = atom(false);

export type LoginMethod = 'kakao' | 'google' | 'email';

const LAST_LOGIN_METHOD_KEY = 'coralred_last_login_method';
const KNOWN_LOGIN_METHODS: readonly string[] = ['kakao', 'google', 'email'];

/**
 * 4: "최근 로그인" 배지용 — 로그아웃해도 남아야 해서 nanostore가 아니라 localStorage에 직접
 * 저장한다. Supabase가 세션마다 채워주는 user.app_metadata.provider를 그대로 신뢰한다(카카오·구글은
 * 'kakao'/'google', 이메일 OTP는 'email' — 코랄레드가 붙이는 값이 아니라 Supabase Auth 세션 자체의
 * 필드라 조작·불일치 걱정이 없다).
 */
export function getLastLoginMethod(): LoginMethod | null {
  try {
    const stored = localStorage.getItem(LAST_LOGIN_METHOD_KEY);
    return stored && KNOWN_LOGIN_METHODS.includes(stored) ? (stored as LoginMethod) : null;
  } catch {
    return null;
  }
}

function recordLastLoginMethod(user: User | null): void {
  const provider = user?.app_metadata?.provider;

  if (typeof provider !== 'string' || !KNOWN_LOGIN_METHODS.includes(provider)) {
    return;
  }

  try {
    localStorage.setItem(LAST_LOGIN_METHOD_KEY, provider);
  } catch {
    // localStorage 접근 불가(프라이빗 모드 등) — 배지가 그냥 안 뜨는 정도로 무해하게 넘어간다.
  }
}

const utmAttributionAttempted = new Set<string>();

/**
 * 이메일 OTP·카카오·구글 전부 signUp()이 따로 없다 — verifyOtp/OAuth 콜백 둘 다 계정이 없으면
 * Supabase가 그 자리에서 만들고, 있으면 그냥 로그인시킨다. 그래서 "방금 가입했다"를 별도 이벤트로
 * 알 수 없고, Supabase가 계정 생성 시 같은 트랜잭션으로 채우는 created_at과 last_sign_in_at이
 * (거의) 같은 시각이라는 사실로 유추한다 — 재로그인이면 last_sign_in_at만 갱신되고 created_at은
 * 그대로라 둘 사이 간격이 벌어진다. 10초는 OTP 검증 왕복시간을 넉넉히 덮는 여유값.
 */
function isLikelyNewSignup(user: User): boolean {
  const createdAt = Date.parse(user.created_at);
  const lastSignInAt = user.last_sign_in_at ? Date.parse(user.last_sign_in_at) : NaN;

  if (Number.isNaN(createdAt) || Number.isNaN(lastSignInAt)) {
    return false;
  }

  return Math.abs(lastSignInAt - createdAt) < 10_000;
}

function recordUtmAttributionIfNewSignup(user: User | null): void {
  if (!user || utmAttributionAttempted.has(user.id) || !isLikelyNewSignup(user)) {
    return;
  }

  utmAttributionAttempted.add(user.id);

  const utm = getStoredUtmParams();

  void (async () => {
    try {
      const headers = await getPlatformAuthHeaders();

      if (!headers.Authorization) {
        return;
      }

      await fetch('/api/utm-attribution', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          utmSource: utm?.utmSource ?? null,
          utmMedium: utm?.utmMedium ?? null,
          utmCampaign: utm?.utmCampaign ?? null,
          utmContent: utm?.utmContent ?? null,
        }),
      });
    } catch (error) {
      logger.warn('Failed to send UTM attribution (non-fatal)', error);
    }
  })();
}

export function initAuthListener() {
  if (!platformSupabase) {
    authResolvedStore.set(true);

    /*
     * No-op cleanup — matches the shape of the real unsubscribe function returned below, so
     * callers can treat the return value uniformly regardless of whether auth is configured.
     */
    return () => {};
  }

  platformSupabase.auth.getSession().then(({ data }) => {
    authUserStore.set(data.session?.user ?? null);
    authResolvedStore.set(true);
    recordLastLoginMethod(data.session?.user ?? null);
    recordUtmAttributionIfNewSignup(data.session?.user ?? null);
  });

  const {
    data: { subscription },
  } = platformSupabase.auth.onAuthStateChange((_event, session) => {
    authUserStore.set(session?.user ?? null);
    authResolvedStore.set(true);
    recordLastLoginMethod(session?.user ?? null);
    recordUtmAttributionIfNewSignup(session?.user ?? null);
  });

  return () => {
    subscription.unsubscribe();
  };
}

export async function signInWithGoogle() {
  if (!platformSupabase) {
    return;
  }

  await platformSupabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
}

export async function signInWithKakao() {
  if (!platformSupabase) {
    return;
  }

  await platformSupabase.auth.signInWithOAuth({
    provider: 'kakao',
    options: { redirectTo: window.location.origin },
  });
}

export async function sendEmailOtp(email: string) {
  if (!platformSupabase) {
    throw new Error('Supabase가 설정되어 있지 않습니다.');
  }

  const { error } = await platformSupabase.auth.signInWithOtp({ email });

  if (error) {
    throw error;
  }
}

export async function verifyEmailOtp(email: string, token: string) {
  if (!platformSupabase) {
    throw new Error('Supabase가 설정되어 있지 않습니다.');
  }

  const { error } = await platformSupabase.auth.verifyOtp({ email, token, type: 'email' });

  if (error) {
    throw error;
  }
}

/*
 * 로그아웃해도 이 기기의 IndexedDB 대화 기록(clearAllChats)은 지우지 않는다 — 예전에 "공용 PC
 * 개인정보" 명목으로 SIGNED_OUT마다 지우게 했다가, 실제로는 로그아웃 시 대화가 전부 사라지는
 * 프로덕션 버그로 드러나 롤백했다(2026-09-02). 게스트에게 사이드바 목록을 숨기는 건 별도로
 * authUserStore를 직접 구독하는 쪽(Menu.client.tsx)에서 처리하므로 여기서 데이터를 지울 필요가 없다.
 */
export async function signOut() {
  if (!platformSupabase) {
    return;
  }

  await platformSupabase.auth.signOut();
}
