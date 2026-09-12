import { useEffect, useRef } from 'react';
import { useIsDesktop, useReducedMotion } from './hooks';

/**
 * 커스텀 커서 — 작은 점 + 느리게 따라오는 링. [data-cursor="hover"] 위에서는 링이 커진다.
 * 데스크톱·포인터 있는 기기·reduced-motion 아님일 때만. 네이티브 커서는 남겨둔다(접근성).
 */
export function Cursor() {
  const isDesktop = useIsDesktop();
  const reduced = useReducedMotion();
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDesktop || reduced || !window.matchMedia('(pointer: fine)').matches) {
      return;
    }

    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let rx = x;
    let ry = y;
    let hovering = false;
    let frame = 0;

    const onMove = (event: MouseEvent) => {
      x = event.clientX;
      y = event.clientY;
      hovering = Boolean((event.target as Element | null)?.closest?.('[data-cursor="hover"], a, button'));
    };

    const loop = () => {
      rx += (x - rx) * 0.16;
      ry += (y - ry) * 0.16;

      if (dot.current) {
        dot.current.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      }

      if (ring.current) {
        ring.current.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%) scale(${hovering ? 2.2 : 1})`;
        ring.current.style.opacity = hovering ? '0.35' : '0.7';
      }

      frame = requestAnimationFrame(loop);
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    frame = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(frame);
    };
  }, [isDesktop, reduced]);

  if (!isDesktop || reduced) {
    return null;
  }

  // mix-blend-mode: difference는 매 프레임 전체 화면 합성을 강제해 영상·패럴랙스와 겹치면 프레임이 떨어진다 — 액센트색 단색으로.
  const base = { position: 'fixed' as const, top: 0, left: 0, pointerEvents: 'none' as const, zIndex: 200, borderRadius: '50%', willChange: 'transform' };

  return (
    <>
      <div ref={dot} data-ck="cursor" aria-hidden="true" style={{ ...base, width: 6, height: 6, background: 'var(--ck-accent)' }} />
      <div ref={ring} data-ck="cursor-ring" aria-hidden="true" style={{ ...base, width: 36, height: 36, border: '1px solid var(--ck-accent)', transition: 'opacity 300ms' }} />
    </>
  );
}
