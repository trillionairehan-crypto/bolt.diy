import type { Skeleton7ImageUrls } from './injectSkeleton7Images';

/*
 * 시네마틱 트랙 생성물에 예약 이미지를 끼워 넣는다.
 *
 * 기존 injectSkeleton7Images는 `data-slot="hero"` 컨테이너를 찾아 그 안에 <img>를 깐다. 시네마틱
 * 생성물에는 data-slot도 직접 쓴 <img>도 없다 — 사진은 전부 킷 컴포넌트의 prop으로 들어간다. 그래서
 * 이 트랙에서는 "컨테이너를 찾아 마크업을 넣는" 방식이 통째로 무효였고, 모델이 예약 URL을 무시하면
 * (2026-09-12 실측: Unsplash 사진 4장) 복구할 방법이 없었다.
 *
 * 여기서는 마크업이 아니라 **URL 문자열만** 바꾼다. 상수로 빼든(`const HERO = '...'`) prop에 직접 쓰든
 * 같은 방식으로 걸리고, 킷 레이아웃은 건드리지 않는다.
 *
 * 순서 규칙: 파일에 나타난 순서대로 첫 번째 외부 이미지 URL이 히어로, 그다음 셋이 챕터 1~3이다.
 * 생성물은 항상 히어로를 먼저 쓴다(장면 순서 6번이 HeroScene, 8번이 PinnedChapters).
 */

/*
 * "예약된 URL 그 자체"만 그대로 둔다. 호스트가 R2라는 것만으로는 부족하다 — 2026-09-13 프로덕션
 * 실측에서 생성물이 `https://pub-….r2.dev/hero.jpg`처럼 버킷 루트에 파일명만 붙여(`media/<jobId>/`
 * 경로가 통째로 빠진 채) 썼고, 404가 났는데도 "R2니까 정상"으로 통과해 사진 4장이 전부 깨졌다.
 */
function sameUrlIgnoringQuery(a: string, b: string): boolean {
  return a.split('?')[0] === b.split('?')[0];
}

/** 문자열 리터럴 안의 http(s) 이미지 URL. 영상(.mp4 등)은 건드리지 않는다 — 영상은 별도 경로다. */
const IMAGE_URL_REGEX = /https?:\/\/[^"'`\s)]+?\.(?:jpe?g|png|webp|avif|gif)(?:\?[^"'`\s)]*)?/gi;

/** 확장자 없이 쿼리로 포맷을 정하는 스톡 호스트(Unsplash·Pexels 등)도 이미지로 본다. */
const STOCK_IMAGE_URL_REGEX =
  /https?:\/\/(?:images\.unsplash\.com|source\.unsplash\.com|images\.pexels\.com|picsum\.photos|placehold\.co|via\.placeholder\.com|loremflickr\.com)\/[^"'`\s)]*/gi;

export interface CinematicInjectResult {
  content: string;

  /** 바뀐 URL 개수. */
  replaced: number;

  /** 교체에 실제로 쓰인 슬롯 순서. */
  slots: Array<keyof Skeleton7ImageUrls>;
}

function isReserved(url: string, reserved: string[]): boolean {
  return reserved.some((expected) => sameUrlIgnoringQuery(url, expected));
}

function collectReplaceableImageUrls(content: string, reserved: string[]): string[] {
  const found = new Set<string>();
  const ordered: string[] = [];

  for (const match of [...content.matchAll(IMAGE_URL_REGEX), ...content.matchAll(STOCK_IMAGE_URL_REGEX)]) {
    const url = match[0];

    if (isReserved(url, reserved) || found.has(url)) {
      continue;
    }

    found.add(url);
    ordered.push(url);
  }

  // matchAll을 두 번 돌렸으므로 파일에 나타난 순서로 다시 정렬한다.
  return ordered.sort((a, b) => content.indexOf(a) - content.indexOf(b));
}

/**
 * @param urls 예약된 R2 URL. hero가 없으면 아무것도 하지 않는다.
 */
export function injectCinematicImages(content: string, urls: Skeleton7ImageUrls): CinematicInjectResult {
  const order: Array<keyof Skeleton7ImageUrls> = ['hero', 'ch1', 'ch2', 'ch3'];
  const reserved = order.map((slot) => urls[slot]).filter((url): url is string => Boolean(url));
  const external = collectReplaceableImageUrls(content, reserved);

  if (external.length === 0 || !urls.hero) {
    return { content, replaced: 0, slots: [] };
  }

  let next = content;
  let replaced = 0;
  const slots: Array<keyof Skeleton7ImageUrls> = [];

  external.forEach((url, index) => {
    /*
     * 챕터가 3개보다 많거나 같은 사진을 여러 번 쓰는 생성물도 있다 — 히어로 다음부터는 ch1~ch3을
     * 돌려 쓴다. 예약 URL이 빠진 슬롯은 히어로로 대신한다(빈 src보다는 낫다).
     */
    const slot = index === 0 ? 'hero' : order[1 + ((index - 1) % 3)];
    const replacement = urls[slot] ?? urls.hero;

    if (!replacement) {
      return;
    }

    const before = next;
    next = next.split(url).join(replacement);

    if (next !== before) {
      replaced++;
      slots.push(slot);
    }
  });

  return { content: next, replaced, slots };
}
