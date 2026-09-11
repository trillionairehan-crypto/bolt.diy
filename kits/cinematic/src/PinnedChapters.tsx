import { useEffect, useRef, type ReactNode } from 'react';
import { ScrollChapter } from './ScrollChapter';
import { MediaTreatment, type Treatment } from './MediaTreatment';
import { ScrollTrigger, useIsDesktop } from './hooks';

export interface PinnedChapter {
  image: string;
  video?: string;
  alt?: string;
  eyebrow?: string;
  title: ReactNode;
  body?: ReactNode;
  treatment?: Treatment;
}

export interface PinnedChaptersProps {
  chapters: PinnedChapter[];
  /** 첫 챕터 번호. 기본 1 */
  startIndex?: number;
  /** 미디어 위치. 기본 오른쪽 */
  media?: 'left' | 'right';
  /** 챕터 하나당 스크롤 길이(vh). 기본 100 */
  stepVh?: number;
  id?: string;
}

/**
 * 핀 고정 챕터 — 수상작 49%가 쓰는 pin+scrub 문법(The Watch·NOTA·SSTR·Lidar).
 * 한 화면이 고정된 채 스크롤 진행도에 따라 미디어가 크로스페이드되고 왼쪽 텍스트 목록의 초점이 옮겨간다.
 * 스크롤 길이 = 챕터 수 × stepVh. 모바일·reduced-motion은 일반 챕터 스택으로 폴백.
 */
export function PinnedChapters({ chapters, startIndex = 1, media = 'right', stepVh = 100, id }: PinnedChaptersProps) {
  const isDesktop = useIsDesktop();
  const root = useRef<HTMLElement>(null);
  const medias = useRef<Array<HTMLDivElement | null>>([]);
  const texts = useRef<Array<HTMLElement | null>>([]);
  const bar = useRef<HTMLDivElement>(null);
  const n = chapters.length;

  useEffect(() => {
    const el = root.current;

    if (!el || !isDesktop || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    let active = -1;

    const setActive = (i: number) => {
      if (i === active) {
        return;
      }

      active = i;
      medias.current.forEach((m, k) => m?.setAttribute('data-active', String(k === i)));
      texts.current.forEach((t, k) => t?.setAttribute('data-active', String(k % n === i)));
    };

    const trigger = ScrollTrigger.create({
      trigger: el,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => {
        const p = self.progress;
        const i = Math.min(n - 1, Math.floor(p * n));
        setActive(i);

        // 세그먼트 안에서 미디어가 1.06 → 1.0 으로 천천히 줄어드는 스크럽(정지 사진에 "살아있는" 느낌)
        const local = p * n - i;
        const m = medias.current[i];

        if (m) {
          m.style.transform = `scale(${(1.06 - local * 0.06).toFixed(4)})`;
        }

        if (bar.current) {
          bar.current.style.transform = `scaleX(${p.toFixed(4)})`;
        }
      },
    });
    setActive(0);

    return () => {
      trigger.kill();
    };
  }, [isDesktop, n]);

  if (!isDesktop) {
    return (
      <div id={id}>
        {chapters.map((c, i) => (
          <ScrollChapter key={i} index={startIndex + i} image={c.image} video={c.video} alt={c.alt} eyebrow={c.eyebrow} title={c.title} body={c.body} align={i % 2 ? 'right' : 'left'} />
        ))}
      </div>
    );
  }

  return (
    <section
      ref={root}
      id={id}
      data-ck="chapter"
      data-ck-snap-steps={n}
      style={{ position: 'relative', height: `${n * stepVh}vh`, borderTop: '1px solid var(--ck-line)' }}
    >
      <div
        style={{
          position: 'sticky',
          top: 0,
          height: '100vh',
          display: 'grid',
          gridTemplateColumns: media === 'right' ? 'minmax(0, 5fr) minmax(0, 7fr)' : 'minmax(0, 7fr) minmax(0, 5fr)',
          gap: 'clamp(32px, 5vw, 80px)',
          alignItems: 'center',
          padding: 'clamp(64px, 10vh, 120px) var(--ck-gutter)',
          overflow: 'hidden',
        }}
      >
        <div style={{ order: media === 'right' ? 0 : 1, display: 'grid', gap: '36px', alignContent: 'center' }}>
          {/* 챕터 인덱스(Lidar "Scan / Connection / Compactness") — 현재 항목만 본색 */}
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: '8px 24px' }}>
            {chapters.map((c, i) => (
              <li
                key={i}
                ref={(node) => {
                  texts.current[i] = node;
                }}
                className="ck-pin-text"
                style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}
              >
                <span style={{ fontFamily: 'var(--ck-font-mono)', fontSize: '12px' }}>{String(startIndex + i).padStart(2, '0')}</span>
                {c.eyebrow ? <span className="ck-eyebrow" style={{ color: 'inherit' }}>{c.eyebrow}</span> : null}
              </li>
            ))}
          </ol>
          {/* 헤드라인·본문은 같은 칸에 겹쳐 두고 크로스페이드 — 높이는 가장 긴 챕터가 정한다 */}
          <div style={{ display: 'grid' }}>
            {chapters.map((c, i) => (
              <div
                key={i}
                ref={(node) => {
                  texts.current[n + i] = node;
                }}
                className="ck-pin-text"
                style={{ gridArea: '1 / 1', display: 'grid', gap: '16px', alignContent: 'start' }}
              >
                <h3 className="ck-display ck-display--lg">{c.title}</h3>
                {c.body ? <p style={{ margin: 0, color: 'var(--ck-muted)', maxWidth: '28em' }}>{c.body}</p> : null}
              </div>
            ))}
          </div>
          <div aria-hidden="true" style={{ height: '1px', background: 'var(--ck-line)', position: 'relative' }}>
            <div ref={bar} style={{ position: 'absolute', inset: 0, background: 'var(--ck-accent)', transformOrigin: 'left', transform: 'scaleX(0)' }} />
          </div>
        </div>
        <div style={{ order: media === 'right' ? 1 : 0, position: 'relative', aspectRatio: '4 / 5', maxHeight: '80vh', width: '100%', justifySelf: 'center' }}>
          {chapters.map((c, i) => (
            <div
              key={i}
              ref={(node) => {
                medias.current[i] = node;
              }}
              className="ck-pin-media"
              style={{ transformOrigin: 'center', willChange: 'transform, opacity' }}
            >
              <MediaTreatment src={c.image} video={c.video} alt={c.alt} treatment={c.treatment} ratio="auto" fill />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
