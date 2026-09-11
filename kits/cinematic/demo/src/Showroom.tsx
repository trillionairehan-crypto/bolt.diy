import { useState } from 'react';
import { Cursor, Nav, ScrollSequence, useSmoothScroll } from '@kit/index';
import showroom from './showroom.json';

/*
 * 쇼룸 — 딥 브리프 B1 "어떤 세계관이 마음에 드나요?"의 선택지 그 자체. 같은 가게(밀도)를 세계관 6종으로 렌더한 스틸+5초 루프를
 * 전체화면 장면으로 넘겨본다. 각 장면은 그 세계관의 서체 프리셋·테마·헤드라인 규칙을 그대로 쓴다(카드 = 실제 결과의 축소판).
 * 데이터: showroom.json (tests/media/showroom.ts 산출 + 육안 선별). 회화 세계관은 프레임이 있으면 ScrollSequence.
 */
interface WorldCard {
  id: string;
  label: string;
  reference: string;
  theme: 'light' | 'dark';
  typePreset: 'grotesk' | 'serif' | 'compact';
  still: string;
  video?: string;
  frames?: string[];
  headline: string;
  sub: string;
}

const CARDS = showroom as WorldCard[];

export default function Showroom() {
  useSmoothScroll({ snap: true });

  const [active, setActive] = useState<string | null>(null);

  return (
    <div className="ck-page">
      <Cursor />
      <Nav brand="밀도" links={[{ label: '세계관 6종', href: '#worlds' }]} />
      <header data-ck="hero" style={{ minHeight: '100svh', display: 'grid', alignContent: 'end', padding: 'var(--ck-gutter)', paddingBottom: 'clamp(48px, 9vh, 120px)', gap: '20px' }}>
        <span className="ck-eyebrow">B1 · 어떤 세계관이 마음에 드나요?</span>
        <h1 className="ck-display ck-display--xl" style={{ maxWidth: '16ch' }}>
          같은 빵집,
          <br />
          여섯 가지 세계
        </h1>
        <p style={{ maxWidth: '36em', color: 'var(--ck-muted)' }}>아래로 내리면 한 화면에 하나씩. 마음에 드는 장면에서 멈추면 그게 당신 사이트의 세계관이 됩니다. 사진·글자·색·움직임 전부 여기서 정해집니다.</p>
      </header>

      <div id="worlds">
        {CARDS.map((card) => {
          const typeClass = card.typePreset === 'serif' ? 'ck-type-serif' : card.typePreset === 'compact' ? 'ck-type-compact' : '';
          const dark = card.theme === 'dark';
          const chosen = active === card.id;
          const text = (
            <div style={{ display: 'grid', gap: '16px', maxWidth: '1100px' }}>
              <span className="ck-eyebrow" style={{ color: dark ? 'var(--ck-accent)' : '#fff' }}>
                {card.label} · {card.reference}
              </span>
              <h2 className="ck-display ck-display--xl" style={{ maxWidth: '14ch', color: '#fff' }}>
                {card.headline}
              </h2>
              <p style={{ margin: 0, maxWidth: '34em', color: 'rgba(255,255,255,0.86)' }}>{card.sub}</p>
              <div>
                <button type="button" className="ck-btn" data-cursor="hover" onClick={() => setActive(chosen ? null : card.id)} style={{ border: 0, cursor: 'pointer' }}>
                  {chosen ? '선택됨 ✓' : '이 세계관으로'}
                </button>
              </div>
            </div>
          );

          if (card.frames && card.frames.length > 8) {
            return (
              <div key={card.id} className={typeClass}>
                <ScrollSequence frames={card.frames} poster={card.still} lengthVh={250} overlay={0.35}>
                  {text}
                </ScrollSequence>
              </div>
            );
          }

          return (
            <section
              key={card.id}
              data-ck="scene"
              className={typeClass}
              style={{ position: 'relative', height: '100svh', display: 'grid', alignContent: 'end', padding: 'var(--ck-gutter)', paddingBottom: 'clamp(48px, 9vh, 120px)', overflow: 'hidden', isolation: 'isolate', outline: chosen ? '4px solid var(--ck-accent)' : 'none', outlineOffset: '-4px' }}
            >
              <img src={card.still} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: -2 }} />
              {card.video ? <video src={card.video} poster={card.still} autoPlay muted loop playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: -2 }} /> : null}
              <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: -1, background: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.62) 100%)' }} />
              {text}
            </section>
          );
        })}
      </div>
    </div>
  );
}
