import { useRef, type ReactNode } from 'react';
import { MediaStage } from './MediaStage';
import { eyebrowClass, useIsDesktop, useRevealOnScroll } from './hooks';

/** 생성물이 눈썹에 번호를 이미 넣는 경우("01 · 흙을 빚는 시간") 킷 번호와 겹친다 — PinnedChapters와 같은 규칙. */
function stripLeadingIndex(eyebrow: string | undefined): string | undefined {
  return eyebrow?.replace(/^\s*\d{1,2}\s*(?:[·.\-–—/|]\s*)?/, '').trim() || undefined;
}

export interface ScrollChapterProps {
  /** 01, 02 … 챕터 번호. 순서가 곧 정보(스토리 진행)라 표시한다. */
  index: number;
  image: string;
  video?: string;
  alt?: string;
  eyebrow?: string;
  title: ReactNode;
  body?: ReactNode;
  /** 이미지 위치. 챕터마다 교대. */
  align?: 'left' | 'right';
  children?: ReactNode;
}

/**
 * 한 화면 = 한 장면. 이미지(패럴랙스) + 큰 헤드라인이 좌우 교대. 뷰포트 진입 시 텍스트가 순서대로 떠오른다.
 * 모바일에서는 세로 스택(이미지 → 텍스트).
 */
export function ScrollChapter({ index, image, video, alt, eyebrow, title, body, align = 'left', children }: ScrollChapterProps) {
  const root = useRef<HTMLElement>(null);
  const isDesktop = useIsDesktop();
  useRevealOnScroll(root);

  const number = String(index).padStart(2, '0');
  const label = stripLeadingIndex(eyebrow);

  return (
    <section
      ref={root}
      data-ck="chapter"
      style={{
        minHeight: '100svh',
        display: 'grid',
        alignItems: 'center',
        // 모바일: 사진이 화면 폭을 다 쓰고(풀블리드) 위 여백을 줄인다 — 2026-09-18 감사: 액자 사진 + 180px 공백
        padding: isDesktop ? 'clamp(64px, 12vh, 160px) var(--ck-gutter)' : '72px 0 48px',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))',
          gap: 'clamp(32px, 6vw, 96px)',
          alignItems: 'center',
          direction: align === 'right' ? 'rtl' : 'ltr',
        }}
      >
        <div style={{ direction: 'ltr' }} data-reveal>
          <MediaStage image={image} video={video} alt={alt} />
        </div>
        <div style={{ direction: 'ltr', display: 'grid', gap: '20px', padding: isDesktop ? 0 : '0 var(--ck-gutter)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }} data-reveal>
            <span style={{ fontFamily: 'var(--ck-font-mono)', fontSize: '11px', letterSpacing: '0.08em', opacity: 0.5 }}>{number}</span>
            {label ? (
              <span className={eyebrowClass(label)} style={{ fontSize: '12px' }}>
                {label}
              </span>
            ) : null}
          </div>
          <h2 className="ck-display ck-display--lg" data-reveal>
            {title}
          </h2>
          {body ? (
            <p data-reveal style={{ margin: 0, maxWidth: '46ch', color: 'var(--ck-muted)' }}>
              {body}
            </p>
          ) : null}
          {children ? <div data-reveal>{children}</div> : null}
        </div>
      </div>
    </section>
  );
}
