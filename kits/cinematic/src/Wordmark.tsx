import { useEffect, useRef } from 'react';

export interface WordmarkProps {
  text: string;
  /** 0~1. 기본 1 = 본색. 고스트 워드마크(Lidar "aevion", Jesko "Global")는 0.06~0.12 */
  opacity?: number;
  /** 컨테이너 폭 대비 채울 비율. 기본 0.98 */
  fill?: number;
}

/**
 * 화면 폭 워드마크 — 푸터(Noho "happy modern", /zeroz, Volt) 또는 배경 고스트(Lidar).
 * 글자 수와 무관하게 컨테이너 폭에 맞춰 font-size를 계산한다. 한글 상호는 2~4자라 획이 면처럼 보일 만큼 커진다 — 의도.
 */
export function Wordmark({ text, opacity = 1, fill = 0.98 }: WordmarkProps) {
  const box = useRef<HTMLDivElement>(null);
  const word = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const b = box.current;
    const w = word.current;

    if (!b || !w) {
      return;
    }

    const fit = () => {
      w.style.fontSize = '100px';
      const ratio = (b.clientWidth * fill) / Math.max(1, w.scrollWidth);
      w.style.fontSize = `${Math.max(32, Math.floor(100 * ratio))}px`;
    };
    fit();

    const ro = new ResizeObserver(fit);
    ro.observe(b);

    if ('fonts' in document) {
      document.fonts.ready.then(fit).catch(() => {});
    }

    return () => ro.disconnect();
  }, [text, fill]);

  return (
    <div ref={box} data-ck="wordmark" aria-hidden={opacity < 0.5} style={{ width: '100%', overflow: 'hidden', lineHeight: 1, opacity }}>
      <span
        ref={word}
        className="ck-display"
        style={{ display: 'inline-block', whiteSpace: 'nowrap', letterSpacing: '-0.045em', lineHeight: 1, verticalAlign: 'top', fontFeatureSettings: '"ss01"' }}
      >
        {text}
      </span>
    </div>
  );
}
