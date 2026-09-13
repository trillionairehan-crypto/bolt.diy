import { describe, expect, it } from 'vitest';
import { normalizeMarqueeItems } from '~cinematic-kit/Marquee';

/*
 * 2026-09-13 coralred.kr 프로덕션 생성에서 나온 백지 사고의 회귀 테스트. 생성물이 items에
 * `{ label, emphasis }` 객체를 넘겼고, 킷이 그대로 children으로 렌더하다 예외가 터져 App 트리가
 * 통째로 언마운트됐다.
 */
describe('normalizeMarqueeItems', () => {
  it('문자열은 그대로 통과한다', () => {
    expect(normalizeMarqueeItems(['원목', '수제'])).toEqual([
      { label: '원목', emphasis: false },
      { label: '수제', emphasis: false },
    ]);
  });

  it('{ label, emphasis } 객체를 받는다 (프로덕션 실패 모양)', () => {
    expect(normalizeMarqueeItems([{ label: '원목' }, { label: '수제', emphasis: true }])).toEqual([
      { label: '원목', emphasis: false },
      { label: '수제', emphasis: true },
    ]);
  });

  it('숫자도 렌더 가능한 문자열로 바꾼다', () => {
    expect(normalizeMarqueeItems([2019])).toEqual([{ label: '2019', emphasis: false }]);
  });

  it('렌더할 글자가 없는 항목은 버린다', () => {
    expect(normalizeMarqueeItems([{ label: '  ' }, '', null as never, { href: '/x' } as never, '유효'])).toEqual([
      { label: '유효', emphasis: false },
    ]);
  });

  it('items가 배열이 아니면 빈 배열이다 — 예외 대신', () => {
    expect(normalizeMarqueeItems(undefined)).toEqual([]);
    expect(normalizeMarqueeItems('원목' as never)).toEqual([]);
  });
});
