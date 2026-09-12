/*
 * 시네마틱 트랙 생성물의 장면 순서 게이트(2단계 2차).
 *
 * 2단계 1차 실측: 모델이 PinnedChapters 대신 구형 ScrollChapter를 골라 핀·스크럽이 없었고,
 * Preloader·Cursor·Showcase3D·Marquee를 아예 쓰지 않았다. CINEMATIC_KIT_PROMPT에 장면 순서를
 * 번호 절차로 고정했으므로, 그 순서를 지켰는지 생성물 원문에서 기계적으로 확인한다.
 *
 * 채점표(rubric.md)의 시각 항목을 대신하지 않는다 — 이건 "킷을 제대로 조립했나"만 본다.
 */

/** 순서까지 고정된 필수 컴포넌트. BigNumber는 실제 숫자가 있을 때만이라 여기 없다. */
export const CINEMATIC_SCENE_ORDER = [
  'Preloader',
  'Cursor',
  'Nav',
  'SceneNav',
  'HeroScene',
  'TextReveal',
  'PinnedChapters',
  'Showcase3D',
  'Marquee',
  'Contact',
] as const;

export interface SceneOrderResult {
  pass: boolean;
  problems: string[];

  /** 원문에 나타난 순서대로의 필수 컴포넌트 이름. */
  order: string[];
  chapterCount: number;
}

/** `<Nav`는 `<SceneNav`에도 걸리므로 여는 꺾쇠 다음이 정확히 그 이름이어야 한다. */
function firstIndexOf(source: string, component: string): number {
  return source.search(new RegExp(`<${component}(?![A-Za-z0-9_])`));
}

/*
 * chapters={[ ... ]} 안의 최상위 객체 수를 센다. 문자열 안의 중괄호는 세지 않는다 —
 * 본문 카피에 중괄호가 들어가는 경우는 없지만, 따옴표 안의 대괄호로 배열이 일찍 닫히는 오판은 막는다.
 */
