import { isSkeleton7File } from '~/lib/review/mechanical-checks';

/**
 * 골격 7 챕터 4개(data-slot hero/ch1/ch2/ch3)에 생성된 이미지를 코드로 주입한다 — 프롬프트로 시키지 않는
 * 이유는 mechanical-checks.ts의 골격 7 이력과 같다(슬롯 이름조차 확률적으로만 지켜졌다).
 *
 * 실측(2026-09-11, 빵집 실생성 1회): 챕터 컨테이너 뒤에 zIndex -1로 이미지를 까는 방식은 히어로·ch3처럼
 * 자식이 투명할 때만 보이고, ch1·ch2처럼 자식 래퍼가 불투명 배경(.cr-page 등)이면 가려진다. 그리고 LLM은
 * 프롬프트 규칙 4("코랄 틴트 박스 금지")를 어기고 매번 플레이스홀더 박스를 만든다. 그래서 두 층으로 간다:
 *   1) 슬롯 안에 플레이스홀더(코랄 틴트 div 또는 이름에 Placeholder·PhotoSlot이 든 컴포넌트)가 있으면 그 자리에
 *      이미지를 채운다 — 4:3 + 캡션 레이아웃이 그대로 살아난다. 히어로는 전면 배경이 더 어울리므로
 *      플레이스홀더를 투명하게 비우고 배경으로 깐다.
 *   2) 플레이스홀더가 없으면 컨테이너 배경(zIndex -1)으로 깐다.
 * 히어로의 "사진을 보내주시면" 안내 문구는 제거한다. 멱등: 같은 URL이 이미 들어 있는 슬롯은 건너뛴다.
 */

export const SKELETON7_IMAGE_SLOTS = ['hero', 'ch1', 'ch2', 'ch3'] as const;
export type Skeleton7ImageSlot = (typeof SKELETON7_IMAGE_SLOTS)[number];

export type Skeleton7ImageUrls = Partial<Record<Skeleton7ImageSlot, string>>;

export interface InjectResult {
  content: string;
  injected: Skeleton7ImageSlot[];
  missing: Skeleton7ImageSlot[];
}

