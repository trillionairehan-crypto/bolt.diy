import { atom } from 'nanostores';
import type { User } from '@supabase/supabase-js';
import { platformSupabase } from '~/lib/supabase/platform-client';

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
  });

  const {
    data: { subscription },
  } = platformSupabase.auth.onAuthStateChange((_event, session) => {
    authUserStore.set(session?.user ?? null);
    authResolvedStore.set(true);
    recordLastLoginMethod(session?.user ?? null);
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

export async function signOut() {
  if (!platformSupabase) {
    return;
  }

  await platformSupabase.auth.signOut();
}
