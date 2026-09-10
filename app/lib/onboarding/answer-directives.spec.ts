import { describe, expect, it } from 'vitest';
import {
  buildSkeletonAndPerspectiveDirective,
  mapQ2ToDirectives,
  mergeDirectives,
  hueToRepresentativeHex,
} from './answer-directives';

describe('buildSkeletonAndPerspectiveDirective', () => {
  it('returns 2 lines when a skeleton is given: a non-forcing "골격 기본값" line + a forced perspective line', () => {
    const lines = buildSkeletonAndPerspectiveDirective('team', 2);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(
      '골격 기본값(최후 순위): 예약·일정형 — 판단 순서: 1) 먼저 사용자가 실제로 쓴 요청 문장만 보고 골격을 정하세요. 문장에 골격을 가리키는 핵심 명사(예: 예약, 적립, 순위)가 있으면 이 기본값과 달라도 그 문장을 따르세요. 2) 문장에 그런 근거가 전혀 없을 때만 이 기본값을 쓰세요.',
    );
    expect(lines[1]).toBe('사용자 관점: 관리자 — 관리자·직원이 관리합니다.');
  });

  it('the skeleton line never says "골격:" alone (forced) — always "골격 기본값(최후 순위):" with the ordered override procedure', () => {
    for (const skeletonId of [1, 2, 3, 4, 5, 6, 7] as const) {
      const lines = buildSkeletonAndPerspectiveDirective('solo', skeletonId);
      expect(lines[0]).toMatch(/^골격 기본값\(최후 순위\): /);
      expect(lines[0]).toContain('먼저 사용자가 실제로 쓴 요청 문장만 보고 골격을 정하세요');
      expect(lines[0]).toContain('그런 근거가 전혀 없을 때만 이 기본값을 쓰세요');
      expect(lines[0]).not.toMatch(/^골격: /);
    }
  });

  it('solo -> 본인, forced regardless of skeleton', () => {
    const lines1 = buildSkeletonAndPerspectiveDirective('solo', 1); // skeleton 1 default is 관리자
    const lines7 = buildSkeletonAndPerspectiveDirective('solo', 7); // skeleton 7 default is 방문자
    expect(lines1[1]).toBe('사용자 관점: 본인 — 만드는 사람 혼자 씁니다.');
    expect(lines7[1]).toBe('사용자 관점: 본인 — 만드는 사람 혼자 씁니다.');
  });

  it('public (방문자) is phrased conditionally so it applies correctly no matter which skeleton actually ends up used', () => {
    const lines = buildSkeletonAndPerspectiveDirective('public', 5);
    expect(lines[1]).toContain('이 골격이 원래 관리자·본인 전용이면');
    expect(lines[1]).toContain('손님·고객이 쓰는 방문자용 화면을 추가로 포함');
    expect(lines[1]).toContain('원래 방문자 관점이면 방문자 기준 그대로');
  });

  it('every skeleton name matches new-prompt.ts exactly (spot-check all 7)', () => {
    expect(buildSkeletonAndPerspectiveDirective('team', 1)[0]).toContain('명단·잔액형');
    expect(buildSkeletonAndPerspectiveDirective('team', 2)[0]).toContain('예약·일정형');
    expect(buildSkeletonAndPerspectiveDirective('solo', 3)[0]).toContain('거래·수지형');
    expect(buildSkeletonAndPerspectiveDirective('public', 4)[0]).toContain('목록·상세형');
    expect(buildSkeletonAndPerspectiveDirective('solo', 5)[0]).toContain('기록·추이형');
    expect(buildSkeletonAndPerspectiveDirective('solo', 6)[0]).toContain('순위·티어형');
    expect(buildSkeletonAndPerspectiveDirective('public', 7)[0]).toContain('소개·홍보형');
  });

  it('null skeleton (직접 입력 매핑 실패 -> 자유 생성): only the perspective line, no skeleton line at all', () => {
    const lines = buildSkeletonAndPerspectiveDirective('team', null);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe('사용자 관점: 관리자 — 관리자·직원이 관리합니다.');
    expect(lines.join(' ')).not.toContain('골격');
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

  it('merges a realistic Q1+Q2+Q3 answer set into one directive (skeleton line + perspective line + Q2 line = 3)', () => {
    const merged = mergeDirectives([
      { promptAdditions: buildSkeletonAndPerspectiveDirective('team', 2) },
      mapQ2ToDirectives('cloud'),
    ]);
    expect(merged.promptAdditions).toHaveLength(3);
    expect(merged.promptAdditions[0]).toContain('골격 기본값(최후 순위): 예약·일정형');
    expect(merged.promptAdditions[1]).toBe('사용자 관점: 관리자 — 관리자·직원이 관리합니다.');
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