const HERO_CAPTION_REGEX = /<([a-zA-Z][\w-]*)\b[^>]*>\s*사진을 보내주시면 여기에 넣어드릴게요\s*<\/\1>/g;
const CONTAINER_STYLE = "position: 'relative', isolation: 'isolate', overflow: 'hidden', color: '#fff'";
const PLACEHOLDER_COMPONENT_REGEX = /<([A-Z]\w*(?:Placeholder|PhotoSlot|ImageSlot|PhotoBox|ImageBox)\w*)\b[^>]*?\/>/;
const TINT_BOX_REGEX =
  /<div\b[^>]*?style=\{\{[^}]*?background(?:Color)?:\s*['"]var\(--accent-soft\)['"][^}]*\}\}[^>]*>/;
const ICON_REGEX = /<[A-Z]\w*\b[^>]*\bsize=\{?\d+\}?[^>]*\/>\s*/g;

function slotOpeningTagRegex(slot: Skeleton7ImageSlot): RegExp {
  return new RegExp(`<(section|div)\\b[^>]*?data-slot=["']${slot}["'][^>]*?>`, 'i');
}

function safeUrl(url: string): string {
  return url.replace(/["\\]/g, '');
}

function coverImage(url: string): string {
  return `<img src="${safeUrl(url)}" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />`;
}

function backdrop(url: string): string {
  return (
    `<img src="${safeUrl(url)}" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: -1 }} />` +
    `<div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0.58) 100%)', zIndex: -1 }} />`
  );
}

function addContainerStyle(tag: string): string {
  if (/style=\{\{/.test(tag)) {
    return tag.replace(/style=\{\{\s*/, `style={{ ${CONTAINER_STYLE}, `);
  }

  return tag.replace(/\s*\/?>$/, ` style={{ ${CONTAINER_STYLE} }}>`);
}

function addRelativeOverflow(tag: string): string {
  return tag.replace(/style=\{\{\s*/, "style={{ position: 'relative', overflow: 'hidden', ");
}

/** 슬롯의 여는 태그 뒤부터 다음 슬롯(또는 파일 끝)까지 — JSX 짝 맞추기 대신 다음 data-slot 앞까지로 근사한다. */
function slotRegionEnd(content: string, from: number): number {
  const next = content.slice(from).search(/data-slot=["'](?:hero|ch1|ch2|ch3)["']/);

  return next === -1 ? content.length : from + next;
}

interface SlotEdit {
  content: string;
  changed: boolean;
}

function fillChapterPlaceholder(region: string, url: string): SlotEdit {
  const component = region.match(PLACEHOLDER_COMPONENT_REGEX);

  if (component && component.index !== undefined) {
    const replacement = `<div style={{ position: 'relative', overflow: 'hidden', width: '100%', height: '100%', minHeight: '240px' }}>${coverImage(url)}</div>`;

    return {
      content: region.slice(0, component.index) + replacement + region.slice(component.index + component[0].length),
      changed: true,
    };
  }

  const box = region.match(TINT_BOX_REGEX);

  if (box && box.index !== undefined) {
    const tagEnd = box.index + box[0].length;

    return {
      content: region.slice(0, box.index) + addRelativeOverflow(box[0]) + coverImage(url) + region.slice(tagEnd),
      changed: true,
    };
  }

  return { content: region, changed: false };
}

/** 히어로: 플레이스홀더는 자리만 남기고 비운다(배경 이미지가 뒤에 깔린다). */
function clearHeroPlaceholder(region: string): string {
  let next = region.replace(PLACEHOLDER_COMPONENT_REGEX, '<div style={{ flex: 1 }} />');
  const box = next.match(TINT_BOX_REGEX);

  if (box && box.index !== undefined) {
    const tagEnd = box.index + box[0].length;
    const transparentTag = box[0].replace(
      /background(?:Color)?:\s*['"]var\(--accent-soft\)['"]/,
      "background: 'transparent'",
    );
    const inner = next.slice(tagEnd).replace(ICON_REGEX, '');
    next = next.slice(0, box.index) + transparentTag + inner;
  }

  return next.replace(HERO_CAPTION_REGEX, '');
}

export function injectSkeleton7Images(content: string, urls: Skeleton7ImageUrls): InjectResult {
  if (!isSkeleton7File(content)) {
    return { content, injected: [], missing: [] };
  }

  let next = content;
  const injected: Skeleton7ImageSlot[] = [];
  const missing: Skeleton7ImageSlot[] = [];

  for (const slot of SKELETON7_IMAGE_SLOTS) {
    const url = urls[slot];

    if (!url) {
      continue;
    }

    const match = next.match(slotOpeningTagRegex(slot));

    if (!match || match.index === undefined) {
      missing.push(slot);
      continue;
    }

    const tagStart = match.index;
    const tagEnd = tagStart + match[0].length;
    const regionEnd = slotRegionEnd(next, tagEnd);
    const region = next.slice(tagEnd, regionEnd);

    if (region.includes(url)) {
      continue;
    }

    let newTag = match[0];
    let newRegion = region;

    if (slot === 'hero') {
      newTag = addContainerStyle(newTag);
      newRegion = backdrop(url) + clearHeroPlaceholder(region);
    } else {
      const filled = fillChapterPlaceholder(region, url);

      if (filled.changed) {
        newRegion = filled.content;
      } else {
        newTag = addContainerStyle(newTag);
        newRegion = backdrop(url) + region;
      }
    }

    next = next.slice(0, tagStart) + newTag + newRegion + next.slice(regionEnd);
    injected.push(slot);
  }

  return { content: next, injected, missing };
}
