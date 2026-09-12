import { useEffect, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

export { gsap, ScrollTrigger };

function useMediaQuery(query: string, initial = false): boolean {
  const [matches, setMatches] = useState(initial);

  useEffect(() => {
    const mq = window.matchMedia(query);
    setMatches(mq.matches);

    const handler = (event: MediaQueryListEvent) => setMatches(event.matches);
    mq.addEventListener('change', handler);

    return () => mq.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

/** 768px 이상 = 데스크톱. WebGL·영상·커서는 여기서만 켠다. 첫 렌더는 false(모바일 폴백)로 시작해 다운로드를 아낀다. */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 768px)');
}

/** WebGL 컨텍스트를 만들 수 있는지. 첫 렌더는 false — 못 만드는 브라우저에 three 청크를 보내지 않는다. */
export function useWebGL(): boolean {
  const [ok, setOk] = useState(false);

  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      setOk(Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl')));
    } catch {
      setOk(false);
    }
  }, []);

  return ok;
}

export function useReducedMotion(): boolean {
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');

  useEffect(() => {
    document.documentElement.classList.toggle('ck-reduced', reduced);
  }, [reduced]);

  return reduced;
}

/**
 * Lenis 스무스 스크롤 + GSAP ScrollTrigger 동기화. 페이지 루트에서 한 번만 부른다.
 * reduced-motion이면 네이티브 스크롤 그대로.
 */
export interface SmoothScrollOptions {
  enabled?: boolean;
  /** true면 스크롤이 멈출 때 가장 가까운 장면([data-ck]) 상단에 붙는다 — wearebrand.io 식 한 화면 한 장면. */
  snap?: boolean;
}

export function useSmoothScroll(options: SmoothScrollOptions | boolean = true): void {
  const { enabled = true, snap = false } = typeof options === 'boolean' ? { enabled: options } : options;

  useEffect(() => {
    if (!enabled || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.9 });
    document.documentElement.classList.add('ck-lenis');

    lenis.on('scroll', ScrollTrigger.update);

    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    let snapTrigger: ScrollTrigger | undefined;

    if (snap) {
      const scenes = Array.from(document.querySelectorAll<HTMLElement>('[data-ck="hero"], [data-ck="scene"], [data-ck="chapter"], [data-ck="contact"]'));
      const max = document.documentElement.scrollHeight - window.innerHeight;

      if (scenes.length > 1 && max > 0) {
        // 핀 챕터(data-ck-snap-steps=N)는 내부 단계마다 스냅 지점을 둔다 — 없으면 고정 구간 한가운데서 양끝으로 튄다.
        const points = scenes.flatMap((el) => {
          const steps = Number(el.dataset.ckSnapSteps || 1);
          const step = steps > 1 ? (el.offsetHeight - window.innerHeight) / (steps - 1) : 0;

          return Array.from({ length: steps }, (_, i) => Math.min(1, (el.offsetTop + step * i) / max));
        });
        snapTrigger = ScrollTrigger.create({
          snap: {
            snapTo: points,
            duration: { min: 0.25, max: 0.7 },
            delay: 0.05,
            ease: 'power2.out',
          },
        });
      }
    }

    return () => {
      snapTrigger?.kill();
      gsap.ticker.remove(tick);
      lenis.destroy();
      document.documentElement.classList.remove('ck-lenis');
    };
  }, [enabled, snap]);
}

/** 요소가 뷰포트에 들어올 때 한 번 위로 떠오르며 나타난다. 자식은 stagger. */
export function useRevealOnScroll<T extends HTMLElement>(ref: React.RefObject<T | null>, selector = '[data-reveal]'): void {
  useEffect(() => {
    const root = ref.current;

    if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const targets = root.querySelectorAll(selector);

    if (targets.length === 0) {
      return;
    }

    const tween = gsap.fromTo(
      targets,
      { y: 40, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 1.1,
        ease: 'power3.out',
        stagger: 0.12,
        scrollTrigger: { trigger: root, start: 'top 72%', once: true },
      },
    );

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [ref, selector]);
}

/** 스크롤에 따라 요소를 ±amount px 만큼 느리게 움직인다(패럴랙스). */
export function useParallax<T extends HTMLElement>(ref: React.RefObject<T | null>, amount = 60): void {
  useEffect(() => {
    const el = ref.current;

    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const tween = gsap.fromTo(
      el,
      { y: amount },
      { y: -amount, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } },
    );

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [ref, amount]);
}
