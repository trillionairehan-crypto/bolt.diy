import { atom } from 'nanostores';
import type { User } from '@supabase/supabase-js';
import { platformSupabase } from '~/lib/supabase/platform-client';

export const authUserStore = atom<User | null>(null);

export function initAuthListener() {
  if (!platformSupabase) {
    return () => {};
  }

  platformSupabase.auth.getSession().then(({ data }) => {
    authUserStore.set(data.session?.user ?? null);
  });

  const {
    data: { subscription },
  } = platformSupabase.auth.onAuthStateChange((_event, session) => {
    authUserStore.set(session?.user ?? null);
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

export async function signOut() {
  if (!platformSupabase) {
    return;
  }

  await platformSupabase.auth.signOut();
}
