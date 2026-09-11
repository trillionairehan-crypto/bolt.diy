import { useRef, type ReactNode } from 'react';
import { useRevealOnScroll } from './hooks';

export interface ContactRow {
  label: string;
  value: ReactNode;
}

export interface ContactProps {
  title: ReactNode;
  rows: ContactRow[];
  cta?: { label: string; href: string };
  /** 배경 이미지(선택). 아주 어둡게 깔린다. */
  image?: string;
  note?: string;
}

/** 마지막 장면 — 큰 제목 + 위치·시간·연락 표 + CTA. 지도는 없는 모듈이라 주소 텍스트 + 링크만. */
export function Contact({ title, rows, cta, image, note }: ContactProps) {
  const root = useRef<HTMLElement>(null);
  useRevealOnScroll(root);

  return (
    <section
      ref={root}
      data-ck="contact"
      style={{
        position: 'relative',
        minHeight: '100svh',
        display: 'grid',
        alignItems: 'end',
        padding: 'clamp(64px, 12vh, 160px) var(--ck-gutter) clamp(40px, 8vh, 96px)',
        overflow: 'hidden',
        isolation: 'isolate',
        // 배경 사진이 있으면 흰 글자 + 검은 그라데이션(팔레트 무관), 없으면 킷 배경 위 킷 글자색.
        color: image ? '#fff' : 'var(--ck-text)',
        background: image ? '#0f0e0d' : 'var(--ck-bg)',
      }}
    >
      {image ? (
        <>
          <img src={image} alt="" loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: -2, opacity: 0.55 }} />
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: -1, background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.45) 40%, rgba(0,0,0,0.9) 100%)' }} />
        </>
      ) : null}
      <div style={{ display: 'grid', gap: '48px', maxWidth: '1200px' }}>
        <h2 className="ck-display ck-display--xl" data-reveal>
          {title}
        </h2>
        <dl
          data-reveal
          style={{
            margin: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '24px 40px',
            borderTop: '1px solid var(--ck-line)',
            paddingTop: '24px',
          }}
        >
          {rows.map((row) => (
            <div key={row.label} style={{ display: 'grid', gap: '6px' }}>
              <dt className="ck-eyebrow">{row.label}</dt>
              <dd style={{ margin: 0, fontSize: 'var(--ck-body)' }}>{row.value}</dd>
            </div>
          ))}
        </dl>
        <div data-reveal style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
          {cta ? (
            <a className="ck-btn" href={cta.href} data-cursor="hover">
              {cta.label}
            </a>
          ) : null}
          {note ? <span style={{ color: 'var(--ck-muted)', fontSize: '14px' }}>{note}</span> : null}
        </div>
      </div>
    </section>
  );
}
