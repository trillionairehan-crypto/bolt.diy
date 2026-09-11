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
export function useSmoothScroll(enabled = true): void {
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

    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
      document.documentElement.classList.remove('ck-lenis');
    };
  }, [enabled]);
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
