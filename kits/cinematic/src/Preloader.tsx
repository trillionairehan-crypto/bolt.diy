import { useEffect, useRef, useState } from 'react';
import { gsap } from './hooks';

export interface PreloaderProps {
  brand: string;
  /** 최소 표시 시간(ms). 이미지가 이미 캐시돼 있어도 이 시간은 보여준다. 기본 1100 */
  minMs?: number;
}

/**
 * 첫 진입 오프닝 — 브랜드명 + 0→100 카운터, 끝나면 위로 걷힌다. 끝날 때 html.ck-ready를 붙여
 * .ck-reveal 요소들과 히어로 텍스트가 그제야 나타난다. reduced-motion이면 즉시 걷힌다.
 */
export function Preloader({ brand, minMs = 1100 }: PreloaderProps) {
  const [done, setDone] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const counter = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const html = document.documentElement;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduced) {
      html.classList.add('ck-ready');
      setDone(true);

      return;
    }

    const value = { n: 0 };
    const tl = gsap.timeline({
      onComplete: () => {
        html.classList.add('ck-ready');
        setDone(true);
      },
    });

    tl.to(value, {
      n: 100,
      duration: minMs / 1000,
      ease: 'power2.inOut',
      onUpdate: () => {
        if (counter.current) {
          counter.current.textContent = String(Math.round(value.n)).padStart(3, '0');
        }
      },
    }).to(root.current, { yPercent: -100, duration: 0.9, ease: 'power4.inOut' }, '+=0.1');

    return () => {
      tl.kill();
    };
  }, [minMs]);

  if (done) {
    return null;
  }

  return (
    <div
      ref={root}
      data-ck="preloader"
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'var(--ck-bg)',
        color: 'var(--ck-text)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        padding: 'var(--ck-gutter)',
      }}
    >
      <span style={{ fontFamily: 'var(--ck-font-display)', fontSize: 'var(--ck-display-md)', fontWeight: 600 }}>{brand}</span>
      <span ref={counter} style={{ fontFamily: 'var(--ck-font-mono)', fontSize: 'var(--ck-display-lg)', fontVariantNumeric: 'tabular-nums' }}>
        000
      </span>
    </div>
  );
}
