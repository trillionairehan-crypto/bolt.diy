import { useRef, type ReactNode } from 'react';
import { useIsDesktop, useRevealOnScroll } from './hooks';

export interface SceneProps {
  /** 한 장면 = 한 화면. 전면 이미지(또는 영상) + 큰 헤드라인 하나. wearebrand.io 문법. */
  image: string;
  video?: string;
  title: ReactNode;
  body?: ReactNode;
  cta?: { label: string; href: string };
  /** 텍스트 자리. 기본 왼쪽 아래. */
  place?: 'bottom-left' | 'center' | 'top-left' | 'right';
  /** 0(밝은 사진) ~ 0.7. 기본 0.35 */
  overlay?: number;
  id?: string;
}

const PLACE: Record<NonNullable<SceneProps['place']>, React.CSSProperties> = {
  'bottom-left': { alignItems: 'flex-end', justifyItems: 'start', textAlign: 'left' },
  center: { alignItems: 'center', justifyItems: 'center', textAlign: 'center' },
  'top-left': { alignItems: 'start', justifyItems: 'start', textAlign: 'left', paddingTop: 'clamp(96px, 16vh, 200px)' },
  right: { alignItems: 'center', justifyItems: 'end', textAlign: 'right' },
};

export function Scene({ image, video, title, body, cta, place = 'bottom-left', overlay = 0.35, id }: SceneProps) {
  const isDesktop = useIsDesktop();
  const root = useRef<HTMLElement>(null);
  useRevealOnScroll(root);

  return (
    <section
      ref={root}
      id={id}
      data-ck="scene"
      style={{
        position: 'relative',
        height: '100svh',
        display: 'grid',
        padding: 'var(--ck-gutter)',
        paddingBottom: 'clamp(48px, 9vh, 120px)',
        overflow: 'hidden',
        isolation: 'isolate',
        color: '#fff',
        ...PLACE[place],
      }}
    >
      <img src={image} alt="" loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: -2 }} />
      {isDesktop && video ? (
        <video src={video} poster={image} autoPlay muted loop playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: -2 }} />
      ) : null}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: -1,
          background: `linear-gradient(180deg, rgba(0,0,0,${overlay * 0.6}) 0%, rgba(0,0,0,${overlay * 0.4}) 50%, rgba(0,0,0,${Math.min(0.9, overlay + 0.35)}) 100%)`,
        }}
      />
      <div style={{ display: 'grid', gap: '20px', maxWidth: '1100px' }}>
        <h2 className="ck-display ck-display--xl" data-reveal style={{ maxWidth: '12ch' }}>
          {title}
        </h2>
        {body ? (
          <p data-reveal style={{ margin: 0, maxWidth: '40ch', opacity: 0.88, justifySelf: place === 'right' ? 'end' : 'start' }}>
            {body}
          </p>
        ) : null}
        {cta ? (
          <div data-reveal>
            <a className="ck-btn ck-btn--ghost" href={cta.href} data-cursor="hover" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.4)' }}>
              {cta.label}
            </a>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** 장면 이동 화살표 — 우하단 고정. snap 켠 페이지에서 한 장면씩 이동. */
export function SceneNav() {
  const go = (dir: 1 | -1) => {
    const scenes = Array.from(document.querySelectorAll<HTMLElement>('[data-ck="hero"], [data-ck="scene"], [data-ck="chapter"], [data-ck="contact"]'));
    const y = window.scrollY + 2;
    const index = scenes.findIndex((el, i) => {
      const next = scenes[i + 1];

      return el.offsetTop <= y && (!next || next.offsetTop > y);
    });
    const target = scenes[Math.max(0, Math.min(scenes.length - 1, index + dir))];

    if (target) {
      window.scrollTo({ top: target.offsetTop, behavior: 'smooth' });
    }
  };

  const btn: React.CSSProperties = {
    width: 44,
    height: 44,
    borderRadius: '50%',
    border: '1px solid rgba(255,255,255,0.35)',
    background: 'rgba(0,0,0,0.25)',
    color: '#fff',
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
    backdropFilter: 'blur(6px)',
  };

  return (
    <div data-ck="scene-nav" style={{ position: 'fixed', right: 'var(--ck-gutter)', bottom: '28px', zIndex: 60, display: 'flex', gap: '8px' }}>
      <button type="button" aria-label="이전 장면" onClick={() => go(-1)} style={btn} data-cursor="hover">
        ↑
      </button>
      <button type="button" aria-label="다음 장면" onClick={() => go(1)} style={btn} data-cursor="hover">
        ↓
      </button>
    </div>
  );
}
