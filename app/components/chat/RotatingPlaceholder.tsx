import { useEffect, useState } from 'react';

const EXAMPLES = [
  '예: 우리 동네 빵집 예약 앱',
  '예: 필라테스 회원 관리',
  '예: 내 포트폴리오 사이트',
  '예: 동호회 회비 정산 앱',
];

const ROTATE_INTERVAL_MS = 4000;
const FADE_MS = 200;

interface RotatingPlaceholderProps {
  visible: boolean;
  color: string;
}

/**
 * Decorative overlay shown over the landing textarea while it's empty — cycles through example
 * prompts so the empty state reads as an invitation rather than a blank box. Native `placeholder`
 * text can't be cross-faded by CSS, so this renders on top instead; the textarea itself keeps a
 * plain static placeholder/aria-label for screen readers and the no-JS case.
 */
export function RotatingPlaceholder({ visible, color }: RotatingPlaceholderProps) {
  const [index, setIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);

    const handler = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    mq.addEventListener('change', handler);

    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (reducedMotion || !visible) {
      return undefined;
    }

    const interval = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setIndex((i) => (i + 1) % EXAMPLES.length);
        setFading(false);
      }, FADE_MS);
    }, ROTATE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [reducedMotion, visible]);

  if (!visible) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: 16,
        left: 16,
        right: 64,
        pointerEvents: 'none',
        color,
        fontSize: 14,
        opacity: fading ? 0 : 1,
        transition: `opacity ${FADE_MS}ms ease`,
      }}
    >
      {EXAMPLES[index]}
    </div>
  );
}
