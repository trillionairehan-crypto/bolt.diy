import { atom } from 'nanostores';
import type { User } from '@supabase/supabase-js';
import { platformSupabase } from '~/lib/supabase/platform-client';
import { clearAllChats, openDatabase } from '~/lib/persistence/db';

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

/*
 * 로그아웃 시 로컬 대화 기록 노출 — IndexedDB의 대화·스냅샷은 서버에 없는 이 기기 전용 데이터라
 * 로그아웃해도 그대로 남아 있었다(공용 PC에서 다음 사용자가 이전 사용자의 대화를 그대로 보는
 * 문제). 명시적 signOut() 호출뿐 아니라 다른 탭에서의 로그아웃·세션 만료로 인한 로그아웃도 전부
 * 여기(onAuthStateChange의 SIGNED_OUT)로 모인다 — 트리거 경로와 무관하게 한 곳에서 확실히 지운다.
 * 로컬 정리 실패가 로그아웃 자체를 막으면 안 되므로 실패는 조용히 삼킨다.
 */
export async function clearLocalChatHistory(): Promise<void> {
  try {
    const db = await openDatabase();

    if (db) {
      await clearAllChats(db);
    }
  } catch (error) {
    console.error('Failed to clear local chat history on sign-out (non-fatal):', error);
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
  } = platformSupabase.auth.onAuthStateChange((event, session) => {
    authUserStore.set(session?.user ?? null);
    authResolvedStore.set(true);
    recordLastLoginMethod(session?.user ?? null);

    if (event === 'SIGNED_OUT') {
      clearLocalChatHistory();
    }
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

  /*
   * onAuthStateChange의 SIGNED_OUT 훅(위)도 같은 정리를 하지만 fire-and-forget이라, 로그아웃
   * 직후 페이지를 이동하는 호출부가 정리 완료를 확실히 기다리게 하려면 여기서도 await한다 —
   * clearAllChats는 멱등이라 두 번 불려도 무해하다.
   */
  await clearLocalChatHistory();
}
