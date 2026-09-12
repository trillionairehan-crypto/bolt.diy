import { createElement, useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react';
import { gsap } from './hooks';

export interface TextRevealProps {
  /** 리빌할 문장. 생략하면 children의 문자열을 쓴다. */
  text?: string;

  /** `<TextReveal>문장</TextReveal>` 형태로 쓴 경우의 문장. */
  children?: ReactNode;
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
/*
 * 실측(2026-09-12, WebContainer 프리뷰): 생성물이 `<TextReveal>문장</TextReveal>`로 써서 text가
 * undefined가 됐고, text.split이 던진 예외가 에러 경계 없는 트리를 통째로 날려 화면이 백지가 됐다.
 * 호출부를 LLM이 쓰는 킷이므로 prop 하나가 빠져도 페이지 전체가 죽어서는 안 된다 — children을 받고,
 * 둘 다 없으면 조용히 아무것도 그리지 않는다.
 */
function textOf(text: string | undefined, children: ReactNode): string {
  if (typeof text === 'string') {
    return text;
  }

  if (typeof children === 'string') {
    return children;
  }

  if (Array.isArray(children) && children.every((child) => typeof child === 'string')) {
    return children.join('');
  }

  return '';
}

export function TextReveal({ text, children, as = 'p', className, style, mode = 'word', scrub = true, emphasize = [] }: TextRevealProps) {
  const root = useRef<HTMLElement>(null);
  const source = textOf(text, children);
  const words = useMemo(() => source.split(/\s+/).filter(Boolean), [source]);

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

  if (words.length === 0) {
    return null;
  }

  return createElement(
    as,
    { ref: root, className, style, 'aria-label': source },
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
