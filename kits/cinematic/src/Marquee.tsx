/** 마퀴 항목. 생성물이 객체로 넘기는 경우가 잦아 문자열 외 형태도 받는다(normalizeMarqueeItems 주석 참고). */
export type MarqueeItem = string | number | { label: string; emphasis?: boolean };

export interface MarqueeProps {
  items: MarqueeItem[];
  /** 강조할 항목 인덱스 — 나머지는 muted (Revelatio 도시 리스트 "London," 장치의 마퀴판) */
  emphasize?: number[];
  /** 한 바퀴 시간(초). 기본 28 */
  duration?: number;
}

/*
 * 실측(2026-09-13, coralred.kr 프로덕션 생성): 생성물이 items에 문자열이 아니라 `{ label, emphasis }`
 * 객체 배열을 넘겼고, 그걸 그대로 children으로 렌더하다 "Objects are not valid as a React child"
 * 예외가 나 페이지 전체가 백지가 됐다 — 에러 경계가 없어 App 트리째 언마운트됐다(TextReveal과 같은 사고).
 *
 * 호출부를 LLM이 쓰는 킷이므로 prop 모양이 어긋나도 페이지가 죽어서는 안 된다. 문자열·숫자·{ label }
 * 객체를 모두 받고, 렌더할 글자가 없는 항목은 조용히 버린다. 객체가 emphasis: true를 들고 있으면
 * emphasize 인덱스와 별개로 강조한다.
 */
export function normalizeMarqueeItems(items: MarqueeItem[] | undefined): Array<{ label: string; emphasis: boolean }> {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => {
      if (typeof item === 'string' || typeof item === 'number') {
        return { label: String(item), emphasis: false };
      }

      if (item && typeof item === 'object' && typeof item.label === 'string') {
        return { label: item.label, emphasis: item.emphasis === true };
      }

      return { label: '', emphasis: false };
    })
    .filter((item) => item.label.trim().length > 0);
}

/** 키워드 마퀴 — 수상작 22%. 텍스트만으로 앰비언트 모션(idle > 0.3)을 만드는 가장 싼 장치. reduced-motion이면 정지. */
export function Marquee({ items, emphasize = [], duration = 28 }: MarqueeProps) {
  const normalized = normalizeMarqueeItems(items);

  if (normalized.length === 0) {
    return null;
  }

  const row = (key: string, hidden: boolean) => (
    <span key={key} aria-hidden={hidden} style={{ display: 'inline-flex' }}>
      {normalized.map((item, i) => (
        <span
          key={i}
          className={`ck-marquee__item${item.emphasis || emphasize.includes(i) ? ' ck-marquee__item--em' : ''}`}
        >
          {item.label}
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
