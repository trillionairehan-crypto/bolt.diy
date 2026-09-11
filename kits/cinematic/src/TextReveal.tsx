import { createElement, useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { gsap } from './hooks';

export interface TextRevealProps {
  text: string;
  /** 렌더 태그. 기본 p */
  as?: 'p' | 'h1' | 'h2' | 'h3' | 'div' | 'span';
  className?: string;
  style?: CSSProperties;
  /** 'word' = 어절 단위, 'char' = 글자 단위(한글은 음절). 기본 word */
  mode?: 'word' | 'char';
  /** true면 요소가 화면을 지나는 동안 스크럽(회색→본색, Orgnzm "We strive…" 식). false면 진입 시 한 번 stagger. 기본 true */
  scrub?: boolean;
  /** 강조할 어절 인덱스(0부터) — .ck-em 적용 */
  emphasize?: number[];
}

/**
 * 글자/어절 리빌 — 수상작 27%가 쓰는 Splitting/SplitType 문법을 라이브러리 없이.
 * 어절은 inline-block(nowrap)이라 한글 keep-all 줄바꿈이 유지된다.
 */
export function TextReveal({ text, as = 'p', className, style, mode = 'word', scrub = true, emphasize = [] }: TextRevealProps) {
  const root = useRef<HTMLElement>(null);
  const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text]);

  useEffect(() => {
    const el = root.current;

    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const targets = el.querySelectorAll(mode === 'char' ? '.ck-split-char' : '.ck-split-word');
    const tween = scrub
      ? gsap.fromTo(targets, { opacity: 0.16 }, { opacity: 1, ease: 'none', stagger: 0.04, scrollTrigger: { trigger: el, start: 'top 82%', end: 'bottom 45%', scrub: 0.6 } })
      : gsap.fromTo(targets, { opacity: 0, y: mode === 'char' ? '0.35em' : 18 }, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: mode === 'char' ? 0.015 : 0.05, scrollTrigger: { trigger: el, start: 'top 80%', once: true } });

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [mode, scrub, words]);

  return createElement(
    as,
    { ref: root, className, style, 'aria-label': text },
    words.map((w, i) => (
      <span key={i} aria-hidden="true">
        <span className={`ck-split-word${emphasize.includes(i) ? ' ck-em' : ''}`}>
          {mode === 'char'
            ? Array.from(w).map((ch, k) => (
                <span key={k} className="ck-split-char">
                  {ch}
                </span>
              ))
            : w}
        </span>
        {i < words.length - 1 ? ' ' : null}
      </span>
    )),
  );
}
