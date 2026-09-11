import { useRef, type ReactNode } from 'react';
import { MediaStage } from './MediaStage';
import { useRevealOnScroll } from './hooks';

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
  useRevealOnScroll(root);

  const number = String(index).padStart(2, '0');

  return (
    <section
      ref={root}
      data-ck="chapter"
      style={{
        minHeight: '100svh',
        display: 'grid',
        alignItems: 'center',
        padding: 'clamp(64px, 12vh, 160px) var(--ck-gutter)',
        borderTop: '1px solid var(--ck-line)',
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
        <div style={{ direction: 'ltr', display: 'grid', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px' }} data-reveal>
            <span style={{ fontFamily: 'var(--ck-font-mono)', fontSize: '12px', opacity: 0.5 }}>{number}</span>
            {eyebrow ? <span className="ck-eyebrow">{eyebrow}</span> : null}
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
