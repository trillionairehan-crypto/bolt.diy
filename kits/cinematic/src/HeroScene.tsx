import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { gsap, useIsDesktop, useReducedMotion } from './hooks';

const HeroCanvas = lazy(() => import('./HeroCanvas'));

export interface HeroSceneProps {
  image: string;
  /** 무음 루프 영상. 있으면 데스크톱에서 WebGL 대신 영상을 깐다(영상이 이미 움직이므로). */
  video?: string;
  eyebrow?: string;
  title: ReactNode;
  sub?: string;
  cta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  /** 'displace' = 노이즈 일렁임 + 그레인, 'grain' = 그레인·패럴랙스만, 'none' = 정지 이미지 */
  effect?: 'displace' | 'grain' | 'none';
  /** 이미지 밝기에 따라 0.3~0.7. 기본 0.5 */
  overlay?: number;
}

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');

    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

/**
 * 히어로 — 전면 미디어 + 거대 세리프 헤드라인. 레이어 순서: 미디어(WebGL/영상/이미지) → 그라데이션 → 텍스트.
 * 모바일·reduced-motion·WebGL 불가 = 이미지만(three 다운로드 없음).
 */
export function HeroScene({ image, video, eyebrow, title, sub, cta, secondaryCta, effect = 'displace', overlay = 0.5 }: HeroSceneProps) {
  const isDesktop = useIsDesktop();
  const reduced = useReducedMotion();
  const [webgl, setWebgl] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setWebgl(supportsWebGL());
  }, []);

  useEffect(() => {
    const root = textRef.current;

    if (!root || reduced) {
      return;
    }

    const targets = root.querySelectorAll('[data-hero-reveal]');
    const tween = gsap.fromTo(
      targets,
      { y: 56, opacity: 0 },
      { y: 0, opacity: 1, duration: 1.4, ease: 'power4.out', stagger: 0.14, delay: 0.2 },
    );

    return () => {
      tween.kill();
    };
  }, [reduced]);

  const useCanvas = isDesktop && !reduced && webgl && !video && effect !== 'none';
  const useVideo = isDesktop && Boolean(video);

  return (
    <section
      data-ck="hero"
      style={{
        position: 'relative',
        minHeight: '100svh',
        display: 'flex',
        alignItems: 'flex-end',
        overflow: 'hidden',
        isolation: 'isolate',
        // 사진 위 텍스트는 킷 팔레트와 무관하게 항상 흰색 — 코랄레드 라이트 팔레트를 상속하면 검정 세리프가 사진에 묻힌다(실측).
        color: '#fff',
      }}
    >
      <img
        src={image}
        alt=""
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }}
      />
      {useVideo ? (
        <video
          src={video}
          poster={image}
          autoPlay
          muted
          loop
          playsInline
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 1 }}
        />
      ) : null}
      {useCanvas ? (
        <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
          <Suspense fallback={null}>
            <HeroCanvas src={image} strength={effect === 'displace' ? 1 : 0} />
          </Suspense>
        </div>
      ) : null}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 2,
          background: `linear-gradient(180deg, rgba(0,0,0,${overlay * 0.5}) 0%, rgba(0,0,0,${overlay * 0.35}) 40%, rgba(0,0,0,${Math.min(0.92, overlay + 0.4)}) 100%)`,
        }}
      />
      <div
        ref={textRef}
        style={{
          position: 'relative',
          zIndex: 3,
          width: '100%',
          padding: 'var(--ck-gutter)',
          paddingBottom: 'clamp(48px, 9vh, 120px)',
          display: 'grid',
          gap: '20px',
          maxWidth: '1200px',
        }}
      >
        {eyebrow ? (
          <span className="ck-eyebrow" data-hero-reveal>
            {eyebrow}
          </span>
        ) : null}
        <h1 className="ck-display ck-display--xl" data-hero-reveal style={{ maxWidth: '14ch' }}>
          {title}
        </h1>
        {sub ? (
          <p data-hero-reveal style={{ margin: 0, maxWidth: '44ch', fontSize: 'var(--ck-body)', opacity: 0.86 }}>
            {sub}
          </p>
        ) : null}
        {cta || secondaryCta ? (
          <div data-hero-reveal style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '8px' }}>
            {cta ? (
              <a className="ck-btn" href={cta.href} data-cursor="hover">
                {cta.label}
              </a>
            ) : null}
            {secondaryCta ? (
              <a className="ck-btn ck-btn--ghost" href={secondaryCta.href} data-cursor="hover">
                {secondaryCta.label}
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          right: 'var(--ck-gutter)',
          bottom: '32px',
          zIndex: 3,
          fontFamily: 'var(--ck-font-mono)',
          fontSize: '11px',
          letterSpacing: '0.2em',
          opacity: 0.6,
        }}
      >
        SCROLL
      </div>
    </section>
  );
}
