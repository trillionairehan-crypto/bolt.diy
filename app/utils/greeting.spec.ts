import { describe, expect, it } from 'vitest';
import { buildHeadline, buildLoginHeadline, getGreetingPeriod, resolveDisplayName } from './greeting';
import type { User } from '@supabase/supabase-js';

function fakeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u1',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '',
    ...overrides,
  } as User;
}

describe('resolveDisplayName', () => {
  it('returns null for a guest (no user)', () => {
    expect(resolveDisplayName(null)).toBeNull();
  });

  it('prefers full_name over everything else', () => {
    const user = fakeUser({ user_metadata: { full_name: '홍길동', name: '다른이름', nickname: '별명' } });
    expect(resolveDisplayName(user)).toBe('홍길동');
  });

  it('falls back to name when full_name is missing', () => {
    const user = fakeUser({ user_metadata: { name: '김철수', nickname: '별명' } });
    expect(resolveDisplayName(user)).toBe('김철수');
  });

  it('falls back to nickname when full_name/name are missing (kakao-style)', () => {
    const user = fakeUser({ user_metadata: { nickname: '카카오닉네임' } });
    expect(resolveDisplayName(user)).toBe('카카오닉네임');
  });

  it('falls back to the Korean email prefix when no metadata name exists', () => {
    const user = fakeUser({ email: '길동이@example.com', user_metadata: {} });
    expect(resolveDisplayName(user)).toBe('길동이');
  });

  it('does not use a non-Korean email prefix (D: no "trillionairehan님")', () => {
    const user = fakeUser({ email: 'trillionairehan@gmail.com', user_metadata: {} });
    expect(resolveDisplayName(user)).toBeNull();
  });

  it('does not use an email prefix longer than 12 characters even if Korean', () => {
    const user = fakeUser({ email: '가나다라마바사아자차카타파하@example.com', user_metadata: {} });
    expect(resolveDisplayName(user)).toBeNull();
  });

  it('accepts a Korean email prefix of exactly 12 characters', () => {
    const user = fakeUser({ email: '가나다라마바사아자차카타@example.com', user_metadata: {} });
    expect(resolveDisplayName(user)).toBe('가나다라마바사아자차카타');
  });

  it('returns null when nothing usable exists at all', () => {
    const user = fakeUser({ email: undefined, user_metadata: {} });
    expect(resolveDisplayName(user)).toBeNull();
  });

  it('ignores blank-string metadata fields and falls through', () => {
    const user = fakeUser({ user_metadata: { full_name: '   ', name: '' }, email: '민지@example.com' });
    expect(resolveDisplayName(user)).toBe('민지');
  });
});

describe('getGreetingPeriod', () => {
  it('classifies 05:00-10:59 as morning', () => {
    expect(getGreetingPeriod(new Date(2026, 0, 1, 5, 0))).toBe('morning');
    expect(getGreetingPeriod(new Date(2026, 0, 1, 10, 59))).toBe('morning');
  });

  it('classifies 11:00-17:59 as day', () => {
    expect(getGreetingPeriod(new Date(2026, 0, 1, 11, 0))).toBe('day');
    expect(getGreetingPeriod(new Date(2026, 0, 1, 17, 59))).toBe('day');
  });

  it('classifies 18:00-22:59 as evening', () => {
    expect(getGreetingPeriod(new Date(2026, 0, 1, 18, 0))).toBe('evening');
    expect(getGreetingPeriod(new Date(2026, 0, 1, 22, 59))).toBe('evening');
  });

  it('classifies 23:00-04:59 as night (wraps midnight)', () => {
    expect(getGreetingPeriod(new Date(2026, 0, 1, 23, 0))).toBe('night');
    expect(getGreetingPeriod(new Date(2026, 0, 1, 0, 0))).toBe('night');
    expect(getGreetingPeriod(new Date(2026, 0, 1, 4, 59))).toBe('night');
  });
});

describe('buildHeadline', () => {
  it('guest always gets the fixed headline regardless of period/history', () => {
    expect(buildHeadline({ isLoggedIn: false, hasHistory: true, name: '홍길동', period: 'morning' })).toBe(
      '오늘은 뭘 만들어볼까요?',
    );
  });

  it('logged in with zero history gets the first-app headline regardless of period', () => {
    expect(buildHeadline({ isLoggedIn: true, hasHistory: false, name: '홍길동', period: 'evening' })).toBe(
      '첫 앱, 생각보다 금방이에요',
    );
  });

  it('morning with a name includes "님"', () => {
    expect(buildHeadline({ isLoggedIn: true, hasHistory: true, name: '홍길동', period: 'morning' })).toBe(
      '좋은 아침이에요, 홍길동님',
    );
  });

  it('morning with no name never leaves a dangling "님"', () => {
    const headline = buildHeadline({ isLoggedIn: true, hasHistory: true, name: null, period: 'morning' });
    expect(headline).toBe('좋은 아침이에요');
    expect(headline).not.toContain('님');
  });

  it('day/evening/night headlines never reference the name', () => {
    expect(buildHeadline({ isLoggedIn: true, hasHistory: true, name: '홍길동', period: 'day' })).toBe(
      '머릿속 아이디어, 오늘 앱이 될 수 있어요',
    );
    expect(buildHeadline({ isLoggedIn: true, hasHistory: true, name: '홍길동', period: 'evening' })).toBe(
      '하루의 아이디어를 앱으로 남겨볼까요?',
    );
    expect(buildHeadline({ isLoggedIn: true, hasHistory: true, name: '홍길동', period: 'night' })).toBe(
      '조용한 시간이네요',
    );
  });
});

describe('buildLoginHeadline', () => {
  it('05-11 reads "다시 오셨네요"', () => {
    expect(buildLoginHeadline('morning')).toBe('다시 오셨네요');
  });

  it('11-18 reads "기다리고 있었어요"', () => {
    expect(buildLoginHeadline('day')).toBe('기다리고 있었어요');
  });

  it('18-23 reads "오늘도 오셨네요"', () => {
    expect(buildLoginHeadline('evening')).toBe('오늘도 오셨네요');
  });

  it('23-05 reads "조용한 밤이네요"', () => {
    expect(buildLoginHeadline('night')).toBe('조용한 밤이네요');
  });

  it('never mentions a name (not logged in yet)', () => {
    for (const period of ['morning', 'day', 'evening', 'night'] as const) {
      expect(buildLoginHeadline(period)).not.toContain('님');
    }
  });
});
