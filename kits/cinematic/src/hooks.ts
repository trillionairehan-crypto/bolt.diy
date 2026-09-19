import { useEffect, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

export { gsap, ScrollTrigger };

/*
 * 첫 렌더부터 실제 값으로 시작한다. 예전엔 false(모바일)로 시작해 한 프레임 뒤 뒤집었는데, 그 사이에 마운트된
 * ScrollTrigger(컨택트 리빌 등)가 모바일 레이아웃 기준 위치를 재 놓고 데스크톱으로 바뀐 뒤엔 영영 안 닿았다
 * (2026-09-19 디테일 검증: Showcase3D 모바일 스택이 900px 더 길어지자 컨택트 리빌이 절대 안 켜짐).
 */
function useMediaQuery(query: string, initial = false): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : initial,
  );

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
/** 한글이 섞인 라벨은 모노 대문자·넓은 자간 장치를 쓰면 안 된다 — 눈썹·인덱스 클래스 선택용. */
export function hasHangul(text: unknown): boolean {
  return typeof text === 'string' && /[\u3131-\u318e\uac00-\ud7a3]/.test(text);
}

export function eyebrowClass(text: unknown): string {
  return hasHangul(text) ? 'ck-eyebrow ck-eyebrow--ko' : 'ck-eyebrow';
}

export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 768px)');
}

