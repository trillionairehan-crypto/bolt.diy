import { useEffect, useRef } from 'react';
import { gsap } from './hooks';

export interface BigNumberProps {
  /** 숫자 부분. 라틴 서체·고정폭으로 렌더 */
  value: number;
  /** 접두(‘$’)·접미(‘만+’, ‘%’, ‘회’). 한글 단위는 본문 서체 */
  prefix?: string;
  suffix?: string;
  label: string;
  decimals?: number;
  /** 천 단위 구분. 기본 true */
  group?: boolean;
}

/**
 * 큰 숫자 — 수상작 증거 섹션(Aspen "$1M-5M", Duyu "800 million+", Revelatio "145+").
 * 화면에 들어올 때 0→값 카운트업. 실제 값이 없으면 이 컴포넌트를 쓰지 말 것(가짜 숫자 금지).
 */
export function BigNumber({ value, prefix = '', suffix = '', label, decimals = 0, group = true }: BigNumberProps) {
  const num = useRef<HTMLSpanElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const fmt = (n: number) => (group ? n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : n.toFixed(decimals));

  useEffect(() => {
    const el = num.current;

    if (!el || !root.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const state = { n: 0 };
    const tween = gsap.to(state, {
      n: value,
      duration: 1.6,
      ease: 'power3.out',
      onUpdate: () => {
        el.textContent = fmt(state.n);
      },
      scrollTrigger: { trigger: root.current, start: 'top 78%', once: true },
    });

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, decimals, group]);

  return (
    <div ref={root} style={{ display: 'grid', gap: '14px', alignContent: 'start' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.08em', fontSize: 'var(--ck-number)', flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
        {prefix ? <span className="ck-num" style={{ fontSize: '0.55em' }}>{prefix}</span> : null}
        <span ref={num} className="ck-num" style={{ whiteSpace: 'nowrap' }}>
          {fmt(value)}
        </span>
        {suffix ? <span style={{ fontFamily: 'var(--ck-font-body)', fontWeight: 400, fontSize: '0.32em', letterSpacing: '-0.01em', color: 'var(--ck-muted)' }}>{suffix}</span> : null}
      </div>
      <div style={{ borderTop: '1px solid var(--ck-line)', paddingTop: '10px', fontSize: '14px', color: 'var(--ck-muted)' }}>{label}</div>
    </div>
  );
}
