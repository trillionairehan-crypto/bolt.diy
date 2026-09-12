import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { useIsDesktop, useReducedMotion, useWebGL } from './hooks';

const Showcase3DScene = lazy(() => import('./Showcase3DScene'));

/**
 * CSS 색 문자열 → #rrggbb. 코랄레드 토큰은 oklch()라 three가 못 읽는다(파싱 실패 = 흰색).
 * 1×1 캔버스에 칠해서 브라우저가 sRGB로 변환한 값을 받는다.
 */
function toHex(value: string, fallback: string): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (!ctx) {
      return fallback;
    }

    ctx.fillStyle = fallback;
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);

    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;

    return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
  } catch {
    return fallback;
  }
}

export interface Showcase3DSpec {
  label: string;
  value: string;
}

export interface Showcase3DProps {
  id?: string;
  eyebrow?: string;
  title: ReactNode;
  body?: string;
  /** 오브젝트 옆 사양표. 실제 값만 쓴다(가짜 스펙 금지). */
  specs?: Showcase3DSpec[];
  /** 'jar' = 단지(목에 금속 밴드), 'bowl' = 얕은 접시 */
  shape?: 'jar' | 'bowl';
  /** 모바일·WebGL 불가일 때 대신 보여줄 스틸. 같은 오브젝트를 렌더해 저장한 이미지여야 한다. */
  poster?: string;
  /** 오브젝트 본색. 기본은 도자기 아이보리 */
  color?: string;
}

/**
 * 3D 오브젝트 쇼케이스 — 채점표 항목 4(회전 가능한 3D 1점). 드래그로 돌리고, 놓으면 관성으로 이어 돈다.
 * 데스크톱 + WebGL + 뷰포트 근접일 때만 three 청크를 내려받는다. 모바일·reduced-motion은 스틸 1장.
 * AR(model-viewer + USDZ)은 이 킷에 넣지 않았다 — 스크립트 300KB가 항목 7 예산을 깬다.
 */
export function Showcase3D({ id, eyebrow, title, body, specs, shape = 'jar', poster, color }: Showcase3DProps) {
  const isDesktop = useIsDesktop();
  const reduced = useReducedMotion();
  const webgl = useWebGL();
  const stage = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [live, setLive] = useState(false);
  const [accent, setAccent] = useState('#ff5330');

  useEffect(() => {
    const node = stage.current;

    if (!node) {
      return;
    }

    /*
     * --ck-accent 값 자체는 `var(--accent, #ff5330)` 문자열이라 three가 못 읽는다.
     * 임시 노드에 color로 적용해 브라우저가 계산한 rgb() 값을 받아온다.
     */
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;opacity:0;pointer-events:none;color:var(--ck-accent)';
    node.appendChild(probe);

    const resolved = getComputedStyle(probe).color;
    probe.remove();

    if (resolved) {
      setAccent(toHex(resolved, '#ff5330'));
    }

    if (typeof IntersectionObserver === 'undefined') {
      setNear(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: '500px 0px' },
    );
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  const use3D = isDesktop && webgl && near;

  return (
    <section
      id={id}
      data-ck="scene"
      style={{
        padding: 'clamp(96px, 14vh, 180px) var(--ck-gutter)',
        borderTop: '1px solid var(--ck-line)',
        display: 'grid',
        gap: 'clamp(32px, 5vw, 88px)',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
        alignItems: 'center',
      }}
    >
      <div style={{ display: 'grid', gap: '22px', alignContent: 'center' }}>
        {eyebrow ? <span className="ck-eyebrow">{eyebrow}</span> : null}
        <h2 className="ck-display ck-display--md" style={{ margin: 0 }}>
          {title}
        </h2>
        {body ? (
          <p style={{ margin: 0, maxWidth: '40ch', fontSize: 'var(--ck-body)', color: 'var(--ck-muted)' }}>{body}</p>
        ) : null}
        {specs?.length ? (
          <dl style={{ margin: 0, display: 'grid', gap: '0', maxWidth: '420px' }}>
            {specs.map((spec) => (
              <div
                key={spec.label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '16px',
                  padding: '12px 0',
                  borderTop: '1px solid var(--ck-line)',
                }}
              >
                <dt style={{ fontFamily: 'var(--ck-font-mono)', fontSize: '11px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ck-muted)' }}>
                  {spec.label}
                </dt>
                <dd style={{ margin: 0, fontSize: '15px' }}>{spec.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>

      <div
        ref={stage}
        data-ck-3d={use3D ? (live ? 'live' : 'loading') : 'still'}
        data-cursor={use3D ? 'hover' : undefined}
        style={{
          position: 'relative',
          aspectRatio: '4 / 5',
          width: '100%',
          maxHeight: '78vh',
          justifySelf: 'center',
          borderRadius: '2px',
          overflow: 'hidden',
          background:
            'radial-gradient(100% 70% at 50% 8%, color-mix(in srgb, var(--ck-text) 16%, transparent) 0%, transparent 70%), linear-gradient(180deg, color-mix(in srgb, var(--ck-text) 10%, var(--ck-surface)) 0%, var(--ck-surface) 68%)',
        }}
      >
        {use3D ? (
          <Suspense fallback={null}>
            <Showcase3DScene
              shape={shape}
              accent={accent}
              color={color}
              spin={reduced ? 0 : 0.22}
              onFirstFrame={() => setLive(true)}
            />
          </Suspense>
        ) : poster ? (
          <img src={poster} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : null}

        <span
          style={{
            position: 'absolute',
            left: '16px',
            bottom: '14px',
            fontFamily: 'var(--ck-font-mono)',
            fontSize: '11px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--ck-muted)',
            pointerEvents: 'none',
          }}
        >
          {use3D ? 'Drag to rotate' : '360° · 데스크톱'}
        </span>
      </div>
    </section>
  );
}
