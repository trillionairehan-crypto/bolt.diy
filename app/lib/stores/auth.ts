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
  });

  const {
    data: { subscription },
  } = platformSupabase.auth.onAuthStateChange((_event, session) => {
    authUserStore.set(session?.user ?? null);
    authResolvedStore.set(true);
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