function countChapters(source: string): number {
  const inline = source.search(/chapters=\{\[/);

  if (inline >= 0) {
    return countObjectsInArrayAt(source, source.indexOf('[', inline));
  }

  /*
   * 배열을 밖으로 빼는 생성물도 있다(claude-opus-5 실측: `const CHAPTERS = [...]` 뒤
   * `chapters={CHAPTERS}`). 더 나은 코드지 위반이 아니므로 선언을 찾아가서 센다.
   */
  const named = source.match(/chapters=\{([A-Za-z_$][\w$]*)\}/);

  if (!named) {
    return 0;
  }

  const declaration = source.search(new RegExp(`(const|let|var)\\s+${named[1]}\\b[^=]*=\\s*\\[`));

  return declaration < 0 ? 0 : countObjectsInArrayAt(source, source.indexOf('[', declaration));
}

/** @param open 배열을 여는 `[`의 인덱스. */
function countObjectsInArrayAt(source: string, open: number): number {
  let depth = 0;
  let count = 0;
  let quote: string | null = null;

  for (let i = open; i < source.length; i++) {
    const char = source[i];

    if (quote) {
      if (char === quote && source[i - 1] !== '\\') {
        quote = null;
      }

      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }

    if (char === '[' || char === '{') {
      depth++;

      if (char === '{' && depth === 2) {
        count++;
      }

      continue;
    }

    if (char === ']' || char === '}') {
      depth--;

      if (depth === 0) {
        break;
      }
    }
  }

  return count;
}

/*
 * 예약된 사진(R2)을 안 쓰고 모델이 외부 스톡 사진을 지어낸 생성물을 잡는다.
 *
 * 2026-09-12 실측: 프롬프트에 예약 URL 4개를 줬는데도 생성물이 Unsplash 사진만 썼다. 킷 조립은
 * 완벽했으므로 다른 검사는 전부 통과했고, 사진이 틀렸다는 걸 아무도 못 잡았다.
 */
const ALLOWED_IMAGE_HOST_REGEX = /\.r2\.dev$/;

/*
 * 이미지로 보이는 URL만 본다 — 확장자가 붙었거나 스톡 사진 호스트인 것. 지도 링크(map.kakao.com)처럼
 * 사진이 아닌 외부 URL까지 잡으면 오탐이다(실측: bakery 생성물의 카카오맵 링크).
 * injectCinematicImages.ts의 수집 규칙과 같은 모양을 유지한다.
 */
const IMAGE_URL_REGEX = /https?:\/\/[^"'`\s)]+?\.(?:jpe?g|png|webp|avif|gif)(?:\?[^"'`\s)]*)?/gi;
const STOCK_IMAGE_URL_REGEX =
  /https?:\/\/(?:images\.unsplash\.com|source\.unsplash\.com|images\.pexels\.com|picsum\.photos|placehold\.co|via\.placeholder\.com|loremflickr\.com)\/[^"'`\s)]*/gi;

function externalImageHosts(source: string): string[] {
  const hosts = new Set<string>();

  for (const match of [...source.matchAll(IMAGE_URL_REGEX), ...source.matchAll(STOCK_IMAGE_URL_REGEX)]) {
    const url = match[0];

    try {
      const { hostname } = new URL(url);

      if (!ALLOWED_IMAGE_HOST_REGEX.test(hostname)) {
        hosts.add(hostname);
      }
    } catch {
      // URL로 못 읽으면 판정하지 않는다.
    }
  }

  return [...hosts];
}

/**
 * @param source 생성물의 화면 소스 전체(킷 파일 `src/kit/**` 은 빼고 넘긴다 — 킷 내부는 이 규칙의 대상이 아니다).
 */
export function checkCinematicSceneOrder(source: string): SceneOrderResult {
  const problems: string[] = [];

  if (!/from\s+['"](\.\/kit|\.\.\/kit|~\/kit)['"]/.test(source)) {
    problems.push("킷을 import 하지 않았다 — from './kit' 없음");
  }

  const seen: Array<{ name: string; index: number }> = [];

  for (const component of CINEMATIC_SCENE_ORDER) {
    const index = firstIndexOf(source, component);

    if (index < 0) {
      problems.push(`<${component}> 없음`);
      continue;
    }

    seen.push({ name: component, index });
  }

  for (let i = 1; i < seen.length; i++) {
    if (seen[i].index < seen[i - 1].index) {
      problems.push(`순서 어긋남 — <${seen[i].name}>이 <${seen[i - 1].name}>보다 앞에 있다`);
    }
  }

  if (firstIndexOf(source, 'ScrollChapter') >= 0) {
    problems.push('<ScrollChapter>를 직접 썼다 — 챕터는 <PinnedChapters>로만 만든다');
  }

  if (/data-slot=/.test(source)) {
    problems.push('data-slot 컨테이너를 만들었다 — 골격 7 체크리스트가 킷 지시를 덮었다');
  }

  for (const tag of ['video', 'img']) {
    if (firstIndexOf(source, tag) >= 0) {
      problems.push(`<${tag}> 태그를 직접 썼다 — 미디어는 킷 컴포넌트 props로만 넘긴다`);
    }
  }

  /*
   * 실측(2026-09-12, WebContainer 프리뷰): 생성물이 `<TextReveal>문장</TextReveal>`로 써서 text가
   * undefined가 됐고, 킷이 던진 예외로 페이지가 백지가 됐다. 킷도 children을 받도록 고쳤지만,
   * 프롬프트가 지정한 형태를 벗어난 건 여기서 잡는다.
   */
  const textReveal = source.match(/<TextReveal(\s[^>]*)?>/);

  if (textReveal && !/\stext=/.test(textReveal[1] ?? '')) {
    problems.push('<TextReveal>에 text prop이 없다 — 문장을 children이 아니라 text로 넘긴다');
  }

  const foreignHosts = externalImageHosts(source);

  if (foreignHosts.length > 0) {
    problems.push(`예약된 사진 대신 외부 이미지를 썼다 — ${foreignHosts.join(', ')}`);
  }

  const chapterCount = countChapters(source);

  if (chapterCount !== 3) {
    problems.push(`PinnedChapters 챕터가 ${chapterCount}개다 — 정확히 3개여야 한다`);
  }

  return { pass: problems.length === 0, problems, order: seen.map((s) => s.name), chapterCount };
}
