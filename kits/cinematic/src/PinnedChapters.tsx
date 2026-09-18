import { useEffect, useRef, type ReactNode } from 'react';
import { ScrollChapter } from './ScrollChapter';
import { MediaTreatment, type Treatment } from './MediaTreatment';
import { eyebrowClass, ScrollTrigger, useIsDesktop } from './hooks';

/** 생성물이 눈썹에 번호를 이미 넣는 경우("01 · 흙을 빚는 시간") 킷 번호와 겹쳐 "01 01"이 됐다(2026-09-18 감사). 앞 번호를 떼어낸다. */
function stripLeadingIndex(eyebrow: string | undefined): string | undefined {
  return eyebrow?.replace(/^\s*\d{1,2}\s*(?:[·.\-–—/|]\s*)?/, '').trim() || undefined;
}

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
      style={{ position: 'relative', height: `${n * stepVh}vh` }}
    >
      {/*
       * v0.4 구도: 미디어가 한쪽 절반을 화면 끝까지 채운다(풀블리드, 액자 없음). 텍스트 칸은 위 인덱스 /
       * 가운데 헤드라인(--lg ≈ 92px) / 아래 진행선의 3단. 2026-09-18 감사: 액자 사진 + 66px 제목 + 위쪽 빈
       * 공간 = "피처 섹션 템플릿"으로 읽혔다.
       */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          height: '100vh',
          display: 'grid',
          gridTemplateColumns: media === 'right' ? 'minmax(0, 5fr) minmax(0, 7fr)' : 'minmax(0, 7fr) minmax(0, 5fr)',
          alignItems: 'stretch',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            order: media === 'right' ? 0 : 1,
            display: 'grid',
            gridTemplateRows: 'auto 1fr auto',
            gap: '24px',
            padding: 'clamp(88px, 14vh, 140px) var(--ck-gutter) clamp(36px, 6vh, 64px)',
            paddingRight: media === 'right' ? 'clamp(24px, 4vw, 64px)' : 'var(--ck-gutter)',
            paddingLeft: media === 'right' ? 'var(--ck-gutter)' : 'clamp(24px, 4vw, 64px)',
            minWidth: 0,
          }}
        >
          {/* 챕터 인덱스(Lidar "Scan / Connection / Compactness") — 세로 목록, 현재 항목만 본색 */}
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '6px' }}>
            {chapters.map((c, i) => {
              const label = stripLeadingIndex(c.eyebrow);

              return (
                <li
                  key={i}
                  ref={(node) => {
                    texts.current[i] = node;
                  }}
                  className="ck-pin-text"
                  style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}
                >
                  <span style={{ fontFamily: 'var(--ck-font-mono)', fontSize: '11px', letterSpacing: '0.08em' }}>{String(startIndex + i).padStart(2, '0')}</span>
                  {label ? (
                    <span className={eyebrowClass(label)} style={{ color: 'inherit', fontSize: '12px' }}>
                      {label}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ol>
          {/* 헤드라인·본문은 같은 칸에 겹쳐 두고 크로스페이드 — 높이는 가장 긴 챕터가 정한다 */}
          <div style={{ display: 'grid', alignSelf: 'center' }}>
            {chapters.map((c, i) => (
              <div
                key={i}
                ref={(node) => {
                  texts.current[n + i] = node;
                }}
                className="ck-pin-text"
                style={{ gridArea: '1 / 1', display: 'grid', gap: '20px', alignContent: 'start' }}
              >
                <h3 className="ck-display ck-display--lg" style={{ maxWidth: '13ch' }}>
                  {c.title}
                </h3>
                {c.body ? (
                  <p style={{ margin: 0, color: 'var(--ck-muted)', maxWidth: '26em', fontSize: '15px', lineHeight: 1.65 }}>{c.body}</p>
                ) : null}
              </div>
            ))}
          </div>
          <div aria-hidden="true" style={{ height: '1px', background: 'var(--ck-line)', position: 'relative' }}>
            <div ref={bar} style={{ position: 'absolute', inset: 0, background: 'var(--ck-accent)', transformOrigin: 'left', transform: 'scaleX(0)' }} />
          </div>
        </div>
        <div style={{ order: media === 'right' ? 1 : 0, position: 'relative', height: '100vh', width: '100%', overflow: 'hidden' }}>
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
