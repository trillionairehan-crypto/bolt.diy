import type { Page } from 'playwright';

export const CH7_SLOTS = ['hero', 'ch1', 'ch2', 'ch3'] as const;
export const HERO_CAPTION = '사진을 보내주시면 여기에 넣어드릴게요';

export interface ChapterHeadlineMeasurement {
  slot: string;
  isFallback: boolean; // 이미지(<img> 또는 non-none background-image)가 서브트리 어디에도 없음
  headlineTagFound: boolean;
  headlineText: string | null;
  computedFontSizePx: number | null;
}

/**
 * 실제 렌더된 DOM에서 골격 7의 4개 챕터를 data-slot으로 찾아, 각 챕터가 "폴백"(사진 없음)인지
 * 판정하고 폴백이면 첫 h1~h3의 getComputedStyle font-size를 측정한다. 컴포넌트 경계(PhotoSlot 같은
 * 공용 컴포넌트)를 소스 분석은 못 뚫지만 렌더된 DOM은 자연히 실제 자식 요소를 포함하므로 여기서는
 * 정확하다.
 */
export async function measureFallbackHeadlines(page: Page): Promise<ChapterHeadlineMeasurement[]> {
  return page.evaluate(
    (slots) => {
      function hasImageInSubtree(el: Element): boolean {
        if (el.querySelector('img')) {
          return true;
        }

        const all = [el, ...Array.from(el.querySelectorAll('*'))];

        return all.some((node) => {
          const bg = getComputedStyle(node as Element).backgroundImage;
          return bg && bg !== 'none';
        });
      }

      function largestFontSizeTextNode(el: Element): { text: string; px: number } | null {
        let best: { text: string; px: number } | null = null;
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        let node: Node | null = walker.nextNode();

        while (node) {
          const text = (node.textContent ?? '').trim();
          const parent = node.parentElement;

          if (text && parent) {
            const px = parseFloat(getComputedStyle(parent).fontSize);

            if (!best || px > best.px) {
              best = { text, px };
            }
          }

          node = walker.nextNode();
        }

        return best;
      }

      return slots.map((slot) => {
        const el = document.querySelector(`[data-slot="${slot}"]`);

        if (!el) {
          return { slot, isFallback: false, headlineTagFound: false, headlineText: null, computedFontSizePx: null };
        }

        const isFallback = !hasImageInSubtree(el);

        if (!isFallback) {
          return { slot, isFallback: false, headlineTagFound: false, headlineText: null, computedFontSizePx: null };
        }

        const heading = el.querySelector('h1, h2, h3');

        if (heading) {
          return {
            slot,
            isFallback: true,
            headlineTagFound: true,
            headlineText: heading.textContent,
            computedFontSizePx: parseFloat(getComputedStyle(heading).fontSize),
          };
        }

        const largest = largestFontSizeTextNode(el);

        return {
          slot,
          isFallback: true,
          headlineTagFound: false,
          headlineText: largest?.text ?? null,
          computedFontSizePx: largest?.px ?? null,
        };
      });
    },
    CH7_SLOTS as unknown as string[],
  );
}

/** 렌더된 DOM에서 안내 문구 텍스트 노드가 몇 개인지 센다(공용 컴포넌트 재사용으로 인한 중복 포함). */
export async function countCaptionTextNodes(page: Page, caption = HERO_CAPTION): Promise<number> {
  return page.evaluate((needle) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let count = 0;
    let node: Node | null = walker.nextNode();

    while (node) {
      if ((node.textContent ?? '').includes(needle)) {
        count++;
      }

      node = walker.nextNode();
    }

    return count;
  }, caption);
}
