import { useRef } from 'react';
import { useIsDesktop, useParallax } from './hooks';

export interface MediaStageProps {
  image: string;
  /** 무음 루프 영상 — 데스크톱에서만 재생, 모바일은 이미지. */
  video?: string;
  alt?: string;
  /** CSS aspect-ratio. 기본 4 / 3 */
  ratio?: string;
  /** 스크롤 패럴랙스 이동량(px). 0이면 끔 */
  parallax?: number;
  radius?: number;
}

/** 이미지/영상 프레임. 안쪽 미디어를 프레임보다 살짝 크게 두고 패럴랙스로 움직여 "살아있는 사진" 느낌. */
export function MediaStage({ image, video, alt = '', ratio = '4 / 3', parallax = 40, radius = 4 }: MediaStageProps) {
  const isDesktop = useIsDesktop();
  const inner = useRef<HTMLDivElement>(null);
  useParallax(inner, parallax);

  const mediaStyle = {
    position: 'absolute' as const,
    inset: `-${parallax}px 0`,
    width: '100%',
    height: `calc(100% + ${parallax * 2}px)`,
    objectFit: 'cover' as const,
  };

  return (
    <div
      style={{
        position: 'relative',
        aspectRatio: ratio,
        overflow: 'hidden',
        borderRadius: radius,
        background: 'var(--ck-surface)',
      }}
    >
      <div ref={inner} style={{ position: 'absolute', inset: 0 }}>
        {isDesktop && video ? (
          <video src={video} poster={image} autoPlay muted loop playsInline style={mediaStyle} />
        ) : (
          <img src={image} alt={alt} loading="lazy" style={mediaStyle} />
        )}
      </div>
    </div>
  );
}
