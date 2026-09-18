import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { eyebrowClass, useIsDesktop, useReducedMotion, useWebGL } from './hooks';

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
  /**
   * body의 별칭. 생성물이 description으로 쓰는 경우가 잦다(2026-09-13 프로덕션 실측) — 받지 않으면 설명
   * 문장이 조용히 사라진다. body가 있으면 body가 우선.
   */
  description?: string;
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
export function Showcase3D({ id, eyebrow, title, body: bodyProp, description, specs, shape = 'jar', poster, color }: Showcase3DProps) {
  const body = bodyProp ?? description;
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

  /*
   * v0.4: 한 화면짜리 장면. 스테이지가 오른쪽 절반을 화면 끝까지 채우고(액자·둥근 모서리 없음), 제목은
   * 챕터와 같은 --lg(≈92px). 2026-09-18 감사: 40px 제목 + 액자 박스 = 제품 카드 템플릿으로 읽혔다.
   */
  return (
    <section
      id={id}
      data-ck="scene"
      style={{
        minHeight: '100svh',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 5fr) minmax(0, 7fr)',
        alignItems: 'stretch',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateRows: 'auto 1fr auto',
          gap: '24px',
          padding: 'clamp(88px, 14vh, 140px) clamp(24px, 4vw, 64px) clamp(36px, 6vh, 64px) var(--ck-gutter)',
          minWidth: 0,
        }}
      >
        <div>{eyebrow ? <span className={eyebrowClass(eyebrow)}>{eyebrow}</span> : null}</div>
        <div style={{ display: 'grid', gap: '20px', alignSelf: 'center' }}>
          <h2 className="ck-display ck-display--lg" style={{ margin: 0, maxWidth: '13ch' }}>
            {title}
          </h2>
          {body ? (
            <p style={{ margin: 0, maxWidth: '26em', fontSize: '15px', lineHeight: 1.65, color: 'var(--ck-muted)' }}>{body}</p>
          ) : null}
        </div>
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
                <dt className={eyebrowClass(spec.label)} style={{ fontSize: '11px', color: 'var(--ck-muted)' }}>
                  {spec.label}
                </dt>
                <dd style={{ margin: 0, fontSize: '15px' }}>{spec.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <div />
        )}
      </div>

      <div
        ref={stage}
        data-ck-3d={use3D ? (live ? 'live' : 'loading') : 'still'}
        data-cursor={use3D ? 'hover' : undefined}
        style={{
          position: 'relative',
          width: '100%',
          minHeight: '100svh',
          overflow: 'hidden',
          /*
           * 위가 밝고 아래가 어두운 스튜디오 배경 대신 "바닥 그림자"만 — 라이트 팔레트에서 회색 세로 그라데이션이
           * 제품 사진 기본 배경처럼 읽혔다(2026-09-18 라이트 감사). 다크에서는 같은 식이 은은한 받침이 된다.
           */
          background:
            'radial-gradient(70% 42% at 50% 90%, color-mix(in srgb, var(--ck-text) 22%, transparent) 0%, transparent 70%), linear-gradient(180deg, color-mix(in srgb, var(--ck-text) 4%, var(--ck-bg)) 0%, var(--ck-surface) 100%)',
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
            left: '24px',
            bottom: '22px',
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