function canCreateWebGLContext(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

/*
 * WebGL 컨텍스트를 만들 수 있는지. 첫 렌더는 false — 못 만드는 브라우저에 three 청크를 보내지 않는다.
 *
 * 한 번만 재보면 안 된다: 2026-09-12 WebContainer 프리뷰 실측에서 생성 직후 첫 마운트의 probe가 false로
 * 나와 히어로와 Showcase3D가 둘 다 정지 이미지로 굳었다(같은 페이지 콘솔에서 직접 만들면 성공했다).
 * 생성 직후는 설치·번들·이미지 업로드가 겹쳐 GPU 프로세스가 늦게 뜨는 구간이라, 실패하면 몇 번 더 본다.
 */
const WEBGL_RETRY_DELAYS_MS = [0, 400, 1500, 4000];

export function useWebGL(): boolean {
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (canCreateWebGLContext()) {
      setOk(true);
      return undefined;
    }

    let done = false;
    const timers = WEBGL_RETRY_DELAYS_MS.map((delay) =>
      window.setTimeout(() => {
        if (done) {
          return;
        }

        if (canCreateWebGLContext()) {
          done = true;
          setOk(true);
        }
      }, delay),
    );

    return () => {
      done = true;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
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

/*
 * 스크롤 잠금 — 3D 오브젝트를 드래그하는 동안 페이지가 손 밑에서 미끄러지지 않게 한다.
 *
 * 실측(2026-09-17 프로덕션 프리뷰): Showcase3D 위에서 가로로 끌면 오브젝트가 도는 대신 페이지가 다음
 * 스냅 지점(Contact)으로 넘어갔다. 드래그는 스크롤 이벤트를 만들지 않지만, 직전 스크롤의 스냅 트윈이
 * 아직 날아가는 중이면 그게 드래그 도중에 착지한다. Lenis의 관성도 같이 남는다.
 *
 * 그래서 드래그 시작에 (1) 진행 중인 스냅 트윈을 죽이고 (2) Lenis를 멈춘다. 놓으면 되돌린다.
 * 모듈 전역에 두는 이유: 킷은 페이지당 useSmoothScroll을 한 번만 부르고, Showcase3DScene은 그
 * 인스턴스를 prop으로 넘겨받지 않는다.
 */
interface ScrollController {
  lock(): void;
  unlock(): void;
}

interface ScrollLockRegistry {
  controller: ScrollController | null;
  depth: number;
}

/*
 * 상태를 모듈 스코프가 아니라 globalThis에 둔다. Showcase3D는 three 청크를 늦게 받으려고
 * Showcase3DScene을 lazy로 부르는데, 번들러가 hooks를 그 청크에도 복제해 넣으면 모듈 인스턴스가
 * 둘이 된다 — 잠금을 건 쪽과 Lenis를 쥔 쪽이 서로 다른 변수를 본다(2026-09-18 실측: 드래그 중
 * lenis-stopped 클래스가 끝내 안 붙었다).
 */
const SCROLL_LOCK_KEY = '__ckScrollLock';

function registry(): ScrollLockRegistry {
  const host = globalThis as typeof globalThis & { [SCROLL_LOCK_KEY]?: ScrollLockRegistry };

  if (!host[SCROLL_LOCK_KEY]) {
    host[SCROLL_LOCK_KEY] = { controller: null, depth: 0 };
  }

  return host[SCROLL_LOCK_KEY];
}

/** 잠금 중에는 스냅이 "지금 위치"로 스냅한다 — 즉 아무 데도 안 움직인다. */
export function isCinematicScrollLocked(): boolean {
  return registry().depth > 0;
}

export function setCinematicScrollLock(locked: boolean): void {
  const state = registry();
  state.depth = Math.max(0, state.depth + (locked ? 1 : -1));

  if (locked && state.depth === 1) {
    state.controller?.lock();
  } else if (!locked && state.depth === 0) {
    state.controller?.unlock();
  }
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

    /*
     * 레이아웃이 늦게 바뀌는 두 지점에서 트리거 위치를 다시 잰다 — 웹폰트 도착(한글 세리프는 수백 ms 늦다,
     * 헤드라인 높이가 바뀐다)과 프리로더가 걷힌 뒤. 안 재면 아래쪽 장면의 리빌·스냅 지점이 어긋난다.
     */
    const refresh = () => ScrollTrigger.refresh();
    document.fonts?.ready.then(refresh).catch(() => {});
    const readyTimer = window.setTimeout(refresh, 1600);

    let snapTrigger: ScrollTrigger | undefined;

    if (snap) {
      // 선언문은 h2에 표식이 있으므로 그 장면(부모 section)을 스냅 지점으로 쓴다.
      const scenes = Array.from(
        document.querySelectorAll<HTMLElement>('[data-ck="hero"], [data-ck="scene"], [data-ck="chapter"], [data-ck="contact"], [data-ck="statement"]'),
      ).map((el) => (el.dataset.ck === 'statement' ? (el.closest('section') ?? el) : el));
      const max = document.documentElement.scrollHeight - window.innerHeight;

      if (scenes.length > 1 && max > 0) {
        // 핀 챕터(data-ck-snap-steps=N)는 내부 단계마다 스냅 지점을 둔다 — 없으면 고정 구간 한가운데서 양끝으로 튄다.
        const points = scenes.flatMap((el) => {
          const steps = Number(el.dataset.ckSnapSteps || 1);
          const step = steps > 1 ? (el.offsetHeight - window.innerHeight) / (steps - 1) : 0;

          return Array.from({ length: steps }, (_, i) => Math.min(1, (el.offsetTop + step * i) / max));
        });
        /*
         * 방향 스냅 — 2026-09-18 모션 감사: "가장 가까운 지점" 스냅은 400px 휠(뷰포트의 44%)을 112px로 삼키고
         * 히어로로 되돌렸다(수상작 중앙값 394px). 진행 방향으로 뷰포트의 12%만 넘으면 다음 장면으로 보낸다;
         * 그보다 덜 움직였을 때만 제자리로 돌아온다(wearebrand.io 식 앞으로만 넘기는 스냅).
         */
        const sorted = [...points].sort((a, b) => a - b);
        const viewport = window.innerHeight / max;
        const nearest = (value: number) =>
          sorted.reduce((best, point) => (Math.abs(point - value) < Math.abs(best - value) ? point : best), sorted[0]);

        snapTrigger = ScrollTrigger.create({
          snap: {
            // 잠금 중이면 현재 진행도를 그대로 돌려준다 — 스냅이 일어나도 이동 거리가 0이다.
            snapTo: (value: number, self?: ScrollTrigger) => {
              if (isCinematicScrollLocked()) {
                return value;
              }

              // GSAP은 (naturalEnd, self)만 넘긴다 — 방향은 self.direction(1 아래 / -1 위).
              const direction = self?.direction ?? 0;

              const prev = [...sorted].reverse().find((p) => p <= value + 1e-6);
              const next = sorted.find((p) => p > value + 1e-6);

              if (direction && direction > 0 && prev !== undefined && next !== undefined && value - prev >= viewport * 0.12) {
                return next;
              }

              if (direction && direction < 0 && prev !== undefined && next !== undefined && next - value >= viewport * 0.12) {
                return prev;
              }

              return nearest(value);
            },
            directional: true,
            duration: { min: 0.3, max: 0.8 },
            delay: 0.05,
            ease: 'power2.out',
          },
        });
      }
    }

    /*
     * 잠금은 "위치 고정"으로 건다. lenis.stop()만으로는 부족하다 — ScrollTrigger의 스냅 트윈은 Lenis를
     * 거치지 않고 스크롤러를 직접 움직여서, 멈춘 Lenis 위로 페이지가 그대로 미끄러진다
     * (2026-09-18 실측: stop()만 걸었을 때 드래그 중 46~190px 이동).
     */
    let frozenAt: number | null = null;
    const holdPosition = () => {
      if (frozenAt !== null && Math.round(window.scrollY) !== frozenAt) {
        window.scrollTo(0, frozenAt);
      }
    };

    registry().controller = {
      lock: () => {
        frozenAt = Math.round(window.scrollY);
        lenis.stop();

        /*
         * 날아가는 중인 스냅 트윈을 죽인다. 안 죽이면 위치 고정과 트윈이 매 프레임 싸워서 드래그 내내
         * 40px 안팎으로 흔들린다(2026-09-18 실측). ScrollTrigger는 스냅 트윈을 인스턴스의 tween에 두고,
         * 버전에 따라 getTween(true)로도 준다 — 둘 다 시도한다.
         */
        const snapping = snapTrigger as (ScrollTrigger & { tween?: gsap.core.Tween }) | undefined;
        snapping?.tween?.kill();
        snapping?.getTween?.(true)?.kill();

        // 트리거 자체를 꺼서 잠금 중에 스냅이 새로 시작되지도 않게 한다.
        snapping?.disable(false, true);

        window.addEventListener('scroll', holdPosition, { passive: true });
      },
      unlock: () => {
        window.removeEventListener('scroll', holdPosition);
        frozenAt = null;
        lenis.start();
        (snapTrigger as (ScrollTrigger & { enable?: (reset?: boolean) => void }) | undefined)?.enable?.(false);
      },
    };

    if (isCinematicScrollLocked()) {
      registry().controller?.lock();
    }

    return () => {
      window.clearTimeout(readyTimer);
      window.removeEventListener('scroll', holdPosition);
      registry().controller = null;
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
