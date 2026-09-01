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
 * --- overnight3 A5, corrected 08-31 against the pricing page --- v2 목표: 1 사용자 발화 = 1
 * 메시지. auto-fix(actionAlert 기원) 트리거는 제외. 요금제 페이지에 고지된 건 "월 10건"뿐이라
 * 계정 한도는 일일 상한 없이 월 10건. 게스트(비로그인)는 로그인 유도를 위해 별도로 더 낮은
 * 월 1건(가입 유도 목적, 요금제 페이지 대상이 아니므로 고지 의무 없음) — 이쪽도 일일 상한 없음.
 * 유료 플랜 이월(다음 달로 최대 월 할당량의 2배까지 누적)은 결제/플랜 스키마에 대한 가시성이 없어서
 * (pricing.tsx가 불가침이라 플랜별 월 할당량을 코드로 확인 못함) 이번 마이그레이션엔 DB 컬럼만 마련해두고
 * 로직은 안 붙임 — supabase/migrations의 마이그레이션 파일 주석 참고.
 */

/*
 * 로그인 계정의 v2 월간 한도(요금제 페이지의 Free 플랜, 월 10건)는 클라이언트에 상수로 두지
 * 않는다 — get_generation_status_v2 RPC가 유일한 소스이며 서버 쪽 값(10)과 반드시 일치해야
 * 한다. 여기 있는 건 계정 한도보다 낮게 잡아 로그인을 유도하는 게스트 전용 한도뿐.
 */
const V2_GUEST_MONTHLY_LIMIT = 1;
const V2_GUEST_USAGE_KEY = 'coralred_free_generations_v2';

interface V2GuestUsage {
  month: string;
  monthCount: number;
}

function readV2GuestUsage(): V2GuestUsage {
  const stored = getLocalStorage(V2_GUEST_USAGE_KEY) as Partial<V2GuestUsage> | undefined;
  const month = new Date().toISOString().slice(0, 7);

  return {
    month,
    monthCount: stored?.month === month ? (stored.monthCount ?? 0) : 0,
  };
}

export function getV2GuestGenerationsRemaining(): number {
  const usage = readV2GuestUsage();
  return Math.max(V2_GUEST_MONTHLY_LIMIT - usage.monthCount, 0);
}

export function hasV2GuestGenerationsRemaining(): boolean {
  return getV2GuestGenerationsRemaining() > 0;
}

export function incrementV2GuestGenerationsUsed(): void {
  const usage = readV2GuestUsage();
  setLocalStorage(V2_GUEST_USAGE_KEY, {
    month: usage.month,
    monthCount: usage.monthCount + 1,
  } satisfies V2GuestUsage);
}

export async function getV2AccountGenerationStatus(): Promise<{ monthRemaining: number }> {
  if (!platformSupabase) {
    return { monthRemaining: 0 };
  }

  /*
   * 미터링 재로그인 초기화 버그 — 같은 탭에서 로그아웃→재로그인을 반복하면(풀 리로드 없음),
   * onAuthStateChange가 authUserStore를 갱신하는 시점과 supabase-js 내부에서 이후 .rpc() 호출에
   * 실제로 실리는 Authorization 헤더(세션 토큰)가 완전히 동기화되는 시점이 미세하게 어긋날 수
   * 있다. 그 틈에 RPC가 나가면 서버의 auth.uid()가 세션을 못 읽어 "이번 달 기록 없음"으로 보고
   * get_generation_status_v2가 월 한도 그대로(10)를 돌려준다 — RPC 정의 자체는 정상, 요청에
   * 실린 인증 컨텍스트가 문제. getSession()은 내부적으로 진행 중인 세션 동기화를 기다렸다가
   * 반환하므로 RPC 앞에 강제로 끼워 세션이 실제로 잡혀 있는지 먼저 확인한다. 세션이 아직 없으면
   * (동기화가 덜 끝났거나 정말 로그아웃 상태) 여기서 던져서 호출부(QuotaBar)가 그 어떤 숫자도
   * 표시하지 않게 한다 — 틀린 값을 보여주는 것보다 잠깐 안 보여주는 쪽이 안전하다.
   */
  const { data: sessionData } = await platformSupabase.auth.getSession();

  // TEMP DIAG (미터링 재로그인 원인 확정용, 원인 확정 후 제거) — SHOW_DEV_TOOLS 무관하게 항상 출력.
  console.log('[DIAG-METERING] getSession', {
    at: new Date().toISOString(),
    userId: sessionData.session?.user?.id ?? null,
    hasSession: Boolean(sessionData.session),
  });

  if (!sessionData.session) {
    throw new Error('세션이 아직 준비되지 않았습니다.');
  }

  const { data, error } = await platformSupabase.rpc('get_generation_status_v2');

  // TEMP DIAG (미터링 재로그인 원인 확정용, 원인 확정 후 제거).
  console.log('[DIAG-METERING] rpc get_generation_status_v2', {
    at: new Date().toISOString(),
    userId: sessionData.session.user.id,
    error: error ?? null,
    data,
  });

  if (error) {
    throw error;
  }

  return {
    monthRemaining: typeof data?.monthRemaining === 'number' ? data.monthRemaining : 0,
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

export async function getV2AccountGenerationsRemaining(): Promise<number> {
  const status = await getV2AccountGenerationStatus();
  return status.monthRemaining;
}

export async function hasV2GenerationsRemaining(): Promise<boolean> {
  if (authUserStore.get()) {
    const status = await getV2AccountGenerationStatus();
    return status.monthRemaining > 0;
  }

  return hasV2GuestGenerationsRemaining();
}

/** v2 counterpart of getGenerationsRemaining() above — same guest/account dispatch. */
export async function getV2GenerationsRemaining(): Promise<number> {
  if (authUserStore.get()) {
    return getV2AccountGenerationsRemaining();
  }

  return getV2GuestGenerationsRemaining();
}

export async function incrementV2GenerationsUsed(): Promise<void> {
  if (authUserStore.get()) {
    await incrementV2AccountGenerationsUsed();
    return;
  }

  incrementV2GuestGenerationsUsed();
}
