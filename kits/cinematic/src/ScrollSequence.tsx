import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ScrollTrigger, useIsDesktop } from './hooks';

export interface ScrollSequenceProps {
  /** 프레임 이미지 URL 목록(순서대로). 60~120장 권장. */
  frames: string[];
  /** 프레임이 없을 때(모바일·reduced-motion·로드 전) 보여줄 정지 이미지. 보통 frames[0]. */
  poster: string;
  /** 스크롤 길이(vh). 기본 300 = 3화면 동안 시퀀스 재생 */
  lengthVh?: number;
  /** 화면 위 텍스트(헤드라인 등). 시퀀스 위에 고정 */
  children?: ReactNode;
  /** 0~0.7 어둡게 */
  overlay?: number;
  /** 첫 진입 시 전체 프레임 프리로드 — 기본 true(프리로더와 겹치게) */
  preload?: boolean;
}

/**
 * 스크롤 스크럽 이미지 시퀀스 — Pear(pear.no) 문법. 영상 대신 프레임 N장을 캔버스에 그리고 스크롤 진행도로 프레임을 고른다.
 * 스크롤이 재생 헤드가 된다(휠을 멈추면 그림도 멈춤). 모바일·reduced-motion은 poster 정지 이미지.
 * 프레임 소스: Seedance 5초 클립 → tests/media/frames.mjs 로 60장 추출 → R2.
 */
export function ScrollSequence({ frames, poster, lengthVh = 300, children, overlay = 0.25, preload = true }: ScrollSequenceProps) {
  const isDesktop = useIsDesktop();
  const root = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const images = useRef<HTMLImageElement[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isDesktop || !preload || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    let alive = true;
    let loaded = 0;
    images.current = frames.map((src) => {
      const img = new Image();
      img.decoding = 'async';
      img.src = src;
      img.onload = () => {
        loaded++;

        if (alive && loaded >= Math.min(frames.length, 8)) {
          setReady(true);
        }
      };

      return img;
    });

    return () => {
      alive = false;
    };
  }, [frames, isDesktop, preload]);

  useEffect(() => {
    const el = root.current;
    const c = canvas.current;

    if (!el || !c || !isDesktop || !ready) {
      return;
    }

    const ctx = c.getContext('2d');

    if (!ctx) {
      return;
    }

    let current = -1;

    const draw = (i: number) => {
      const img = images.current[i];

      if (!img || !img.complete || img.naturalWidth === 0) {
        return;
      }

      if (c.width !== c.clientWidth || c.height !== c.clientHeight) {
        c.width = c.clientWidth;
        c.height = c.clientHeight;
        current = -1;
      }

      if (i === current) {
        return;
      }

      current = i;

      // object-fit: cover
      const scale = Math.max(c.width / img.naturalWidth, c.height / img.naturalHeight);
      const w = img.naturalWidth * scale;
      const h = img.naturalHeight * scale;
      ctx.drawImage(img, (c.width - w) / 2, (c.height - h) / 2, w, h);
    };

    draw(0);

    const trigger = ScrollTrigger.create({
      trigger: el,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.4,
      onUpdate: (self) => draw(Math.min(frames.length - 1, Math.round(self.progress * (frames.length - 1)))),
    });
    const onResize = () => draw(current < 0 ? 0 : current);
    window.addEventListener('resize', onResize);

    return () => {
      trigger.kill();
      window.removeEventListener('resize', onResize);
    };
  }, [frames.length, isDesktop, ready]);

  const useCanvas = isDesktop && ready;

  return (
    <section ref={root} data-ck="scene" data-ck-snap-steps={Math.max(1, Math.round(lengthVh / 100))} style={{ position: 'relative', height: isDesktop ? `${lengthVh}vh` : '100svh', color: '#fff' }}>
      <div style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'hidden', isolation: 'isolate' }}>
        <img src={poster} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: useCanvas ? 0 : 1, transition: 'opacity 600ms' }} />
        <canvas ref={canvas} aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: useCanvas ? 'block' : 'none' }} />
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, rgba(0,0,0,${overlay * 0.4}) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,${overlay}) 100%)` }} />
        {children ? <div style={{ position: 'absolute', inset: 0, display: 'grid', alignContent: 'end', padding: 'var(--ck-gutter)', paddingBottom: 'clamp(48px, 9vh, 120px)' }}>{children}</div> : null}
      </div>
    </section>
  );
}
