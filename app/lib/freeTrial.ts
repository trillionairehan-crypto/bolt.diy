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

/*
 * --- overnight3 A5: v2 목표 정의, CORALRED_NEW_METERING 플래그 뒤에 있음 (기본 꺼짐) ---
 * 목표: 1 사용자 발화 = 1 메시지. auto-fix(actionAlert 기원) 트리거는 제외. 무료 티어 = 월 10개 + 일 1개.
 * 유료 플랜 이월(다음 달로 최대 월 할당량의 2배까지 누적)은 결제/플랜 스키마에 대한 가시성이 없어서
 * (pricing.tsx가 불가침이라 플랜별 월 할당량을 코드로 확인 못함) 이번 마이그레이션엔 DB 컬럼만 마련해두고
 * 로직은 안 붙임 — supabase/migrations의 마이그레이션 파일 주석 참고, 아침에 실제 플랜 스키마 확인 후 이어서.
 */

const V2_FREE_MONTHLY_LIMIT = 10;
const V2_FREE_DAILY_LIMIT = 1;
const V2_GUEST_USAGE_KEY = 'coralred_free_generations_v2';

interface V2GuestUsage {
  month: string;
  monthCount: number;
  day: string;
  dayCount: number;
}

function readV2GuestUsage(): V2GuestUsage {
  const stored = getLocalStorage(V2_GUEST_USAGE_KEY) as Partial<V2GuestUsage> | undefined;
  const month = new Date().toISOString().slice(0, 7);
  const day = new Date().toISOString().slice(0, 10);

  return {
    month,
    monthCount: stored?.month === month ? (stored.monthCount ?? 0) : 0,
    day,
    dayCount: stored?.day === day ? (stored.dayCount ?? 0) : 0,
  };
}

export function hasV2GuestGenerationsRemaining(): boolean {
  const usage = readV2GuestUsage();
  return usage.monthCount < V2_FREE_MONTHLY_LIMIT && usage.dayCount < V2_FREE_DAILY_LIMIT;
}

export function incrementV2GuestGenerationsUsed(): void {
  const usage = readV2GuestUsage();
  setLocalStorage(V2_GUEST_USAGE_KEY, {
    month: usage.month,
    monthCount: usage.monthCount + 1,
    day: usage.day,
    dayCount: usage.dayCount + 1,
  } satisfies V2GuestUsage);
}

export async function getV2AccountGenerationStatus(): Promise<{ monthRemaining: number; dayRemaining: number }> {
  if (!platformSupabase) {
    return { monthRemaining: 0, dayRemaining: 0 };
  }

  const { data, error } = await platformSupabase.rpc('get_generation_status_v2');

  if (error) {
    throw error;
  }

  return {
    monthRemaining: typeof data?.monthRemaining === 'number' ? data.monthRemaining : 0,
    dayRemaining: typeof data?.dayRemaining === 'number' ? data.dayRemaining : 0,
  };
}

export async function incrementV2AccountGenerationsUsed(): Promise<void> {
  if (!platformSupabase) {
    throw new Error('Supabase가 설정되어 있지 않습니다.');
  }

  const { error } = await platformSupabase.rpc('increment_generation_count_v2');

  if (error) {
    throw error;
  }
}

export async function hasV2GenerationsRemaining(): Promise<boolean> {
  if (authUserStore.get()) {
    const status = await getV2AccountGenerationStatus();
    return status.monthRemaining > 0 && status.dayRemaining > 0;
  }

  return hasV2GuestGenerationsRemaining();
}

export async function incrementV2GenerationsUsed(): Promise<void> {
  if (authUserStore.get()) {
    await incrementV2AccountGenerationsUsed();
    return;
  }

  incrementV2GuestGenerationsUsed();
}
