import { isSkeleton7File } from '~/lib/review/mechanical-checks';

/**
 * 골격 7 챕터 4개(data-slot hero/ch1/ch2/ch3)에 생성된 이미지를 코드로 주입한다 — 프롬프트로 시키지 않는
 * 이유는 mechanical-checks.ts의 골격 7 이력과 같다(슬롯 이름조차 확률적으로만 지켜졌다). 주입 방식은
 * 4곳 모두 동일: 챕터 컨테이너를 stacking context로 만들고(position relative + isolation), 그 첫 자식으로
 * 전면 커버 이미지와 어두운 그라데이션을 zIndex -1로 깐다. 음수 z-index는 컨테이너 배경 위, 일반 흐름
 * 자식(헤드라인·캡션) 아래에 그려지므로 기존 마크업을 재배치할 필요가 없다. 히어로의 "사진을 보내주시면"
 * 안내 문구는 이미지가 들어갔으니 제거한다.
 *
 * 멱등: 같은 URL이 이미 들어 있는 슬롯은 건너뛴다.
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

function slotOpeningTagRegex(slot: Skeleton7ImageSlot): RegExp {
  return new RegExp(`<(section|div)\\b[^>]*?data-slot=["']${slot}["'][^>]*?>`, 'i');
}

function buildBackdrop(url: string): string {
  const safeUrl = url.replace(/["\\]/g, '');

  return (
    `<img src="${safeUrl}" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: -1 }} />` +
    `<div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0.58) 100%)', zIndex: -1 }} />`
  );
}

function addContainerStyle(tag: string): string {
  if (/style=\{\{/.test(tag)) {
    return tag.replace(/style=\{\{\s*/, `style={{ ${CONTAINER_STYLE}, `);
  }

  return tag.replace(/\s*\/?>$/, ` style={{ ${CONTAINER_STYLE} }}>`);
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
    const following = next.slice(tagEnd, tagEnd + 400);

    if (following.includes(url)) {
      continue;
    }

    const newTag = addContainerStyle(match[0]);
    next = next.slice(0, tagStart) + newTag + buildBackdrop(url) + next.slice(tagEnd);
    injected.push(slot);
  }

  if (injected.includes('hero')) {
    next = next.replace(HERO_CAPTION_REGEX, '');
  }

  return { content: next, injected, missing };
}
