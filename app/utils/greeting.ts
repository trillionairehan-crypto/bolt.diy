import type { User } from '@supabase/supabase-js';

/*
 * 채팅 홈 디테일 라운드 — 헤드라인 개인화. 프로필 이름은 OAuth 프로바이더(구글·카카오)마다
 * user_metadata 필드명이 달라 순서대로 시도한다: full_name → name → nickname → 이메일 @ 앞부분.
 * 이메일 폴백은 한글이고 12자 이하일 때만 쓴다 — "trillionairehan님" 같은 인사를 막기 위함.
 */
const EMAIL_PREFIX_KOREAN_ONLY = /^[가-힣]+$/;
const EMAIL_PREFIX_MAX_LENGTH = 12;

export function resolveDisplayName(user: User | null): string | null {
  if (!user) {
    return null;
  }

  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const candidates = [metadata.full_name, metadata.name, metadata.nickname];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  const emailPrefix = user.email?.split('@')[0];

  if (emailPrefix && EMAIL_PREFIX_KOREAN_ONLY.test(emailPrefix) && emailPrefix.length <= EMAIL_PREFIX_MAX_LENGTH) {
    return emailPrefix;
  }

  return null;
}

export type GreetingPeriod = 'morning' | 'day' | 'evening' | 'night';

export function getGreetingPeriod(date: Date = new Date()): GreetingPeriod {
  const hour = date.getHours();

  if (hour >= 5 && hour < 11) {
    return 'morning';
  }

  if (hour >= 11 && hour < 18) {
    return 'day';
  }

  if (hour >= 18 && hour < 23) {
    return 'evening';
  }

  return 'night';
}

export interface HeadlineParams {
  isLoggedIn: boolean;
  hasHistory: boolean;
  name: string | null;
  period?: GreetingPeriod;
}

/** 오직 아침 인사만 이름을 쓴다 — 나머지 시간대 문구는 스펙에 {이름} 자리가 없다. */
export function buildHeadline({ isLoggedIn, hasHistory, name, period }: HeadlineParams): string {
  if (!isLoggedIn) {
    return '오늘은 뭘 만들어볼까요?';
  }

  if (!hasHistory) {
    return '첫 앱, 생각보다 금방이에요';
  }

  const resolvedPeriod = period ?? getGreetingPeriod();

  switch (resolvedPeriod) {
    case 'morning':
      return name ? `좋은 아침이에요, ${name}님` : '좋은 아침이에요';
    case 'day':
      return '머릿속 아이디어, 오늘 앱이 될 수 있어요';
    case 'evening':
      return '하루의 아이디어를 앱으로 남겨볼까요?';
    case 'night':
    default:
      return '조용한 시간이네요';
  }
}

/**
 * 로그인 화면 전용 헤드라인(3) — 채팅 홈과 시간대 경계(05/11/18/23)는 같지만 문구는 다르다.
 * 아직 로그인 전이라 이름은 안 쓴다. 회원가입 헤드라인은 이 함수를 안 쓰고 고정 문구를 그대로 둔다.
 */
export function buildLoginHeadline(period: GreetingPeriod = getGreetingPeriod()): string {
  switch (period) {
    case 'morning':
      return '다시 오셨네요';
    case 'day':
      return '기다리고 있었어요';
    case 'evening':
      return '오늘도 오셨네요';
    case 'night':
    default:
      return '조용한 밤이네요';
  }
}
