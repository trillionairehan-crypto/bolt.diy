import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { gsap, useIsDesktop, useReducedMotion } from './hooks';

const HeroCanvas = lazy(() => import('./HeroCanvas'));

export interface HeroSceneProps {
  image: string;
  /** 무음 루프 영상. 데스크톱·WebGL이면 셰이더 텍스처로, 아니면 <video>로 깐다. */
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
 * 데스크톱·WebGL이면 사진이든 영상이든 셰이더(HeroCanvas)를 통과시킨다 — 노이즈 일렁임·그레인·비네트·마우스 패럴랙스.
 * 모바일·reduced-motion·WebGL 불가 = 이미지(또는 영상)만(three 다운로드 없음).
 */
export function HeroScene({ image, video, eyebrow, title, sub, cta, secondaryCta, effect = 'displace', overlay = 0.5 }: HeroSceneProps) {
  const isDesktop = useIsDesktop();
  const reduced = useReducedMotion();
  const [webgl, setWebgl] = useState(false);
  const [canvasFailed, setCanvasFailed] = useState(false);
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

  /*
   * 사진이 바뀌면 실패 상태를 푼다. 예약 사진은 생성 직후 아직 R2에 없다가 1~2분 뒤 올라온다 —
   * 처음 로드에서 텍스처가 404로 실패하면 canvasFailed가 그대로 굳어, 사진이 도착한 뒤에도 히어로가
   * 영영 <video>/<img> 폴백으로 남았다(2026-09-12 실측).
   */
  useEffect(() => {
    setCanvasFailed(false);
  }, [image, video]);

  const useCanvas = isDesktop && !reduced && webgl && !canvasFailed && effect !== 'none';
  const useVideo = isDesktop && Boolean(video) && !useCanvas;

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
            <HeroCanvas
              src={image}
              video={video}
              strength={effect === 'displace' ? 1 : 0}
              onError={() => setCanvasFailed(true)}
            />
          </Suspense>
        </div>
      ) : null}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 2,
          background: `linear-gradient(180deg, rgba(0,0,0,${overlay * 0.5}) 0%, rgba(0,0,0,${overlay * 0.35}) 40%, rgba(0,0,0,${Math.min(0.92, Math.max(0.72, overlay + 0.4))}) 100%)`,
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
          /*
           * 밝은 히어로 사진(하늘·역광)에서는 그라데이션만으로 흰 글자가 안 읽힌다(2026-09-12 실측:
           * 사진 스튜디오 생성물의 헤드라인이 하늘에 묻혔다). 어두운 사진에서는 티가 안 나는 정도의
           * 그림자를 글자에만 깐다 — 오버레이를 더 올리면 사진이 죽는다.
           */
          textShadow: '0 1px 28px rgba(0,0,0,0.5)',
        }}
      >
        {eyebrow ? (
          <span className="ck-eyebrow" data-hero-reveal>
            {eyebrow}
          </span>
        ) : null}
        <h1 className="ck-display ck-display--xl" data-hero-reveal style={{ maxWidth: '14ch', wordBreak: 'keep-all' }}>
          {title}
        </h1>
        {sub ? (
          <p
            data-hero-reveal
            style={{
              margin: 0,
              maxWidth: '44ch',
              fontSize: 'var(--ck-body)',
              opacity: 0.86,
              // 한글은 기본 줄바꿈이 어절 중간을 끊는다(실측: "빵을 굽 / 고 있어요").
              wordBreak: 'keep-all',
            }}
          >
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
