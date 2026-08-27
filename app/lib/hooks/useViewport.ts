import { useState, useEffect } from 'react';

/*
 * overnight5 모바일 전용 레이아웃: this hook is now called from BaseChat.tsx and Header.tsx, both
 * of which render server-side (BaseChat as ClientOnly's SSR fallback, Header on every page load) —
 * unlike its original only caller, Workbench.client.tsx, which never renders outside the browser.
 * `window` doesn't exist during SSR, so the old direct `window.innerWidth` read in the useState
 * initializer would throw there. The lazy initializer guards that; the extra handleResize() call
 * right after mount corrects the SSR-guessed `false` to the real value on the client's first paint
 * after hydration (a harmless one-time extra render, same as any other SSR-then-correct pattern).
 */
const useViewport = (threshold = 1024) => {
  const [isSmallViewport, setIsSmallViewport] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < threshold,
  );

  useEffect(() => {
    const handleResize = () => setIsSmallViewport(window.innerWidth < threshold);
    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [threshold]);

  return isSmallViewport;
};

export default useViewport;
