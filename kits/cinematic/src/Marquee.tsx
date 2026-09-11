export interface MarqueeProps {
  items: string[];
  /** 강조할 항목 인덱스 — 나머지는 muted (Revelatio 도시 리스트 "London," 장치의 마퀴판) */
  emphasize?: number[];
  /** 한 바퀴 시간(초). 기본 28 */
  duration?: number;
}

/** 키워드 마퀴 — 수상작 22%. 텍스트만으로 앰비언트 모션(idle > 0.3)을 만드는 가장 싼 장치. reduced-motion이면 정지. */
export function Marquee({ items, emphasize = [], duration = 28 }: MarqueeProps) {
  const row = (key: string, hidden: boolean) => (
    <span key={key} aria-hidden={hidden} style={{ display: 'inline-flex' }}>
      {items.map((t, i) => (
        <span key={i} className={`ck-marquee__item${emphasize.includes(i) ? ' ck-marquee__item--em' : ''}`}>
          {t}
          <span className="ck-marquee__dot" aria-hidden="true">
            ·
          </span>
        </span>
      ))}
    </span>
  );

  return (
    <div className="ck-marquee" data-ck="marquee" style={{ ['--ck-marquee-duration' as string]: `${duration}s` }}>
      <div className="ck-marquee__track">
        {row('a', false)}
        {row('b', true)}
      </div>
    </div>
  );
}
