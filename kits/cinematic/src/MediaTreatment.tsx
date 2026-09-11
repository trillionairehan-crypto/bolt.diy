import { type CSSProperties, type ReactNode } from 'react';
import { useIsDesktop } from './hooks';

/**
 * 사진 트리트먼트 — "사진을 고치지 말고 역할을 바꿔라".
 * 수상작이 평범한 실사를 의도된 것처럼 보이게 만드는 장치 7종. 전부 CSS/SVG라 결정론적이고 사용자 폰 사진(B등급)에 그대로 먹힌다.
 *   mono     흑백 + 대비 (Aspen·Curio Tech·MONOLOG) — 색온도·촌스러운 색 조합이 사라진다
 *   duotone  --accent 듀오톤 (Orgnzm·/zeroz) — 어떤 사진도 브랜드 색으로 통일
 *   halftone 흑백 + 망점 (Aspen·Revelatio) — 저해상도·노이즈가 질감이 된다
 *   grain    필름 그레인 + 약한 비네트 — 디지털 느낌 제거
 *   blur     블러 배경용 (HACKFIRST) — 사진은 분위기, 글자가 주인공
 *   detail   특정 지점 2.2배 확대 크롭 (The Watch·IL CAPO) — 어수선한 배경 제거, 소재감만
 *   circle   원형 마스크 (Volt·Union)
 * grade(기본 on)는 모든 프리셋에 공통으로 들어가는 약한 통일 보정(대비 +5%, 채도 -8%).
 */
export type Treatment = 'none' | 'mono' | 'duotone' | 'halftone' | 'grain' | 'blur' | 'detail' | 'circle';

export interface MediaTreatmentProps {
  src: string;
  video?: string;
  alt?: string;
  treatment?: Treatment;
  /** CSS aspect-ratio. 'auto'면 부모 크기를 따름(fill과 함께) */
  ratio?: string;
  /** 부모를 꽉 채움(position:absolute inset 0) */
  fill?: boolean;
  /** detail 크롭·object-position 초점. 기본 '50% 50%' */
  focus?: string;
  /** 공통 통일 보정. 기본 true */
  grade?: boolean;
  radius?: number;
  style?: CSSProperties;
  children?: ReactNode;
}

const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0.9 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

function filterFor(treatment: Treatment, grade: boolean): string {
  const base = grade ? 'contrast(1.05) saturate(0.92)' : '';

  switch (treatment) {
    case 'mono':
    case 'halftone':
      return `grayscale(1) contrast(1.18) ${grade ? 'brightness(1.02)' : ''}`;
    case 'duotone':
      return 'grayscale(1) contrast(1.25)';
    case 'blur':
      return `blur(18px) saturate(1.15) ${base}`;
    case 'grain':
      return `contrast(1.08) saturate(0.85) ${grade ? '' : ''}`;
    default:
      return base;
  }
}

export function MediaTreatment({ src, video, alt = '', treatment = 'none', ratio = '4 / 3', fill = false, focus = '50% 50%', grade = true, radius = 0, style, children }: MediaTreatmentProps) {
  const isDesktop = useIsDesktop();
  const mediaStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: focus,
    filter: filterFor(treatment, grade),
    transform: treatment === 'detail' ? 'scale(2.2)' : treatment === 'blur' ? 'scale(1.15)' : undefined,
    transformOrigin: focus,
    display: 'block',
  };
  const wrap: CSSProperties = {
    position: fill ? 'absolute' : 'relative',
    inset: fill ? 0 : undefined,
    aspectRatio: fill || ratio === 'auto' ? undefined : ratio,
    overflow: 'hidden',
    borderRadius: radius,
    background: 'var(--ck-surface)',
    clipPath: treatment === 'circle' ? 'circle(50% at 50% 50%)' : undefined,
    isolation: 'isolate',
    ...style,
  };

  return (
    <div style={wrap} data-treatment={treatment}>
      {isDesktop && video ? <video src={video} poster={src} autoPlay muted loop playsInline style={mediaStyle} /> : <img src={src} alt={alt} loading="lazy" style={mediaStyle} />}
      {treatment === 'duotone' ? (
        <>
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'var(--ck-accent)', mixBlendMode: 'multiply', opacity: 0.9 }} />
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'var(--ck-bg)', mixBlendMode: 'lighten', opacity: 0.35 }} />
        </>
      ) : null}
      {treatment === 'halftone' ? (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.9) 0.8px, transparent 1.25px)',
            backgroundSize: '4px 4px',
            mixBlendMode: 'multiply',
            opacity: 0.55,
          }}
        />
      ) : null}
      {treatment === 'grain' || treatment === 'mono' ? (
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, backgroundImage: GRAIN, backgroundSize: '160px 160px', mixBlendMode: 'overlay', opacity: treatment === 'grain' ? 0.42 : 0.22 }} />
      ) : null}
      {treatment === 'grain' ? <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.35) 100%)' }} /> : null}
      {children ? <div style={{ position: 'relative', zIndex: 1 }}>{children}</div> : null}
    </div>
  );
}
