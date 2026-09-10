import { describe, expect, it } from 'vitest';
import { PALETTES } from '~/lib/palettes';
import {
  Q1_OPTIONS,
  Q2_OPTIONS,
  Q3_GRID,
  Q4_CATEGORIES,
  SKELETON_DEFAULT_PERSPECTIVE,
  SKELETON_NAMES,
} from './question-bank';

describe('question-bank data integrity', () => {
  it('has exactly 3 options for Q1 and Q2 (single-select, no unsure escape)', () => {
    expect(Q1_OPTIONS).toHaveLength(3);
    expect(Q2_OPTIONS).toHaveLength(3);
  });

  it('has exactly 10 grid items for Q3', () => {
    expect(Q3_GRID).toHaveLength(10);
  });

  /*
   * 2026-09-04: 모임·동호회를 순위·티어형(6)에서 명단·잔액형(1)으로 옮기면서 골격6은 격자에 직접
   * 매칭되는 항목이 없어졌다(의도된 상태 — 직접 입력에서 Haiku가 골라줄 수는 있음). "골고루 커버"는
   * 이제 필수 조건이 아니라 참고 지표라, 정확히 7종 전부를 요구하진 않되 최소 몇 종 이상은 커버하는지
   * 하한선만 남긴다.
   */
  it('Q3_GRID covers most skeletons (골격6 순위·티어형은 격자에 직접 매칭되는 항목이 없어도 통과)', () => {
    const covered = new Set(Q3_GRID.map((item) => item.skeleton));
    expect(covered.size).toBeGreaterThanOrEqual(6);

    for (const skeleton of [1, 2, 3, 4, 5, 7] as const) {
      expect(covered.has(skeleton), `skeleton ${skeleton} uncovered`).toBe(true);
    }
  });

  it('every Q3_GRID item has 1-2 recommended palettes that are real palette ids', () => {
    const realIds = new Set(PALETTES.map((p) => p.id));

    for (const item of Q3_GRID) {
      expect(item.recommendedPalettes.length).toBeGreaterThanOrEqual(1);
      expect(item.recommendedPalettes.length).toBeLessThanOrEqual(2);

      for (const paletteId of item.recommendedPalettes) {
        expect(realIds.has(paletteId), `${item.id} recommends unknown palette "${paletteId}"`).toBe(true);
      }
    }
  });

  it('Q3_GRID item ids are unique', () => {
    const ids = Q3_GRID.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has exactly 6 Q4 integration categories, matching the 6 named groups', () => {
    expect(Q4_CATEGORIES).toHaveLength(6);
    expect(Q4_CATEGORIES.map((c) => c.id)).toEqual(['auth', 'payment', 'notification', 'tax', 'location', 'storage']);
  });

  it('SKELETON_NAMES has exactly 7 entries, matching new-prompt.ts <app_skeletons> verbatim', () => {
    expect(Object.keys(SKELETON_NAMES)).toHaveLength(7);
    expect(Object.values(SKELETON_NAMES)).toEqual([
      '명단·잔액형',
      '예약·일정형',
      '거래·수지형',
      '목록·상세형',
      '기록·추이형',
      '순위·티어형',
      '소개·홍보형',
    ]);
  });

  it('SKELETON_DEFAULT_PERSPECTIVE matches new-prompt.ts: 1·2=관리자, 3·5·6=본인, 4·7=방문자', () => {
    expect(SKELETON_DEFAULT_PERSPECTIVE).toEqual({
      1: '관리자',
      2: '관리자',
      3: '본인',
      4: '방문자',
      5: '본인',
      6: '본인',
      7: '방문자',
    });
  });
});
