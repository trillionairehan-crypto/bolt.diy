import { describe, expect, it } from 'vitest';
import {
  buildSkeletonAndPerspectiveDirective,
  mapQ2ToDirectives,
  mergeDirectives,
  hueToRepresentativeHex,
} from './answer-directives';

describe('buildSkeletonAndPerspectiveDirective', () => {
  it('emits the exact new-prompt.ts skeleton name when Q1 matches the skeleton default (team -> 관리자, skeleton 2 예약·일정형)', () => {
    const result = buildSkeletonAndPerspectiveDirective('team', 2);
    expect(result).toBe('골격: 예약·일정형 / 사용자 관점: 관리자');
  });

  it('solo (본인) matches skeleton 5 기록·추이형 default -> no override wording', () => {
    const result = buildSkeletonAndPerspectiveDirective('solo', 5);
    expect(result).toBe('골격: 기록·추이형 / 사용자 관점: 본인');
    expect(result).not.toContain('대신');
  });

  it('public (방문자) on a non-방문자 skeleton ADDS a visitor view instead of replacing the default (기록·추이형 예시)', () => {
    const result = buildSkeletonAndPerspectiveDirective('public', 5);
    expect(result).toContain('골격: 기록·추이형');
    expect(result).toContain('본인 기준으로 만들되');
    expect(result).toContain('방문자용 화면을 추가로 포함');
  });

  it('team (관리자) on a 방문자-default skeleton (4, 목록·상세형) overrides straight, not additively', () => {
    const result = buildSkeletonAndPerspectiveDirective('team', 4);
    expect(result).toContain('골격: 목록·상세형');
    expect(result).toContain('사용자 관점: 관리자');
    expect(result).toContain('대신');
    expect(result).not.toContain('추가로 포함');
  });

  it('every skeleton name matches new-prompt.ts exactly (spot-check all 7)', () => {
    expect(buildSkeletonAndPerspectiveDirective('team', 1)).toContain('명단·차감형');
    expect(buildSkeletonAndPerspectiveDirective('team', 2)).toContain('예약·일정형');
    expect(buildSkeletonAndPerspectiveDirective('solo', 3)).toContain('거래·수지형');
    expect(buildSkeletonAndPerspectiveDirective('public', 4)).toContain('목록·상세형');
    expect(buildSkeletonAndPerspectiveDirective('solo', 5)).toContain('기록·추이형');
    expect(buildSkeletonAndPerspectiveDirective('solo', 6)).toContain('순위·티어형');
    expect(buildSkeletonAndPerspectiveDirective('public', 7)).toContain('소개·홍보형');
  });

  it('null skeleton (직접 입력 매핑 실패 -> 자유 생성): no "골격:" prefix, still states the perspective', () => {
    const result = buildSkeletonAndPerspectiveDirective('team', null);
    expect(result).toBe('사용자 관점: 관리자');
    expect(result).not.toContain('골격:');
  });
});

describe('mapQ2ToDirectives', () => {
  it('cloud: no connectSupabase opinion (Cloud storage is not Supabase)', () => {
    const result = mapQ2ToDirectives('cloud');
    expect(result.connectSupabase).toBeUndefined();
    expect(result.promptAdditions).toHaveLength(1);
  });

  it('none: connectSupabase explicitly false, client-only app', () => {
    const result = mapQ2ToDirectives('none');
    expect(result.connectSupabase).toBe(false);
    expect(result.promptAdditions?.[0]).toContain('저장할 필요가 없어요');
  });

  it('supabase: mentions the 저장 기능 켜기 flow, no connectSupabase opinion (depends on real connection state)', () => {
    const result = mapQ2ToDirectives('supabase');
    expect(result.connectSupabase).toBeUndefined();
    expect(result.promptAdditions?.[0]).toContain('저장 기능 켜기');
  });
});

describe('mergeDirectives', () => {
  it('concatenates promptAdditions across parts in order', () => {
    const merged = mergeDirectives([{ promptAdditions: ['a'] }, { promptAdditions: ['b', 'c'] }]);
    expect(merged.promptAdditions).toEqual(['a', 'b', 'c']);
  });

  it("a later part's connectSupabase overrides an earlier one", () => {
    const merged = mergeDirectives([{ connectSupabase: true }, { connectSupabase: false }]);
    expect(merged.connectSupabase).toBe(false);
  });

  it('a part with connectSupabase undefined does not clear a previously-set value', () => {
    const merged = mergeDirectives([{ connectSupabase: true }, { promptAdditions: ['x'] }]);
    expect(merged.connectSupabase).toBe(true);
  });

  it('merging an empty list yields an empty promptAdditions array and no opinions', () => {
    const merged = mergeDirectives([]);
    expect(merged).toEqual({ promptAdditions: [] });
  });

  it('merges a realistic Q1+Q2+Q3 answer set into one directive', () => {
    const merged = mergeDirectives([
      { promptAdditions: [buildSkeletonAndPerspectiveDirective('team', 2)] },
      mapQ2ToDirectives('cloud'),
    ]);
    expect(merged.promptAdditions).toHaveLength(2);
    expect(merged.promptAdditions[0]).toBe('골격: 예약·일정형 / 사용자 관점: 관리자');
  });
});

describe('hueToRepresentativeHex', () => {
  it('returns the brand default hex for hue 33 (kept for Chat.client.tsx compatibility, currently unreachable)', () => {
    expect(hueToRepresentativeHex(33)).toBe('#FF5330');
  });

  it('returns undefined for any other hue', () => {
    expect(hueToRepresentativeHex(222)).toBeUndefined();
  });
});
