import { useEffect, useState } from 'react';

/**
 * Shared prefers-reduced-motion subscription — previously duplicated inline in
 * PromptClarification.tsx; chat-home's focus/breathing motion (BaseChat.tsx) uses the same hook.
 */
export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);

    const handler = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    mq.addEventListener('change', handler);

    return () => mq.removeEventListener('change', handler);
  }, []);

  return reducedMotion;
}
