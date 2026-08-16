import { getLocalStorage, setLocalStorage } from '~/lib/persistence/localStorage';
import { authUserStore } from '~/lib/stores/auth';
import { platformSupabase } from '~/lib/supabase/platform-client';

/** 로그인한 계정의 무료 생성 한도 (Supabase RPC로 서버에서 집계). */
export const FREE_GENERATION_LIMIT = 3;

/** 비로그인 게스트의 무료 생성 한도 (localStorage 기반, 브라우저별). */
export const GUEST_FREE_LIMIT = 1;

const FREE_GENERATIONS_USED_KEY = 'coralred_free_generations_used';

// --- 게스트(비로그인) — localStorage 기반 ---

export function getFreeGenerationsUsed(): number {
  const value = getLocalStorage(FREE_GENERATIONS_USED_KEY);
  return typeof value === 'number' && value > 0 ? value : 0;
}

export function getFreeGenerationsRemaining(): number {
  return Math.max(GUEST_FREE_LIMIT - getFreeGenerationsUsed(), 0);
}

export function hasFreeGenerationsRemaining(): boolean {
  return getFreeGenerationsRemaining() > 0;
}

export function incrementFreeGenerationsUsed(): number {
  const next = getFreeGenerationsUsed() + 1;
  setLocalStorage(FREE_GENERATIONS_USED_KEY, next);

  return next;
}

// --- 로그인 계정 — Supabase RPC 기반 ---

export async function getAccountGenerationsRemaining(): Promise<number> {
  if (!platformSupabase) {
    return 0;
  }

  const { data, error } = await platformSupabase.rpc('get_generation_count');

  if (error) {
    throw error;
  }

  const used = typeof data === 'number' ? data : 0;

  return Math.max(FREE_GENERATION_LIMIT - used, 0);
}

export async function incrementAccountGenerationsUsed(): Promise<number> {
  if (!platformSupabase) {
    throw new Error('Supabase가 설정되어 있지 않습니다.');
  }

  const { data, error } = await platformSupabase.rpc('increment_generation_count');

  if (error) {
    throw error;
  }

  return typeof data === 'number' ? data : 0;
}

// --- 통합 진입점 — 로그인 여부에 따라 게스트/계정 로직을 자동 선택 ---

export async function getGenerationsRemaining(): Promise<number> {
  if (authUserStore.get()) {
    return getAccountGenerationsRemaining();
  }

  return getFreeGenerationsRemaining();
}

export async function hasGenerationsRemaining(): Promise<boolean> {
  if (authUserStore.get()) {
    return (await getAccountGenerationsRemaining()) > 0;
  }

  return hasFreeGenerationsRemaining();
}

export async function incrementGenerationsUsed(): Promise<void> {
  if (authUserStore.get()) {
    await incrementAccountGenerationsUsed();
    return;
  }

  incrementFreeGenerationsUsed();
}
