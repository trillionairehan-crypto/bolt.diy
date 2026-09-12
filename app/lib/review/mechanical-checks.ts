/**
 * 생성물 기계 검사(mechanical-checks) — LLM 자동 검토(reviewGeneratedApp.ts) 앞단에서 도는 확정적
 * 검사. 정규식/가벼운 토크나이저로 100% 판정 가능한 것만 다루고, 판단이 필요한 건 손대지 않고
 * finding으로만 남겨 LLM 검토에 힌트로 넘긴다(MECHANICAL_CHECKS_PLAN 승인 사항).
 *
 * 이 파일은 순수 함수만 담는다 — workbenchStore나 브라우저 API에 의존하지 않아 픽스처만으로 유닛
 * 테스트가 가능하고, 파일 쓰기 등 부수효과는 전부 호출자(reviewGeneratedApp.ts)가 맡는다.
 */

export interface MechanicalFinding {
  file: string;
  line: number;
  rule: string;
  message: string;
  autoFixed: boolean;
}

export interface MechanicalCheckOutcome {
  findings: MechanicalFinding[];
  updatedFiles: Record<string, string>;
}

function hasExtension(filePath: string, extensions: string[]): boolean {
  return extensions.some((ext) => filePath.endsWith(ext));
}

function lineNumberAt(source: string, index: number): number {
  let line = 1;

  for (let i = 0; i < index; i++) {
    if (source.charCodeAt(i) === 10) {
      line++;
    }
  }

  return line;
}

// --- 1. 이모지 ---

/*
 * Extended_Pictographic 유니코드 속성으로 대부분의 이모지를 잡는다. 이어지는 변이 선택자(FE0F)와
 * ZWJ 시퀀스(가족 이모지 등)까지 한 덩어리로 묶어서 삭제 시 잔여 코드포인트가 안 남게 한다. 국기
 * 시퀀스·키캡 시퀀스는 생성물에서 쓰일 일이 거의 없어 범위에서 뺐다(알려진 한계).
 */
const EMOJI_VARIATION_SELECTOR = String.fromCharCode(0xfe0f);
const EMOJI_ZWJ = String.fromCharCode(0x200d);
const EMOJI_REGEX = new RegExp(
  `\\p{Extended_Pictographic}(?:${EMOJI_VARIATION_SELECTOR})?(?:${EMOJI_ZWJ}\\p{Extended_Pictographic}(?:${EMOJI_VARIATION_SELECTOR})?)*`,
  'gu',
);

/*
 * 주석 안의 이모지는 검출 대상에서 제외해야 한다("주석 안은 제외"). 정규식만으로 // 를 주석 시작으로
 * 판단하면 문자열 리터럴 안의 "http://" 같은 걸 오판하므로, 문자열/템플릿 리터럴 상태를 추적하는
 * 문자 단위 상태기계로 주석 구간만 공백으로 마스킹한다. 원본과 길이를 그대로 유지해서(줄바꿈은
 * 줄바꿈으로 유지) 마스킹된 문자열의 매치 인덱스가 원본 인덱스와 1:1로 대응하게 한다. 정규식
 * 리터럴(/.../ ) 안의 // 는 구분하지 않는 것이 알려진 한계 — 생성물 코드에서 정규식 리터럴 자체가
 * 드물어 실무상 허용.
 */
function maskComments(src: string): string {
  let out = '';
  let i = 0;

  const n = src.length;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;

  while (i < n) {
    const c = src[i];
    const c2 = i + 1 < n ? src[i + 1] : '';

    if (inLineComment) {
      if (c === '\n') {
        inLineComment = false;
        out += c;
      } else {
        out += ' ';
      }

      i++;
      continue;
    }

    if (inBlockComment) {
      if (c === '*' && c2 === '/') {
        inBlockComment = false;
        out += '  ';
        i += 2;
        continue;
      }

      out += c === '\n' ? '\n' : ' ';
      i++;
      continue;
    }

    if (inSingle || inDouble || inTemplate) {
      const quote = inSingle ? "'" : inDouble ? '"' : '`';
      out += c;

      if (c === '\\') {
        out += c2;
        i += 2;
        continue;
      }

      if (c === quote) {
        inSingle = false;
        inDouble = false;
        inTemplate = false;
      }

      i++;
      continue;
    }

    if (c === '/' && c2 === '/') {
      inLineComment = true;
      out += '  ';
      i += 2;
      continue;
    }

    if (c === '/' && c2 === '*') {
      inBlockComment = true;
      out += '  ';
      i += 2;
      continue;
    }

    if (c === "'") {
      inSingle = true;
      out += c;
      i++;
      continue;
    }

    if (c === '"') {
      inDouble = true;
      out += c;
      i++;
      continue;
    }

    if (c === '`') {
      inTemplate = true;
      out += c;
      i++;
      continue;
    }

    out += c;
    i++;
  }

  return out;
}

const EMOJI_CONTEXT_WINDOW = 50;

/**
 * 이모지가 감싸는 요소/문자열의 "유일한 내용"인지 판별한다 — 유일한 내용이면 지웠을 때 자리가 완전히
 * 비어 레이아웃이 깨지므로 자동삭제 대상에서 뺀다("<span>🏎️</span>" 같은 경우). 경계(가장 가까운
 * '>' 또는 인용부호)를 못 찾으면 안전하게 "sole"로 취급한다.
 */
function classifyEmojiContext(source: string, start: number, end: number): 'inline' | 'sole' {
  const beforeWindow = source.slice(Math.max(0, start - EMOJI_CONTEXT_WINDOW), start);
  const afterWindow = source.slice(end, Math.min(source.length, end + EMOJI_CONTEXT_WINDOW));

  const lastGt = beforeWindow.lastIndexOf('>');
  const lastQuote = Math.max(
    beforeWindow.lastIndexOf('"'),
    beforeWindow.lastIndexOf("'"),
    beforeWindow.lastIndexOf('`'),
  );

  let boundaryChar: '>' | '"' | "'" | '`' | null = null;
  let boundaryOffset = -1;

  if (lastGt > lastQuote) {
    boundaryChar = '>';
    boundaryOffset = lastGt;
  } else if (lastQuote >= 0) {
    boundaryChar = beforeWindow[lastQuote] as '"' | "'" | '`';
    boundaryOffset = lastQuote;
  }

  if (boundaryChar === null) {
    return 'sole';
  }

  const closeIndex = boundaryChar === '>' ? afterWindow.indexOf('<') : afterWindow.indexOf(boundaryChar);

  if (closeIndex === -1) {
    return 'sole';
  }

  const beforeText = beforeWindow.slice(boundaryOffset + 1);
  const afterText = afterWindow.slice(0, closeIndex);
  const combinedTrimmed = (beforeText + afterText).replace(EMOJI_REGEX, '').trim();

  return combinedTrimmed.length === 0 ? 'sole' : 'inline';
}

function runEmojiCheck(filePath: string, content: string): { findings: MechanicalFinding[]; content: string } {
  if (!hasExtension(filePath, ['.tsx', '.jsx', '.ts', '.js'])) {
    return { findings: [], content };
  }

  const masked = maskComments(content);
  const matches = [...masked.matchAll(EMOJI_REGEX)];

  if (matches.length === 0) {
    return { findings: [], content };
  }

  const findings: MechanicalFinding[] = [];
  const deletions: Array<{ start: number; end: number }> = [];

  for (const match of matches) {
    const start = match.index as number;
    const end = start + match[0].length;
    const context = classifyEmojiContext(content, start, end);
    const line = lineNumberAt(content, start);

    if (context === 'sole') {
      findings.push({
        file: filePath,
        line,
        rule: 'emoji-sole-content',
        message: `이모지 "${match[0]}"가 요소·문자열의 유일한 내용입니다 — 삭제하면 자리가 빕니다. SVG나 플레이스홀더로 교체를 검토하세요.`,
        autoFixed: false,
      });
      continue;
    }

    findings.push({
      file: filePath,
      line,
      rule: 'emoji-inline',
      message: `텍스트 중간의 이모지 "${match[0]}"를 제거했습니다.`,
      autoFixed: true,
    });
    deletions.push({ start, end });
  }

  if (deletions.length === 0) {
    return { findings, content };
  }

  let nextContent = content;

  // 뒤에서부터 지워야 앞쪽 인덱스가 안 밀린다.
  for (let i = deletions.length - 1; i >= 0; i--) {
    let { start, end } = deletions[i];

    if (start > 0 && nextContent[start - 1] === ' ') {
      start -= 1;
    } else if (nextContent[end] === ' ') {
      end += 1;
    }

    nextContent = nextContent.slice(0, start) + nextContent.slice(end);
  }

  return { findings, content: nextContent };
}

// --- 2. 색상 리터럴 ---

const HEX_COLOR_REGEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g;
const RGB_FN_REGEX = /\brgba?\([^)]*\)/gi;
const HSL_FN_REGEX = /\bhsla?\([^)]*\)/gi;
const OKLCH_FN_REGEX = /\boklch\([^)]*\)/gi;

const TAILWIND_COLOR_NAMES = [
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
  'slate',
  'gray',
  'zinc',
  'neutral',
  'stone',
];
const TAILWIND_PREFIXES = [
  'bg',
  'text',
  'border',
  'ring',
  'fill',
  'stroke',
  'from',
  'via',
  'to',
  'shadow',
  'outline',
  'divide',
  'decoration',
  'caret',
  'accent',
];
const TAILWIND_COLOR_CLASS_REGEX = new RegExp(
  `\\b(?:${TAILWIND_PREFIXES.join('|')})-(?:${TAILWIND_COLOR_NAMES.join('|')})-(?:50|100|200|300|400|500|600|700|800|900|950)\\b`,
  'g',
);

function findRootBlockRanges(content: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const rootRegex = /:root\s*\{/g;
  let match: RegExpExecArray | null;

  while ((match = rootRegex.exec(content)) !== null) {
    const openIndex = match.index + match[0].length - 1;
    let depth = 1;
    let i = openIndex + 1;

    while (i < content.length && depth > 0) {
      if (content[i] === '{') {
        depth++;
      } else if (content[i] === '}') {
        depth--;
      }

      i++;
    }

    ranges.push([match.index, i]);
  }

  return ranges;
}

function isInsideRanges(index: number, ranges: Array<[number, number]>): boolean {
  return ranges.some(([s, e]) => index >= s && index < e);
}

/*
 * 실측(2026-09-07): findRootBlockRanges는 ":root {...}" 셀렉터만 찾는데, 이 킷의 실제 팔레트
 * 정의는 "*, ::before, ::after {...}"와 "[data-theme=\"dark\"] ... {...}"에 있다(coralred-ui.css
 * 실물 확인) — :root 블록만 제외하면 팔레트 변수 "정의" 자체(--ok: oklch(...) 같은)가 색상
 * 리터럴로 오인돼 var(--가장가까운값)로 치환되고, 심하면 --surface: var(--surface)처럼 자기
 * 자신을 참조해 CSS 스펙상 무효값이 된다. 셀렉터를 더 나열하는 대신 "이 색상이 커스텀 프로퍼티의
 * 값 자리에 있는가"(관용구 "--이름: <값>")를 직접 본다 — 어떤 셀렉터 아래 있든, 커스텀 프로퍼티를
 * *정의*하는 값이면 무조건 제외된다(그 값을 var()로 "쓰는" 자리와는 다르다).
 */
const CUSTOM_PROPERTY_VALUE_TAIL_REGEX = /--[\w-]+\s*:\s*$/;
const CUSTOM_PROPERTY_LOOKBEHIND_WINDOW = 100;

function isCustomPropertyValue(content: string, index: number): boolean {
  const before = content.slice(Math.max(0, index - CUSTOM_PROPERTY_LOOKBEHIND_WINDOW), index);
  return CUSTOM_PROPERTY_VALUE_TAIL_REGEX.test(before);
}

interface OklabColor {
  L: number;
  a: number;
  b: number;
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

function srgbToLinear(c: number): number {
  const cs = clamp01(c / 255);
  return cs <= 0.04045 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
}

// Björn Ottosson의 공개 OKLab 변환식(sRGB -> 선형 -> LMS -> 세제곱근 -> OKLab).
function rgbToOklab(r: number, g: number, b: number): OklabColor {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);

  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

  const lCbrt = Math.cbrt(l);
  const mCbrt = Math.cbrt(m);
  const sCbrt = Math.cbrt(s);

  return {
    L: 0.2104542553 * lCbrt + 0.793617785 * mCbrt - 0.0040720468 * sCbrt,
    a: 1.9779984951 * lCbrt - 2.428592205 * mCbrt + 0.4505937099 * sCbrt,
    b: 0.0259040371 * lCbrt + 0.7827717662 * mCbrt - 0.808675766 * sCbrt,
  };
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hue = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;

  if (hue < 60) {
    [r1, g1, b1] = [c, x, 0];
  } else if (hue < 120) {
    [r1, g1, b1] = [x, c, 0];
  } else if (hue < 180) {
    [r1, g1, b1] = [0, c, x];
  } else if (hue < 240) {
    [r1, g1, b1] = [0, x, c];
  } else if (hue < 300) {
    [r1, g1, b1] = [x, 0, c];
  } else {
    [r1, g1, b1] = [c, 0, x];
  }

  return [(r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255];
}

/**
 * hex/rgb()/hsl()/oklch() 리터럴을 OKLab 좌표로 파싱한다. oklch()는 이미 L/C/H라 rgb 왕복 변환
 * 없이 바로 a=C·cos(H), b=C·sin(H)로 변환한다 — 킷 팔레트 자체가 oklch라 이 경로가 가장 정확하다.
 */
export function parseColorLiteral(raw: string): OklabColor | null {
  const s = raw.trim();

  if (s.startsWith('#')) {
    const hex = s.slice(1);
    let r: number;
    let g: number;
    let b: number;

    if (hex.length === 3 || hex.length === 4) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6 || hex.length === 8) {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    } else {
      return null;
    }

    if ([r, g, b].some((v) => Number.isNaN(v))) {
      return null;
    }

    return rgbToOklab(r, g, b);
  }

  const rgbMatch = s.match(/^rgba?\(([^)]*)\)$/i);

  if (rgbMatch) {
    const parts = rgbMatch[1].split(/[,\s/]+/).filter(Boolean);

    if (parts.length < 3) {
      return null;
    }

    const [r, g, b] = parts.slice(0, 3).map((p) => (p.endsWith('%') ? (parseFloat(p) / 100) * 255 : parseFloat(p)));

    if ([r, g, b].some((v) => Number.isNaN(v))) {
      return null;
    }

    return rgbToOklab(r, g, b);
  }

  const hslMatch = s.match(/^hsla?\(([^)]*)\)$/i);

  if (hslMatch) {
    const parts = hslMatch[1].split(/[,\s/]+/).filter(Boolean);

    if (parts.length < 3) {
      return null;
    }

    const h = parseFloat(parts[0]);
    const sat = parseFloat(parts[1]) / 100;
    const l = parseFloat(parts[2]) / 100;

    if ([h, sat, l].some((v) => Number.isNaN(v))) {
      return null;
    }

    const [r, g, b] = hslToRgb(h, sat, l);

    return rgbToOklab(r, g, b);
  }

  const oklchMatch = s.match(/^oklch\(([^)]*)\)$/i);

  if (oklchMatch) {
    const parts = oklchMatch[1].split(/\s+/).filter(Boolean);

    if (parts.length < 3) {
      return null;
    }

    const L = parseFloat(parts[0]);
    const C = parseFloat(parts[1]);
    const H = parseFloat(parts[2]);

    if ([L, C, H].some((v) => Number.isNaN(v))) {
      return null;
    }

    const rad = (H * Math.PI) / 180;

    return { L, a: C * Math.cos(rad), b: C * Math.sin(rad) };
  }

  return null;
}

/**
 * hex/rgb/hsl/oklch 리터럴의 알파(불투명도)를 뽑는다. 4자리·8자리 hex는 마지막 성분이 항상 알파,
 * 함수형 표기는 4번째 성분(콤마·공백·슬래시 구분자 전부 지원)이 알파다. 못 찾으면 완전 불투명(1)로
 * 취급한다.
 */
function extractAlpha(raw: string): number {
  const s = raw.trim();

  if (s.startsWith('#')) {
    const hex = s.slice(1);

    if (hex.length === 4) {
      const a = parseInt(hex[3] + hex[3], 16);
      return Number.isNaN(a) ? 1 : a / 255;
    }

    if (hex.length === 8) {
      const a = parseInt(hex.slice(6, 8), 16);
      return Number.isNaN(a) ? 1 : a / 255;
    }

    return 1;
  }

  const fnMatch = s.match(/^(?:rgba?|hsla?|oklch)\(([^)]*)\)$/i);

  if (fnMatch) {
    const parts = fnMatch[1].split(/[,\s/]+/).filter(Boolean);

    if (parts.length >= 4) {
      const last = parts[3];
      const value = last.endsWith('%') ? parseFloat(last) / 100 : parseFloat(last);

      return Number.isNaN(value) ? 1 : value;
    }
  }

  return 1;
}

interface PaletteVarDef {
  name: string;
  l: number;
  c: number;
  hue: 'brand' | number;
}

/*
 * design-handoff/coralred-ui.css 라이트모드 :root 값과 그대로 동기화(2026-09-01 기준). --accent-text/
 * --on-accent는 oklch(from ...) 상대색 수식이라 정적 L/C/H가 없어 이 표에서 뺐다 — 그 둘을 최근접
 * 후보로 쓰려면 킷의 relative-color 수식을 그대로 복제해야 하는데 이 기능 하나를 위해 들일 복잡도는
 * 아니라고 판단.
 */
const PALETTE_VARS: PaletteVarDef[] = [
  { name: '--bg', l: 0.985, c: 0.002, hue: 'brand' },
  { name: '--surface', l: 1, c: 0, hue: 0 },
  { name: '--surface-2', l: 0.995, c: 0.001, hue: 'brand' },
  { name: '--border', l: 0.92, c: 0.006, hue: 'brand' },
  { name: '--border-strong', l: 0.88, c: 0.008, hue: 'brand' },
  { name: '--muted', l: 0.55, c: 0.01, hue: 'brand' },
  { name: '--text', l: 0.2, c: 0.008, hue: 'brand' },
  { name: '--accent', l: 0.69, c: 0.22, hue: 'brand' },
  { name: '--accent-hover', l: 0.64, c: 0.22, hue: 'brand' },
  { name: '--accent-soft', l: 0.97, c: 0.015, hue: 'brand' },
  { name: '--accent-ring', l: 0.9, c: 0.06, hue: 'brand' },
  { name: '--ok', l: 0.45, c: 0.12, hue: 155 },
  { name: '--ok-bg', l: 0.95, c: 0.03, hue: 155 },
  { name: '--warn', l: 0.5, c: 0.11, hue: 85 },
  { name: '--warn-bg', l: 0.95, c: 0.03, hue: 85 },
  { name: '--err', l: 0.5, c: 0.15, hue: 25 },
  { name: '--err-bg', l: 0.95, c: 0.03, hue: 25 },
];

function paletteVarToOklab(def: PaletteVarDef, resolvedHue: number): OklabColor {
  const hueDeg = def.hue === 'brand' ? resolvedHue : def.hue;
  const rad = (hueDeg * Math.PI) / 180;

  return { L: def.l, a: def.c * Math.cos(rad), b: def.c * Math.sin(rad) };
}

export function nearestPaletteVar(color: OklabColor, resolvedHue: number): string {
  let best = PALETTE_VARS[0];
  let bestDist = Infinity;

  for (const def of PALETTE_VARS) {
    const candidate = paletteVarToOklab(def, resolvedHue);
    const dist = (candidate.L - color.L) ** 2 + (candidate.a - color.a) ** 2 + (candidate.b - color.b) ** 2;

    if (dist < bestDist) {
      bestDist = dist;
      best = def;
    }
  }

  return best.name;
}

/** 생성 앱 파일들 중 아무 곳에서나 "--hue: N" 을 찾는다(보통 index.html의 body style). */
export function resolveHueFromFiles(allFiles: Record<string, string>): number | null {
  for (const content of Object.values(allFiles)) {
    const match = content.match(/--hue\s*:\s*(-?\d+(?:\.\d+)?)/);

    if (match) {
      return Number(match[1]);
    }
  }

  return null;
}

function runColorLiteralCheck(
  filePath: string,
  content: string,
  resolvedHue: number | null,
): { findings: MechanicalFinding[]; content: string } {
  if (!hasExtension(filePath, ['.tsx', '.jsx', '.ts', '.js', '.css', '.scss'])) {
    return { findings: [], content };
  }

  const findings: MechanicalFinding[] = [];
  const rootRanges = findRootBlockRanges(content);

  for (const match of content.matchAll(TAILWIND_COLOR_CLASS_REGEX)) {
    const index = match.index as number;

    if (isInsideRanges(index, rootRanges)) {
      continue;
    }

    findings.push({
      file: filePath,
      line: lineNumberAt(content, index),
      rule: 'tailwind-color-class',
      message: `Tailwind 색상 클래스 "${match[0]}"가 있습니다. 이 프로젝트는 Tailwind를 쓰지 않아 이 클래스는 동작하지 않습니다 — 제거하고 킷 변수·cr- 클래스로 교체하세요.`,
      autoFixed: false,
    });
  }

  const literalMatches: Array<{ start: number; end: number; raw: string }> = [];

  for (const regex of [HEX_COLOR_REGEX, RGB_FN_REGEX, HSL_FN_REGEX, OKLCH_FN_REGEX]) {
    for (const match of content.matchAll(regex)) {
      const index = match.index as number;

      if (isInsideRanges(index, rootRanges) || isCustomPropertyValue(content, index)) {
        continue;
      }

      literalMatches.push({ start: index, end: index + match[0].length, raw: match[0] });
    }
  }

  literalMatches.sort((a, b) => a.start - b.start);

  const replacements: Array<{ start: number; end: number; text: string }> = [];

  for (const { start, end, raw } of literalMatches) {
    const line = lineNumberAt(content, start);
    const parsed = parseColorLiteral(raw);
    const alpha = extractAlpha(raw);

    /*
     * 실측(2026-09-01, cafe 생성물): "oklch(0 0 0 / 0.12)"로 쓰인 12% 불투명도 box-shadow가
     * var(--text)(불투명 고정색)로 치환돼 그림자가 완전히 진해지는 시각 회귀가 실제로 발생했다.
     * 킷 변수는 전부 불투명이라 반투명 리터럴을 그대로 치환하면 투명도 정보가 사라진다 — 자동
     * 치환하지 않고 힌트로만 남긴다("잘못된 색으로 치환하는 것보다 안 고치는 게 낫다" 원칙 동일 적용).
     */
    if (resolvedHue === null || parsed === null || alpha < 0.999) {
      const reason =
        alpha < 0.999
          ? ' (투명도가 있어 자동 치환하지 않습니다 — 팔레트 변수는 전부 불투명입니다)'
          : resolvedHue === null
            ? ' (--hue를 찾지 못해 자동 치환은 건너뜁니다)'
            : '';
      findings.push({
        file: filePath,
        line,
        rule: 'color-literal',
        message: `색상 리터럴 "${raw}"가 팔레트 변수 대신 쓰였습니다.${reason}`,
        autoFixed: false,
      });
      continue;
    }

    const nearest = nearestPaletteVar(parsed, resolvedHue);
    findings.push({
      file: filePath,
      line,
      rule: 'color-literal',
      message: `색상 리터럴 "${raw}"를 var(${nearest})로 치환했습니다.`,
      autoFixed: true,
    });
    replacements.push({ start, end, text: `var(${nearest})` });
  }

  if (replacements.length === 0) {
    return { findings, content };
  }

  let nextContent = content;

  for (let i = replacements.length - 1; i >= 0; i--) {
    const { start, end, text } = replacements[i];
    nextContent = nextContent.slice(0, start) + text + nextContent.slice(end);
  }

  return { findings, content: nextContent };
}

// --- 3. 빈 배열 map 가드 (힌트 전용 — 휴리스틱) ---

/*
 * 실측(2026-09-01, 슈퍼카/메모보드/카페 3개 기준 프롬프트, MECHANICAL_CHECKS_VERIFY 참고): 11건 중
 * 최소 7건(64%)이 오탐으로 확인됨 — SCREAMING_SNAKE_CASE 상수 배열(TABS/REWARDS/QUICK_MENUS 등,
 * 절대 비지 않는 정적 배열)을 구분하지 못했고, 200자 lookbehind 창이 실제 삼항 가드
 * ("history.length === 0 ? <빈 상태> : history.map(...)")보다 짧아 이미 가드된 곳도 놓쳤다.
 * 승인된 규칙("오탐이 절반 이상이면 그 규칙은 끈다")에 따라 파이프라인에서 뺀다. 함수 자체와
 * 테스트는 남겨둔다 — 상수 배열 제외 + 창 확대로 재검증 후 다시 켤 수 있다.
 */
const MAP_GUARD_ENABLED = false;

const MAP_CALL_REGEX = /([A-Za-z_$][\w$]*(?:\??\.[A-Za-z_$][\w$]*)*)\.map\(/g;
const MAP_GUARD_LOOKBEHIND_WINDOW = 200;
const MAP_JSX_LOOKAHEAD_WINDOW = 400;

function runMapGuardCheck(filePath: string, content: string): MechanicalFinding[] {
  if (!hasExtension(filePath, ['.tsx', '.jsx'])) {
    return [];
  }

  const findings: MechanicalFinding[] = [];

  for (const match of content.matchAll(MAP_CALL_REGEX)) {
    const start = match.index as number;
    const base = match[1];
    const afterStart = start + match[0].length;
    const lookahead = content.slice(afterStart, afterStart + MAP_JSX_LOOKAHEAD_WINDOW);

    // JSX를 렌더하는 map이 아니면(순수 배열 변환 등) 대상이 아니다.
    if (!lookahead.includes('<')) {
      continue;
    }

    const before = content.slice(Math.max(0, start - MAP_GUARD_LOOKBEHIND_WINDOW), start);
    const escapedBase = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const guardRegex = new RegExp(`${escapedBase}\\s*(?:\\?\\.)?\\s*(?:\\.length|&&|\\?)`);

    if (guardRegex.test(before)) {
      continue;
    }

    findings.push({
      file: filePath,
      line: lineNumberAt(content, start),
      rule: 'unguarded-array-map',
      message: `"${base}.map(...)" 근처에 빈 배열 처리(length 체크·조건부 렌더)가 보이지 않습니다. 실제로 비어 있을 수 있는 배열이면 빈 상태 UI를 확인하세요.`,
      autoFixed: false,
    });
  }

  return findings;
}

// --- 5. 외부 이미지 onError 폴백 (힌트 전용) ---

const IMG_TAG_REGEX = /<img\b[^>]*?\/?>/gis;
const SRC_ATTR_REGEX = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\}|\{["']([^"']*)["']\})/i;

function runExternalImageCheck(filePath: string, content: string): MechanicalFinding[] {
  if (!hasExtension(filePath, ['.tsx', '.jsx'])) {
    return [];
  }

  const findings: MechanicalFinding[] = [];

  for (const match of content.matchAll(IMG_TAG_REGEX)) {
    const tag = match[0];
    const srcMatch = tag.match(SRC_ATTR_REGEX);

    if (!srcMatch) {
      continue;
    }

    const src = srcMatch[1] ?? srcMatch[2] ?? srcMatch[3] ?? srcMatch[4] ?? '';

    if (!/^https?:\/\//i.test(src)) {
      continue;
    }

    if (/\bonError\s*=/.test(tag)) {
      continue;
    }

    findings.push({
      file: filePath,
      line: lineNumberAt(content, match.index as number),
      rule: 'external-image-no-onerror',
      message: `외부 이미지("${src}")에 onError 폴백이 없습니다.`,
      autoFixed: false,
    });
  }

  return findings;
}

// --- 6. 외부 스톡/플레이스홀더 이미지 도메인 (힌트 전용) ---

/*
 * 실측(2026-09-02, 배달 플랫폼 생성물): 금지된 스톡 URL이 <img src="..."> 리터럴이 아니라 데이터
 * 파일의 평범한 객체 속성(`image: 'https://images.pexels.com/...'`)에 있었고, 그 파일을 그린 JSX는
 * src={r.image}처럼 동적으로 참조했다 — runExternalImageCheck의 IMG_TAG_REGEX/SRC_ATTR_REGEX는 JSX
 * <img> 태그의 리터럴 src만 보므로 이 경로를 못 잡는다. 그래서 <img> 태그 여부와 무관하게, 이 파일
 * 확장자 전체에서 알려진 도메인 문자열 자체를 찾는다 — 데이터 파일·CSS background-image·JSX 어디에
 * 있든 잡힌다. 자동 삭제하지 않는다 — 그 자리를 ImagePlaceholder로 바꾸는 건 레이아웃 판단이 필요해
 * LLM 검토에 넘긴다(이모지 sole-content와 같은 이유).
 */
const STOCK_IMAGE_DOMAINS = ['pexels.com', 'unsplash.com', 'placehold.co', 'picsum.photos'];

function runStockImageDomainCheck(filePath: string, content: string): MechanicalFinding[] {
  if (!hasExtension(filePath, ['.tsx', '.jsx', '.ts', '.js', '.css', '.scss', '.html'])) {
    return [];
  }

  const masked = maskComments(content);
  const findings: MechanicalFinding[] = [];

  for (const domain of STOCK_IMAGE_DOMAINS) {
    const regex = new RegExp(domain.replace(/\./g, '\\.'), 'gi');

    for (const match of masked.matchAll(regex)) {
      findings.push({
        file: filePath,
        line: lineNumberAt(content, match.index as number),
        rule: 'external-stock-image-domain',
        message:
          `외부 스톡/플레이스홀더 이미지 도메인("${domain}")이 발견됐습니다 — 실사진 URL 대신 ` +
          `ImagePlaceholder(코랄 틴트 플레이스홀더, <image_placeholder_rules> 참고)를 써야 합니다. ` +
          `사용자가 실제 사진을 보내면 그때 교체하세요.`,
        autoFixed: false,
      });
    }
  }

  return findings;
}

// --- 7. 8pt 그리드(padding/margin/gap px 값이 4의 배수인지, 힌트 전용) ---

/*
 * 1단계는 힌트만 남긴다 — 자동수정하지 않는다. 어떤 px 값이 실제로 자주 나오는지(6px? 10px? 14px?)
 * 실측 분포를 먼저 보고 자동수정 전환 여부를 판단하기로 했다(2026-09-03).
 *
 * 대상은 padding/margin/gap과 각 방향 변형(padding-top, margin-inline-start, row-gap 등)뿐 —
 * width/height/border/line-height/font-size/border-radius/transform/letter-spacing/
 * top·right·bottom·left(포지션 오프셋)는 명시적으로 제외한다. CSS 커스텀 속성(--card-margin: 6px
 * 같은)이 "margin"으로 오탐되지 않도록 속성명 앞에 하이픈이 오면 매치하지 않는다(negative
 * lookbehind) — 하이픈 없이 시작하는 진짜 margin/padding/gap 선언만 잡는다.
 *
 * 가로/세로 shorthand(예: padding: 8px 16px 4px)는 공백으로 나뉜 각 토큰을 독립적으로 검사한다.
 * px 단위가 아닌 값(%, rem, vh, vw, auto, calc(...))은 정규식 자체가 "숫자+px"만 매치하므로 자연히
 * 제외된다 — calc(4px + 1px) 같은 토큰도 앞뒤에 여분 문자가 붙어 있어 매치 실패로 스킵된다(알려진
 * 한계이자 의도된 동작 — calc 안의 값까지 검사하려면 별도 파서가 필요하다).
 */
/*
 * 한 정규식으로 kebab-case CSS(padding-top)와 camelCase JSX 인라인 스타일(paddingTop)을 동시에
 * 잡는다 — margin/padding/gap처럼 방향 접미사가 없는 한 단어짜리 속성은 CSS와 JS 객체 표기가 완전히
 * 같은 철자("margin")라서, 애초에 kebab용/camel용 정규식을 따로 두면 그 한 단어짜리 속성에서 둘 다
 * 매치해 같은 값을 두 번 세는 버그가 생긴다(실측: `.card{margin:6px 10px;}`가 findings 2건이 아니라
 * 4건으로 나왔다 — kebab 패스·camel 패스 각각 6px/10px를 잡았다). 값도 따옴표 유무와 무관하게
 * 한 번에 잡는다(CSS는 따옴표 없음, JSX 문자열 값은 따옴표 있음 — 둘 다 그룹 3 하나로).
 */
const SPACING_PROPERTY = String.raw`padding(?:-(?:top|right|bottom|left|inline(?:-start|-end)?|block(?:-start|-end)?)|Top|Right|Bottom|Left|Inline(?:Start|End)?|Block(?:Start|End)?)?|margin(?:-(?:top|right|bottom|left|inline(?:-start|-end)?|block(?:-start|-end)?)|Top|Right|Bottom|Left|Inline(?:Start|End)?|Block(?:Start|End)?)?|gap|row-gap|column-gap|rowGap|columnGap`;
const SPACING_DECL_REGEX = new RegExp(`(?<!-)\\b(${SPACING_PROPERTY})\\s*:\\s*(['"]?)([^'",;}\\n]+)\\2`, 'gid');

const PX_VALUE_TOKEN_REGEX = /^-?\d+(?:\.\d+)?px$/;

function nearestMultipleOf4(value: number): number {
  return Math.round(value / 4) * 4;
}

function checkSpacingValue(
  filePath: string,
  content: string,
  property: string,
  rawValue: string,
  valueStart: number,
): MechanicalFinding[] {
  const findings: MechanicalFinding[] = [];
  let cursor = valueStart;

  for (const token of rawValue.split(/(\s+)/)) {
    if (PX_VALUE_TOKEN_REGEX.test(token)) {
      const px = parseFloat(token.slice(0, -2));

      if (px % 4 !== 0) {
        findings.push({
          file: filePath,
          line: lineNumberAt(content, cursor),
          rule: 'spacing-not-4pt-grid',
          message: `${property} 값 "${token}"이 4의 배수가 아닙니다 — 가장 가까운 4의 배수는 ${nearestMultipleOf4(px)}px입니다.`,
          autoFixed: false,
        });
      }
    }

    cursor += token.length;
  }

  return findings;
}

function runSpacingGridCheck(filePath: string, content: string): MechanicalFinding[] {
  if (!hasExtension(filePath, ['.tsx', '.jsx', '.css', '.scss'])) {
    return [];
  }

  const masked = maskComments(content);
  const findings: MechanicalFinding[] = [];

  for (const match of masked.matchAll(SPACING_DECL_REGEX)) {
    const property = match[1];
    const rawValue = match[3];
    const valueStart = (match as RegExpMatchArray & { indices: RegExpIndicesArray }).indices[3][0];
    findings.push(...checkSpacingValue(filePath, content, property, rawValue, valueStart));
  }

  return findings;
}

// --- 8. 골격 7(소개·홍보형) 챕터 구조 — data-slot 명명, 폴백 헤드라인 크기, 안내 문구 중복 ---

/*
 * 실측(2026-09-03, 골격 7 3회 재생성 검증 라운드): 빵집만 data-slot을 정확히 냈고, 포트폴리오·카페는
 * 이름이 틀렸거나(임의 명명) 아예 없었다. "프롬프트만으로는 확률적으로 지켜지지 않는다"는 이 세션의
 * 반복된 교훈에 따라, 프롬프트에 절차형으로 못 박아도 이름·크기·중복은 코드로 다시 강제한다.
 *
 * 골격 7 여부는 data-slot="hero" 마커가 이미 있으면 그걸로 판정하고, 마커 자체가 통째로 빠진 최악의
 * 실패(2026-09-03 카페 재생성 사례: data-slot 전무)까지 잡으려고 "height: 100vh" 리터럴이 파일에
 * 2회 이상 있는지도 보조 신호로 쓴다 — 100vh는 프롬프트에 직접 박아둔 리터럴이라 슬롯 이름보다
 * 훨씬 잘 지켜졌다(실측 3/3 전부 정확). 헤드라인 폴백 검사(아래)는 이 마커에도 의존하지 않고
 * data-slot 챕터 자체를 구조적으로 다시 찾는다 — 클래스명 기반 감지는 라운드 2에서 폐기했다.
 */
const CH7_VH_MARKER_REGEX = /100vh/gi;
const CH7_DETECT_MIN_VH = 2;
const CH7_HERO_CAPTION = '사진을 보내주시면 여기에 넣어드릴게요';

/*
 * 시네마틱 트랙(src/kit/ 시드됨)의 화면 파일. 킷을 import 하고 <HeroScene>을 쓰면 이 트랙이다.
 *
 * 이 트랙은 data-slot도 100vh 리터럴도 쓰지 않는다 — 둘 다 킷 컴포넌트 안에 있다. 그래서 골격7 판정이
 * 그 두 신호만 보면 시네마틱 생성물을 "골격7이 아님"으로 읽고, 미리 만들어 둔 이미지 세트를 버린다
 * (2026-09-12 실측: "generated app is not skeleton 7 — discarding pre-started image set" — 이미지 4장과
 * 히어로 영상 원가는 이미 나간 뒤였고, 생성물은 모델이 지어낸 Unsplash 사진을 썼다).
 */
const CINEMATIC_KIT_IMPORT_REGEX = /from\s+['"](\.\/kit|\.\.\/kit|~\/kit)['"]/;

export function isCinematicTrackFile(content: string): boolean {
  return CINEMATIC_KIT_IMPORT_REGEX.test(content) && /<HeroScene(?![A-Za-z0-9_])/.test(content);
}

export function isSkeleton7File(content: string): boolean {
  if (content.includes('data-slot="hero"') || isCinematicTrackFile(content)) {
    return true;
  }

  const vhMatches = content.match(CH7_VH_MARKER_REGEX);

  return (vhMatches?.length ?? 0) >= CH7_DETECT_MIN_VH;
}

const CH7_CHAPTER_TAG_REGEX = /<(section|div)\b[^>]*?100vh[^>]*?>/gi;
const CH7_DATA_SLOT_ATTR_REGEX = /data-slot=(["'])([\w-]*)\1/i;
const CH7_EXPECTED_SLOTS = ['hero', 'ch1', 'ch2', 'ch3'];

/*
 * 챕터의 닫는 태그를 찾는 깊이 추적 스캐너 — 같은 태그명(section/div)이 챕터 내부에 중첩돼 있어도
 * 정확한 짝을 찾는다(단순 indexOf로 첫 "</section>"을 잡으면 중첩된 내부 section에서 일찍 끝나버린다).
 * 알려진 한계: 태그 이름이 속성값 문자열 안에("<div>" 텍스트를 표시하는 코드 등) 등장하면 오탐 가능 —
 * 생성물에서 극히 드물어 실무상 허용(파일의 다른 검사들과 동일한 타협).
 */
function findChapterSpan(
  content: string,
  openTagStart: number,
  tagName: string,
): { start: number; end: number } | null {
  const openTagEnd = content.indexOf('>', openTagStart);

  if (openTagEnd === -1) {
    return null;
  }

  const openRe = new RegExp(`<${tagName}\\b`, 'gi');
  const closeRe = new RegExp(`</${tagName}\\s*>`, 'gi');
  let depth = 1;
  let cursor = openTagEnd + 1;

  while (depth > 0 && cursor < content.length) {
    openRe.lastIndex = cursor;
    closeRe.lastIndex = cursor;

    const openMatch = openRe.exec(content);
    const closeMatch = closeRe.exec(content);

    if (!closeMatch) {
      return null;
    }

    if (openMatch && openMatch.index < closeMatch.index) {
      depth++;
      cursor = openMatch.index + openMatch[0].length;
    } else {
      depth--;
      cursor = closeMatch.index + closeMatch[0].length;

      if (depth === 0) {
        return { start: openTagStart, end: cursor };
      }
    }
  }

  return null;
}

/** 골격 7의 4개 챕터(100vh 컨테이너) 각각의 전체 span([start,end))을 반환한다. 정확히 4개가 아니거나 닫는 태그를 못 찾으면 null. */
function findSkeleton7ChapterSpans(content: string): Array<{ start: number; end: number }> | null {
  const tags = [...content.matchAll(CH7_CHAPTER_TAG_REGEX)];

  if (tags.length !== 4) {
    return null;
  }

  const spans: Array<{ start: number; end: number }> = [];

  for (const tag of tags) {
    const tagStart = tag.index as number;
    const tagName = tag[1].toLowerCase();
    const span = findChapterSpan(content, tagStart, tagName);

    if (!span) {
      return null;
    }

    spans.push(span);
  }

  return spans;
}

/**
 * 챕터 컨테이너(100vh 스타일을 가진 태그) 정확히 4개를 찾아 순서대로 data-slot을 hero/ch1/ch2/ch3로
 * 강제한다. 4개가 아니면(챕터가 빠졌거나 더 있으면) 구조 자체가 잘못된 것이라 자동수정하지 않고
 * 힌트만 남긴다 — 몇 개를 지우거나 새로 만들지는 판단이 필요하다.
 */
function runSkeleton7DataSlotCheck(
  filePath: string,
  content: string,
): { findings: MechanicalFinding[]; content: string } {
  /*
   * 시네마틱 트랙은 data-slot 컨테이너를 만들지 않는다(킷 장면 순서가 그걸 대체한다). 이 검사가 그
   * 생성물에 "컨테이너가 4개가 아니다"를 남기면 자동 검토가 모델을 다시 data-slot 쪽으로 되돌린다.
   */
  if (
    !hasExtension(filePath, ['.tsx', '.jsx', '.html']) ||
    isCinematicTrackFile(content) ||
    !isSkeleton7File(content)
  ) {
    return { findings: [], content };
  }

  const tags = [...content.matchAll(CH7_CHAPTER_TAG_REGEX)];

  if (tags.length !== 4) {
    return {
      findings: [
        {
          file: filePath,
          line: tags.length > 0 ? lineNumberAt(content, tags[0].index as number) : 1,
          rule: 'skeleton7-chapter-count',
          message: `골격 7 챕터(100vh 컨테이너)가 ${tags.length}개 감지됐습니다 — 정확히 4개(hero/ch1/ch2/ch3)여야 합니다. 자동수정하지 않았습니다.`,
          autoFixed: false,
        },
      ],
      content,
    };
  }

  const replacements: Array<{ start: number; end: number; text: string }> = [];
  let needsFix = false;

  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i][0];
    const tagStart = tags[i].index as number;
    const expected = CH7_EXPECTED_SLOTS[i];
    const existing = tag.match(CH7_DATA_SLOT_ATTR_REGEX);

    if (existing && existing[2] === expected) {
      continue;
    }

    needsFix = true;

    if (existing) {
      const attrStart = tagStart + (existing.index as number);
      const attrEnd = attrStart + existing[0].length;
      replacements.push({ start: attrStart, end: attrEnd, text: `data-slot="${expected}"` });
    } else {
      const tagNameMatch = tag.match(/^<(section|div)\b/i) as RegExpMatchArray;
      const insertAt = tagStart + tagNameMatch[0].length;
      replacements.push({ start: insertAt, end: insertAt, text: ` data-slot="${expected}"` });
    }
  }

  if (!needsFix) {
    return { findings: [], content };
  }

  replacements.sort((a, b) => b.start - a.start);

  let nextContent = content;

  for (const { start, end, text } of replacements) {
    nextContent = nextContent.slice(0, start) + text + nextContent.slice(end);
  }

  return {
    findings: [
      {
        file: filePath,
        line: lineNumberAt(content, tags[0].index as number),
        rule: 'skeleton7-data-slot',
        message: '골격 7 챕터 4개의 data-slot을 순서대로 hero/ch1/ch2/ch3로 재명명했습니다.',
        autoFixed: true,
      },
    ],
    content: nextContent,
  };
}

const CH7_FALLBACK_HEADLINE_MIN_PX = 56;
const CH7_IMG_OR_BG_REGEX = /<img\b|background-image\s*:|backgroundImage\s*:/i;
const CH7_HEADING_TAG_REGEX = /<(h1|h2|h3)\b[^>]*>/i;
const CH7_STYLE_OBJECT_REGEX = /style=\{\{([^}]*)\}\}/;
const CH7_STYLE_STRING_REGEX = /style=(["'])([^"']*)\1/;
const CH7_KEBAB_FONT_SIZE_REGEX = /font-size:\s*([\d.]+)px/i;
const CH7_CAMEL_FONT_SIZE_REGEX = /fontSize:\s*['"]?([\d.]+)(?:px)?['"]?/i;

/**
 * 태그 텍스트(예: 헤드라인 태그의 여는 부분)에서 font-size를 찾아 56px 미만이면 56px로 올리고,
 * 아예 없으면 새로 넣는다. style={{...}} 객체(camelCase)와 style="..." 문자열(kebab-case) 둘 다
 * 지원, 어느 쪽도 없으면 태그 이름 바로 뒤에 새 style 속성을 삽입한다.
 */
function fixHeadlineTagFontSize(tagText: string): { tagText: string; changed: boolean } {
  const objMatch = tagText.match(CH7_STYLE_OBJECT_REGEX);

  if (objMatch) {
    const inner = objMatch[1];
    const sizeMatch = inner.match(CH7_CAMEL_FONT_SIZE_REGEX);

    if (sizeMatch) {
      const px = parseFloat(sizeMatch[1]);

      if (px >= CH7_FALLBACK_HEADLINE_MIN_PX) {
        return { tagText, changed: false };
      }

      const fixedInner = inner.replace(sizeMatch[1], String(CH7_FALLBACK_HEADLINE_MIN_PX));

      return { tagText: tagText.replace(objMatch[0], `style={{${fixedInner}}}`), changed: true };
    }

    const fixedInner = `fontSize: '${CH7_FALLBACK_HEADLINE_MIN_PX}px', ${inner}`;

    return { tagText: tagText.replace(objMatch[0], `style={{${fixedInner}}}`), changed: true };
  }

  const strMatch = tagText.match(CH7_STYLE_STRING_REGEX);

  if (strMatch) {
    const quote = strMatch[1];
    const inner = strMatch[2];
    const sizeMatch = inner.match(CH7_KEBAB_FONT_SIZE_REGEX);

    if (sizeMatch) {
      const px = parseFloat(sizeMatch[1]);

      if (px >= CH7_FALLBACK_HEADLINE_MIN_PX) {
        return { tagText, changed: false };
      }

      const fixedInner = inner.replace(sizeMatch[1], String(CH7_FALLBACK_HEADLINE_MIN_PX));

      return { tagText: tagText.replace(strMatch[0], `style=${quote}${fixedInner}${quote}`), changed: true };
    }

    const fixedInner = `font-size:${CH7_FALLBACK_HEADLINE_MIN_PX}px;${inner}`;

    return { tagText: tagText.replace(strMatch[0], `style=${quote}${fixedInner}${quote}`), changed: true };
  }

  const tagNameMatch = tagText.match(/^<(h1|h2|h3)\b/i) as RegExpMatchArray;
  const insertAt = tagNameMatch[0].length;
  const newTagText =
    tagText.slice(0, insertAt) + ` style={{ fontSize: '${CH7_FALLBACK_HEADLINE_MIN_PX}px' }}` + tagText.slice(insertAt);

  return { tagText: newTagText, changed: true };
}

/*
 * 실측(2026-09-03, 재검증 라운드 2): 클래스명(cr-ch-fallback-headline)에 의존한 이전 구현은 LLM이
 * 그 클래스를 안 쓰면(3케이스 중 2케이스에서 발생) 걸 훅이 아예 없어 손을 못 댔다. 클래스명은 무엇이든
 * 상관없게, 구조로만 폴백 헤드라인을 찾는다: 이미지가 없는(<img>도 background-image도 없는) 챕터를
 * "폴백 챕터"로 보고, 그 안의 첫 h1~h3 태그(없으면 가장 큰 인라인 font-size를 가진 요소)를 헤드라인으로
 * 판정해 56px를 강제한다. 헤드라인 태그도, font-size 선언도 전혀 없으면 안전하게 손대지 않고 힌트만
 * 남긴다(어느 요소가 "헤드라인"인지 구조적으로 확정할 수 없다).
 *
 * 모바일 40px(스펙 요구사항)은 인라인 style로는 표현할 수 없다 — 인라인 스타일은 미디어쿼리보다 항상
 * 우선하므로, 인라인으로 56px를 강제하면서 동시에 별도 CSS 미디어쿼리로 40px를 얹어도 인라인이 그걸
 * 덮어써 무의미해진다. 데스크톱 56px 강제만 기계 검사로 다루고, 모바일 축소는 프롬프트 지시에 맡긴다
 * (알려진 한계 — 검증 게이팅 4항목에 모바일 크기는 포함되지 않는다).
 *
 * TODO(백로그 1, 2026-09-04): 이 검사는 tsx 소스 문자열에서 정규식으로 찾은 챕터 span·태그의 font-size
 * "리터럴"만 본다 — 부모 요소의 CSS나 클래스가 실제 렌더 크기를 덮어써도 소스 값만 고치면 통과로
 * 잘못 판정할 수 있다. 근본 해결은 실제 렌더된 DOM(getComputedStyle)을 보는 방식으로 전환하는 것.
 * 재현 픽스처: tests/fixtures/generated/{bakery,portfolio}.json — 둘 다 지금 검사로는 이미 56px라
 * 통과하지만, "소스에 적힌 값 = 실제 렌더 값"이라는 전제 자체를 검증하지는 못한다.
 *
 * TODO(백로그 3, 2026-09-09, 결정: 정적 검사 추가 금지): 실생성 검증(개인 포트폴리오, tests/skeleton7-dom)
 * 에서 재현 — 헤드라인이 챕터 span 밖(같은 파일 안의 하위 컴포넌트 정의부, 호출부만 span 안)에 있으면
 * 이 함수는 그 태그 자체를 못 봐서 unresolved로 넘어가고, 실제 렌더는 CSS 클래스에만 의존해 56px
 * 미달로 나온다(캡션 쪽도 대칭 사각지대 — 아래 runSkeleton7SharedCaptionCheck 주석 참고). 소스
 * 문자열 기반 정적 검사로 컴포넌트 트리를 더 따라가는 정규식을 추가하는 방향은 막다른 길로 판단해
 * 중단 — 이 라인의 정적 검사 확장은 더 하지 않는다. 근본 해결은 골격 7 검증 자체를 여기(자동수정
 * 파이프라인)가 아니라 시각 검토 단계(LLM 비전 검토 등 실제 렌더 DOM을 보는 단계)로 옮기는 것 —
 * 별도 작업.
 */
function runSkeleton7FallbackHeadlineCheck(
  filePath: string,
  content: string,
): { findings: MechanicalFinding[]; content: string } {
  if (!hasExtension(filePath, ['.tsx', '.jsx', '.html'])) {
    return { findings: [], content };
  }

  const chapterSpans = findSkeleton7ChapterSpans(content);

  if (!chapterSpans) {
    return { findings: [], content };
  }

  const findings: MechanicalFinding[] = [];
  const replacements: Array<{ start: number; end: number; text: string }> = [];

  for (const { start, end } of chapterSpans) {
    const chapterText = content.slice(start, end);

    if (CH7_IMG_OR_BG_REGEX.test(chapterText)) {
      continue; // 사진이 있는 챕터 — 이 규칙 대상이 아니다.
    }

    const headingMatch = chapterText.match(CH7_HEADING_TAG_REGEX);

    if (headingMatch) {
      const { tagText, changed } = fixHeadlineTagFontSize(headingMatch[0]);

      if (!changed) {
        continue;
      }

      const tagStart = start + (headingMatch.index as number);
      replacements.push({ start: tagStart, end: tagStart + headingMatch[0].length, text: tagText });
      findings.push({
        file: filePath,
        line: lineNumberAt(content, tagStart),
        rule: 'skeleton7-fallback-headline-size',
        message: '골격 7 폴백 챕터의 헤드라인 태그 font-size를 56px로 자동수정했습니다.',
        autoFixed: true,
      });
      continue;
    }

    // h1~h3가 없으면 챕터 안에서 가장 큰 인라인 font-size를 가진 요소를 헤드라인으로 취급한다.
    let largest: { start: number; end: number; text: string; raw: string; px: number } | null = null;

    for (const regex of [CH7_KEBAB_FONT_SIZE_REGEX, CH7_CAMEL_FONT_SIZE_REGEX]) {
      const globalRegex = new RegExp(regex.source, 'gi');

      for (const sizeMatch of chapterText.matchAll(globalRegex)) {
        const px = parseFloat(sizeMatch[1]);

        if (!largest || px > largest.px) {
          largest = {
            start: start + (sizeMatch.index as number),
            end: start + (sizeMatch.index as number) + sizeMatch[0].length,
            text: sizeMatch[0],
            raw: sizeMatch[1],
            px,
          };
        }
      }
    }

    if (!largest) {
      findings.push({
        file: filePath,
        line: lineNumberAt(content, start),
        rule: 'skeleton7-fallback-headline-unresolved',
        message:
          '골격 7 폴백 챕터에서 헤드라인 태그(h1~h3)도, font-size 선언도 찾지 못해 56px 강제를 건너뛰었습니다 — 헤드라인을 실제 헤딩 태그로 마크업하세요.',
        autoFixed: false,
      });
      continue;
    }

    if (largest.px >= CH7_FALLBACK_HEADLINE_MIN_PX) {
      continue;
    }

    const fixedText = largest.text.replace(largest.raw, String(CH7_FALLBACK_HEADLINE_MIN_PX));
    replacements.push({ start: largest.start, end: largest.end, text: fixedText });
    findings.push({
      file: filePath,
      line: lineNumberAt(content, largest.start),
      rule: 'skeleton7-fallback-headline-size',
      message: `골격 7 폴백 챕터에서 가장 큰 텍스트(font-size ${largest.px}px, 헤딩 태그 없음)를 헤드라인으로 보고 56px로 자동수정했습니다.`,
      autoFixed: true,
    });
  }

  if (replacements.length === 0) {
    return { findings, content };
  }

  replacements.sort((a, b) => b.start - a.start);

  let nextContent = content;

  for (const { start, end, text } of replacements) {
    nextContent = nextContent.slice(0, start) + text + nextContent.slice(end);
  }

  return { findings, content: nextContent };
}

const CH7_CAPTION_REGEX = new RegExp(CH7_HERO_CAPTION.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
const CH7_HERO_PROXIMITY_WINDOW = 3000;

/*
 * 파일 내 캡션 "리터럴 문자열" 개수만 센다 — 캡션을 감싼 로직이 별도 컴포넌트(예: PhotoSlot.tsx)로
 * 추출되고 여러 챕터에서 재사용되면 소스엔 리터럴이 1번뿐이어도 렌더된 DOM엔 여러 번 나온다. 그
 * 크로스 파일 케이스는 이 함수가 아니라 아래 runSkeleton7SharedCaptionCheck(전체 파일셋을 보고 prop
 * 게이트 호출 지점을 추적)가 별도로 처리한다 — 이 함수는 여전히 "한 파일 안에서 리터럴이 그대로
 * 여러 번 박힌" 단순 케이스 전용. 2026-09-09: tests/skeleton7-dom(Playwright 실렌더)로 cafe
 * 픽스처 실측 검증 완료(캡션 4회 -> 1회로 축소 확인).
 */
/** 안내 문구가 2회 이상이면 히어로(data-slot="hero") 근처 1곳만 남기고 나머지를 지운다. */
function runSkeleton7CaptionDedupeCheck(
  filePath: string,
  content: string,
): { findings: MechanicalFinding[]; content: string } {
  if (!hasExtension(filePath, ['.tsx', '.jsx', '.html']) || !content.includes(CH7_HERO_CAPTION)) {
    return { findings: [], content };
  }

  const occurrences = [...content.matchAll(CH7_CAPTION_REGEX)].map((m) => m.index as number);

  if (occurrences.length <= 1) {
    return { findings: [], content };
  }

  const heroIndex = content.indexOf('data-slot="hero"');
  const nearHero =
    heroIndex === -1 ? undefined : occurrences.find((idx) => Math.abs(idx - heroIndex) <= CH7_HERO_PROXIMITY_WINDOW);
  const keepIndex = nearHero ?? occurrences[0];
  const removeStarts = occurrences.filter((idx) => idx !== keepIndex).sort((a, b) => b - a);

  let nextContent = content;

  for (const start of removeStarts) {
    nextContent = nextContent.slice(0, start) + nextContent.slice(start + CH7_HERO_CAPTION.length);
  }

  return {
    findings: [
      {
        file: filePath,
        line: lineNumberAt(content, keepIndex),
        rule: 'skeleton7-hero-caption-dedupe',
        message: `안내 문구("${CH7_HERO_CAPTION}")가 ${occurrences.length}회 등장해 히어로 근처 1곳만 남기고 ${removeStarts.length}곳을 제거했습니다.`,
        autoFixed: true,
      },
    ],
    content: nextContent,
  };
}

const CH7_CAPTION_PROP_GATE_REGEX = /\{\s*([A-Za-z_$][\w$]*)\s*&&/g;
const CH7_CAPTION_GATE_SEARCH_WINDOW = 500;

interface Skeleton7SharedCaptionComponent {
  file: string;
  componentName: string;
  propName: string;
}

/**
 * 캡션이 별도 파일의 컴포넌트 안에서 `{propName && (...캡션...)}` 형태로 prop에 의해 켜지는지 찾는다.
 * 오탐 방지로 propName이 그 파일의 구조분해 매개변수(`{ ..., propName, ... }:`)에 실제로 선언돼
 * 있는지까지 확인한다. 히어로 파일 자체는 호출자에서 건너뛰고 넘긴다.
 */
function findSharedCaptionComponent(filePath: string, content: string): Skeleton7SharedCaptionComponent | null {
  if (!hasExtension(filePath, ['.tsx', '.jsx']) || !content.includes(CH7_HERO_CAPTION)) {
    return null;
  }

  const captionIdx = content.indexOf(CH7_HERO_CAPTION);
  const windowStart = Math.max(0, captionIdx - CH7_CAPTION_GATE_SEARCH_WINDOW);
  const before = content.slice(windowStart, captionIdx);
  const gateMatches = [...before.matchAll(CH7_CAPTION_PROP_GATE_REGEX)];
  const gateMatch = gateMatches[gateMatches.length - 1]; // 캡션 바로 앞(가장 가까운) 게이트

  if (!gateMatch) {
    return null;
  }

  const propName = gateMatch[1];
  const propDeclRegex = new RegExp(`\\{[^}]*\\b${propName}\\b[^}]*\\}\\s*:`);

  if (!propDeclRegex.test(content)) {
    return null;
  }

  const nameMatch =
    content.match(/function\s+([A-Z]\w*)\s*\(/) ??
    content.match(/const\s+([A-Z]\w*)\s*=\s*\(/) ??
    content.match(/export\s+default\s+(?:function\s+)?([A-Z]\w*)/);

  if (!nameMatch) {
    return null;
  }

  return { file: filePath, componentName: nameMatch[1], propName };
}

/*
 * 크로스 파일 캡션 중복 — 캡션이 PhotoSlot.tsx 같은 공용 컴포넌트로 추출되고 여러 챕터에서
 * `<PhotoSlot showCaption ... />` 형태로 반복 호출되면, 파일별 리터럴 검사(위)는 컴포넌트
 * 정의 파일에서 리터럴을 1번만 보므로 못 잡는다. 실측(2026-09-09, tests/skeleton7-dom):
 * tests/fixtures/generated/cafe.json이 정확히 이 패턴 — 소스엔 리터럴 1번인데 렌더된 DOM엔
 * PhotoSlot이 4개 챕터 각각에서 호출돼 캡션이 4번 나온다.
 *
 * 전체 파일셋에서 공용 캡션 컴포넌트를 찾은 뒤, 그 컴포넌트의 JSX 호출 지점을 전 파일에서
 * 찾아 히어로 챕터(data-slot="hero") 안에 있는 호출 1곳만 prop을 남기고 나머지 호출에서
 * prop을 제거한다(JSX 불리언 shorthand/명시적 값 모두 대상 — prop이 없으면 컴포넌트 내부의
 * `propName && (...)` 게이트가 자연히 false로 닫힌다).
 *
 * TODO(백로그 3, 2026-09-09, 결정: 정적 검사 추가 금지): 위 방식은 호출부에 prop이 "명시적으로"
 * 붙어 있어야 site로 잡는다 — 실생성 검증(개인 포트폴리오)에서 `caption = true` 같은 기본값
 * 파라미터로 게이트를 걸고 호출부는 `<ImagePlaceholder />`처럼 prop을 아예 안 넘기는 패턴이
 * 나와 이 검사가 그대로 못 잡는 걸 재현했다(호출부만 봐선 "기본값이 뭔지" 알 수 없어 소스
 * 분석만으론 정확한 판정이 원천적으로 불가능). 위 헤드라인 검사 TODO와 같은 결론 — 이 라인의
 * 정적 검사는 더 확장하지 않는다. 골격 7 검증 자체를 시각 검토 단계(실제 렌더 DOM 기반)로
 * 옮기는 별도 작업으로 대체 예정.
 */
function runSkeleton7SharedCaptionCheck(files: Record<string, string>): {
  findings: MechanicalFinding[];
  updatedFiles: Record<string, string>;
} {
  const findings: MechanicalFinding[] = [];
  const updatedFiles: Record<string, string> = {};

  const heroFileEntry = Object.entries(files).find(([, content]) => content.includes('data-slot="hero"'));

  if (!heroFileEntry) {
    return { findings, updatedFiles };
  }

  const [heroFilePath] = heroFileEntry;

  let shared: Skeleton7SharedCaptionComponent | null = null;

  for (const [filePath, content] of Object.entries(files)) {
    if (filePath === heroFilePath) {
      continue; // 히어로 파일 자체가 아니라 별도로 추출된 "공용 컴포넌트" 파일을 찾는다.
    }

    const found = findSharedCaptionComponent(filePath, content);

    if (found) {
      shared = found;
      break;
    }
  }

  if (!shared) {
    return { findings, updatedFiles };
  }

  const tagOpenRegex = new RegExp(`<${shared.componentName}\\b[^>]*>`, 'g');
  const propRegex = new RegExp(`\\s*\\b${shared.propName}(?:=\\{[^}]*\\})?`);

  interface CaptionSite {
    file: string;
    tagStart: number;
    propStart: number;
    propEnd: number;
  }

  const sites: CaptionSite[] = [];

  for (const [filePath, content] of Object.entries(files)) {
    for (const tagMatch of content.matchAll(tagOpenRegex)) {
      const tagText = tagMatch[0];
      const propMatch = tagText.match(propRegex);

      if (!propMatch) {
        continue; // 그 호출엔 prop 자체가 없음(이미 꺼져 있음) — 대상 아님.
      }

      const tagStart = tagMatch.index as number;
      sites.push({
        file: filePath,
        tagStart,
        propStart: tagStart + (propMatch.index as number),
        propEnd: tagStart + (propMatch.index as number) + propMatch[0].length,
      });
    }
  }

  if (sites.length < 2) {
    return { findings, updatedFiles };
  }

  const heroChapterSpans = findSkeleton7ChapterSpans(files[heroFilePath]);
  const heroSpan = heroChapterSpans?.[0]; // hero는 항상 첫 챕터.
  let keepIndex = 0;

  if (heroSpan) {
    const idx = sites.findIndex(
      (site) => site.file === heroFilePath && site.tagStart >= heroSpan.start && site.tagStart < heroSpan.end,
    );

    if (idx !== -1) {
      keepIndex = idx;
    }
  }

  const toRemove = sites.filter((_, i) => i !== keepIndex);
  const byFile = new Map<string, CaptionSite[]>();

  for (const site of toRemove) {
    const list = byFile.get(site.file) ?? [];
    list.push(site);
    byFile.set(site.file, list);
  }

  for (const [filePath, fileSites] of byFile) {
    let content = files[filePath];
    const sorted = [...fileSites].sort((a, b) => b.propStart - a.propStart);

    for (const site of sorted) {
      content = content.slice(0, site.propStart) + content.slice(site.propEnd);
    }

    updatedFiles[filePath] = content;
  }

  findings.push({
    file: shared.file,
    line: lineNumberAt(files[shared.file], files[shared.file].indexOf(CH7_HERO_CAPTION)),
    rule: 'skeleton7-caption-dedupe-shared-component',
    message: `공용 컴포넌트(${shared.componentName})의 안내 문구가 ${sites.length}개 호출 지점에서 렌더돼 히어로 근처 1곳만 남기고 ${toRemove.length}곳의 "${shared.propName}"을 제거했습니다.`,
    autoFixed: true,
  });

  return { findings, updatedFiles };
}

const CH7_MAP_CALL_REGEX = /\.map\(/;
const CH7_GRID_PROPERTY_REGEX = /(?:grid-template-columns|gridTemplateColumns)\s*[:=]/i;
const CH7_CLASS_ATTR_REGEX = /class(?:Name)?=["']([^"']+)["']/g;
const CH7_REGEN_MESSAGE_SUFFIX =
  '이 골격은 나열이 아니라 챕터로 보여줍니다. 대표 3개를 골라 ch1/ch2/ch3에 하나씩 고정 JSX로 펼쳐 쓰고 .map()·그리드·반복 카드 컴포넌트를 제거하세요. 자동수정 대상이 아닙니다(재배치는 코드로 할 수 없는 판단이라 재생성이 맞습니다).';

/*
 * 코드로 재배치할 수 없는 위반이라 자동수정하지 않고 힌트(autoFixed:false)로만 남긴다 — 이 힌트는
 * formatMechanicalFindingsForPrompt를 거쳐 reviewGeneratedApp.ts의 LLM 텍스트 검토 단계로 넘어가고,
 * 그 단계가 실제로 파일을 다시 쓴다(이미 존재하는 "기계 검사 힌트 -> LLM 재작성" 경로 — 별도의 새
 * 재생성 트리거를 만들 필요가 없다).
 */
function runSkeleton7CardGridHintCheck(filePath: string, content: string): MechanicalFinding[] {
  if (!hasExtension(filePath, ['.tsx', '.jsx', '.html'])) {
    return [];
  }

  const chapterSpans = findSkeleton7ChapterSpans(content);

  if (!chapterSpans) {
    return [];
  }

  const findings: MechanicalFinding[] = [];

  for (const { start, end } of chapterSpans) {
    const chapterText = content.slice(start, end);

    if (CH7_MAP_CALL_REGEX.test(chapterText)) {
      findings.push({
        file: filePath,
        line: lineNumberAt(content, start),
        rule: 'skeleton7-card-grid-detected',
        message: `골격 7 챕터 안에 .map() 반복 렌더링이 있습니다 — ${CH7_REGEN_MESSAGE_SUFFIX}`,
        autoFixed: false,
      });
      continue;
    }

    if (!CH7_GRID_PROPERTY_REGEX.test(chapterText)) {
      continue;
    }

    const classCounts = new Map<string, number>();

    for (const classMatch of chapterText.matchAll(CH7_CLASS_ATTR_REGEX)) {
      for (const token of classMatch[1].split(/\s+/).filter(Boolean)) {
        classCounts.set(token, (classCounts.get(token) ?? 0) + 1);
      }
    }

    const repeated = [...classCounts.entries()].find(([, count]) => count >= 3);

    if (!repeated) {
      continue;
    }

    findings.push({
      file: filePath,
      line: lineNumberAt(content, start),
      rule: 'skeleton7-card-grid-detected',
      message: `골격 7 챕터 안에서 그리드 레이아웃 + 같은 클래스("${repeated[0]}")가 ${repeated[1]}회 반복되는 카드가 감지됐습니다 — ${CH7_REGEN_MESSAGE_SUFFIX}`,
      autoFixed: false,
    });
  }

  return findings;
}

// --- 9. 100vh -> 100dvh (자동수정) ---

/*
 * 모바일 브라우저는 주소창만큼 100vh가 실제 보이는 화면보다 커서 하단이 잘린다 — 100dvh(동적
 * 뷰포트 단위)로 바꾸면 주소창이 접히고 펼쳐지는 만큼 항상 정확히 맞는다. 골격 7의 챕터 판정
 * (CH7_CHAPTER_TAG_REGEX/isSkeleton7File)이 "100vh" 리터럴 자체를 신호로 쓰므로, 이 검사는
 * 오케스트레이션에서 반드시 골격 7 검사들 뒤에(원본 100vh가 아직 남아있을 때 그 검사들이 먼저
 * 끝난 뒤) 돈다 — 순서를 앞으로 옮기면 골격 7 챕터를 통째로 못 찾게 된다.
 */
const VH_100_REGEX = /\b100vh\b/g;

function run100vhToDvhCheck(filePath: string, content: string): { findings: MechanicalFinding[]; content: string } {
  if (!hasExtension(filePath, ['.tsx', '.jsx', '.css', '.scss', '.html'])) {
    return { findings: [], content };
  }

  const masked = maskComments(content);
  const matches = [...masked.matchAll(VH_100_REGEX)];

  if (matches.length === 0) {
    return { findings: [], content };
  }

  const findings: MechanicalFinding[] = [];
  const replacements: Array<{ start: number; end: number; text: string }> = [];

  for (const match of matches) {
    const start = match.index as number;
    const end = start + match[0].length;
    findings.push({
      file: filePath,
      line: lineNumberAt(content, start),
      rule: 'viewport-height-100vh',
      message:
        '100vh를 100dvh로 바꿨습니다 — 모바일 브라우저 주소창만큼 100vh가 실제 화면보다 커서 하단이 잘릴 수 있습니다.',
      autoFixed: true,
    });
    replacements.push({ start, end, text: '100dvh' });
  }

  let nextContent = content;

  for (let i = replacements.length - 1; i >= 0; i--) {
    const { start, end, text } = replacements[i];
    nextContent = nextContent.slice(0, start) + text + nextContent.slice(end);
  }

  return { findings, content: nextContent };
}

// --- 10. 본문 font-size 최소 16px (자동수정) ---

/*
 * "본문"인지(라벨·배지처럼 의도적으로 작은 텍스트가 아닌지)를 정규식으로 정확히 가릴 수는 없다 —
 * 모든 font-size 선언에 16px 미만이면 일괄 적용한다(:root 안의 rem 베이스 정의만 예외 — 그건
 * 전역 스케일 값이라 강제로 16으로 올리면 rem 기반 크기 전체가 어긋난다). 실 생성으로 오탐률이
 * 높게 나오면 map-guard처럼 끌 수 있게 __internal로 내보낸다.
 */
const MIN_BODY_FONT_SIZE_PX = 16;
const FONT_SIZE_KEBAB_REGEX = /(?<!-)\bfont-size\s*:\s*(-?\d+(?:\.\d+)?)px\b/dg;
const FONT_SIZE_CAMEL_REGEX = /\bfontSize\s*:\s*(['"]?)(-?\d+(?:\.\d+)?)(?:px)?\1/dg;

function runFontSizeMinimumCheck(
  filePath: string,
  content: string,
): { findings: MechanicalFinding[]; content: string } {
  if (!hasExtension(filePath, ['.tsx', '.jsx', '.css', '.scss'])) {
    return { findings: [], content };
  }

  const masked = maskComments(content);
  const rootRanges = findRootBlockRanges(content);
  const findings: MechanicalFinding[] = [];
  const replacements: Array<{ start: number; end: number; text: string }> = [];

  for (const match of masked.matchAll(FONT_SIZE_KEBAB_REGEX)) {
    const index = match.index as number;

    if (isInsideRanges(index, rootRanges)) {
      continue;
    }

    const px = parseFloat(match[1]);

    if (Number.isNaN(px) || px < 0 || px >= MIN_BODY_FONT_SIZE_PX) {
      continue;
    }

    const indexed = match as RegExpMatchArray & { indices: RegExpIndicesArray };
    const [start, end] = indexed.indices[1];
    findings.push({
      file: filePath,
      line: lineNumberAt(content, index),
      rule: 'font-size-below-16px',
      message: `font-size ${px}px가 최소 권장 크기(16px)보다 작아 16px로 올렸습니다.`,
      autoFixed: true,
    });
    replacements.push({ start, end, text: String(MIN_BODY_FONT_SIZE_PX) });
  }

  for (const match of masked.matchAll(FONT_SIZE_CAMEL_REGEX)) {
    const px = parseFloat(match[2]);

    if (Number.isNaN(px) || px < 0 || px >= MIN_BODY_FONT_SIZE_PX) {
      continue;
    }

    const indexed = match as RegExpMatchArray & { indices: RegExpIndicesArray };
    const [start, end] = indexed.indices[2];
    findings.push({
      file: filePath,
      line: lineNumberAt(content, match.index as number),
      rule: 'font-size-below-16px',
      message: `fontSize ${px}px가 최소 권장 크기(16px)보다 작아 16px로 올렸습니다.`,
      autoFixed: true,
    });
    replacements.push({ start, end, text: String(MIN_BODY_FONT_SIZE_PX) });
  }

  if (replacements.length === 0) {
    return { findings, content };
  }

  replacements.sort((a, b) => b.start - a.start);

  let nextContent = content;

  for (const { start, end, text } of replacements) {
    nextContent = nextContent.slice(0, start) + text + nextContent.slice(end);
  }

  return { findings, content: nextContent };
}

// --- 11. line-height가 font-size의 1.3배 미만 (자동수정) ---

/*
 * font-size와 line-height는 같은 선언 블록(같은 CSS 규칙 본문 또는 같은 style={{...}} 객체) 안에
 * 함께 있을 때만 서로 연관지어 비교할 수 있다 — 파일 전체에서 아무 font-size와 아무 line-height를
 * 비교하면 완전히 다른 요소끼리 잘못 엮인다. "\{([^{}]*)\}"(중첩 없는 중괄호 쌍)로 가장 안쪽
 * 블록만 잡으면 CSS 규칙 본문과 style={{...}}의 안쪽 객체 리터럴 둘 다 자연히 걸린다(중첩된
 * @media {.a{...}}나 style={{...}}의 이중 중괄호에서도 정규식이 스스로 가장 안쪽 것만 찾는다 —
 * 얕은 중첩이면 depth 추적 없이도 성립). 같은 블록에 font-size가 없으면 그냥 지나친다.
 */
const LINE_HEIGHT_BLOCK_REGEX = /\{([^{}]*)\}/dg;
const BLOCK_FONT_SIZE_REGEX = /\b(?:font-size|fontSize)\s*:\s*['"]?(\d+(?:\.\d+)?)(?:px)?['"]?/i;
const BLOCK_LINE_HEIGHT_REGEX = /\b(?:line-height|lineHeight)\s*:\s*(['"]?)(\d+(?:\.\d+)?(?:px|%)?)\1/di;
const LINE_HEIGHT_MIN_RATIO = 1.3;
const LINE_HEIGHT_FIX_VALUE = '1.5';

function runLineHeightRatioCheck(
  filePath: string,
  content: string,
): { findings: MechanicalFinding[]; content: string } {
  if (!hasExtension(filePath, ['.tsx', '.jsx', '.css', '.scss'])) {
    return { findings: [], content };
  }

  const masked = maskComments(content);
  const findings: MechanicalFinding[] = [];
  const replacements: Array<{ start: number; end: number; text: string }> = [];

  for (const blockMatch of masked.matchAll(LINE_HEIGHT_BLOCK_REGEX)) {
    const indexedBlock = blockMatch as RegExpMatchArray & { indices: RegExpIndicesArray };
    const blockText = blockMatch[1];
    const [blockStart] = indexedBlock.indices[1];

    const fsMatch = blockText.match(BLOCK_FONT_SIZE_REGEX);

    if (!fsMatch) {
      continue;
    }

    const fontSizePx = parseFloat(fsMatch[1]);

    if (Number.isNaN(fontSizePx) || fontSizePx <= 0) {
      continue;
    }

    const lhMatch = blockText.match(BLOCK_LINE_HEIGHT_REGEX) as
      | (RegExpMatchArray & { indices: RegExpIndicesArray })
      | null;

    if (!lhMatch) {
      continue;
    }

    const valueToken = lhMatch[2];
    const tokenParts = valueToken.match(/^(\d+(?:\.\d+)?)(px|%)?$/);

    if (!tokenParts) {
      continue;
    }

    const rawValue = parseFloat(tokenParts[1]);
    const unit = tokenParts[2];
    const lineHeightPx =
      unit === 'px' ? rawValue : unit === '%' ? fontSizePx * (rawValue / 100) : fontSizePx * rawValue;

    if (lineHeightPx >= fontSizePx * LINE_HEIGHT_MIN_RATIO) {
      continue;
    }

    const [tokenStart, tokenEnd] = lhMatch.indices[2];
    const absoluteStart = blockStart + tokenStart;
    const absoluteEnd = blockStart + tokenEnd;

    findings.push({
      file: filePath,
      line: lineNumberAt(content, absoluteStart),
      rule: 'line-height-too-tight',
      message: `line-height "${valueToken}"가 font-size(${fontSizePx}px)의 1.3배 미만이라 읽기 답답할 수 있어 1.5로 올렸습니다.`,
      autoFixed: true,
    });
    replacements.push({ start: absoluteStart, end: absoluteEnd, text: LINE_HEIGHT_FIX_VALUE });
  }

  if (replacements.length === 0) {
    return { findings, content };
  }

  replacements.sort((a, b) => b.start - a.start);

  let nextContent = content;

  for (const { start, end, text } of replacements) {
    nextContent = nextContent.slice(0, start) + text + nextContent.slice(end);
  }

  return { findings, content: nextContent };
}

// --- 12. 이미지에 max-width:100% 없으면 추가 (자동수정) ---

const HAS_MAX_WIDTH_REGEX = /max-width|maxWidth/i;
const IMG_STYLE_OBJECT_REGEX = /style=\{\{([^}]*)\}\}/;
const IMG_STYLE_STRING_REGEX = /style=(["'])([^"']*)\1/;

function ensureImgMaxWidth(tagText: string): { tagText: string; changed: boolean } {
  if (HAS_MAX_WIDTH_REGEX.test(tagText)) {
    return { tagText, changed: false };
  }

  const objMatch = tagText.match(IMG_STYLE_OBJECT_REGEX);

  if (objMatch) {
    const fixedInner = `maxWidth: '100%', ${objMatch[1]}`;
    return { tagText: tagText.replace(objMatch[0], `style={{${fixedInner}}}`), changed: true };
  }

  const strMatch = tagText.match(IMG_STYLE_STRING_REGEX);

  if (strMatch) {
    const quote = strMatch[1];
    const fixedInner = `max-width:100%;${strMatch[2]}`;

    return { tagText: tagText.replace(strMatch[0], `style=${quote}${fixedInner}${quote}`), changed: true };
  }

  const insertAt = '<img'.length;

  return {
    tagText: tagText.slice(0, insertAt) + ` style={{ maxWidth: '100%' }}` + tagText.slice(insertAt),
    changed: true,
  };
}

function runImgMaxWidthCheck(filePath: string, content: string): { findings: MechanicalFinding[]; content: string } {
  if (!hasExtension(filePath, ['.tsx', '.jsx'])) {
    return { findings: [], content };
  }

  const findings: MechanicalFinding[] = [];
  const replacements: Array<{ start: number; end: number; text: string }> = [];

  for (const match of content.matchAll(IMG_TAG_REGEX)) {
    const { tagText, changed } = ensureImgMaxWidth(match[0]);

    if (!changed) {
      continue;
    }

    const start = match.index as number;
    replacements.push({ start, end: start + match[0].length, text: tagText });
    findings.push({
      file: filePath,
      line: lineNumberAt(content, start),
      rule: 'img-missing-max-width',
      message:
        '이미지에 max-width:100%를 추가했습니다 — 컨테이너보다 큰 원본 이미지가 레이아웃을 밀어내는 걸 막습니다.',
      autoFixed: true,
    });
  }

  if (replacements.length === 0) {
    return { findings, content };
  }

  replacements.sort((a, b) => b.start - a.start);

  let nextContent = content;

  for (const { start, end, text } of replacements) {
    nextContent = nextContent.slice(0, start) + text + nextContent.slice(end);
  }

  return { findings, content: nextContent };
}

// --- 13. 텍스트 컨테이너에 max-width 없음 (힌트 전용) ---

const P_TAG_REGEX = /<p\b([^>]*)>([\s\S]*?)<\/p>/gi;
const TEXT_CONTAINER_LENGTH_THRESHOLD = 80;

function estimateJsxTextLength(inner: string): number {
  return inner
    .replace(/<[^>]+>/g, '')
    .replace(/\{[^}]*\}/g, '')
    .trim().length;
}

function runTextContainerMaxWidthCheck(filePath: string, content: string): MechanicalFinding[] {
  if (!hasExtension(filePath, ['.tsx', '.jsx'])) {
    return [];
  }

  const findings: MechanicalFinding[] = [];

  for (const match of content.matchAll(P_TAG_REGEX)) {
    const attrs = match[1];

    if (HAS_MAX_WIDTH_REGEX.test(attrs)) {
      continue;
    }

    const textLength = estimateJsxTextLength(match[2]);

    if (textLength < TEXT_CONTAINER_LENGTH_THRESHOLD) {
      continue;
    }

    findings.push({
      file: filePath,
      line: lineNumberAt(content, match.index as number),
      rule: 'text-container-no-max-width',
      message: `본문 텍스트(약 ${textLength}자)가 있는 <p>에 max-width가 없습니다 — 넓은 화면에서 한 줄이 너무 길어질 수 있습니다(줄 길이 80자 초과 위험). 부모 컨테이너가 이미 폭을 제한하는지 확인하세요.`,
      autoFixed: false,
    });
  }

  return findings;
}

// --- 14. width/height/padding/margin에 transition 적용 (힌트 전용, 성능) ---

/*
 * "all"은 제외한다 — 호버 트랜지션에 워낙 흔히 쓰여(실측 없이도 예상되는 노이즈가 큼) 전부 잡으면
 * 힌트가 다른 신호를 덮어버린다. width/height/padding/margin(방향 변형 포함, \b padding \b이
 * "padding-left"의 "padding"도 그대로 잡는다)처럼 명시적으로 레이아웃 속성을 적은 경우만 잡는다.
 */
const TRANSITION_DECL_REGEX = /\btransition(?:-property)?\s*:\s*(['"]?)([^'",;}\n]+)\1/gi;
const EXPENSIVE_TRANSITION_PROP_REGEX = /\b(width|height|padding|margin)\b/i;

function runExpensiveTransitionCheck(filePath: string, content: string): MechanicalFinding[] {
  if (!hasExtension(filePath, ['.tsx', '.jsx', '.css', '.scss'])) {
    return [];
  }

  const masked = maskComments(content);
  const findings: MechanicalFinding[] = [];

  for (const match of masked.matchAll(TRANSITION_DECL_REGEX)) {
    const propMatch = match[2].match(EXPENSIVE_TRANSITION_PROP_REGEX);

    if (!propMatch) {
      continue;
    }

    findings.push({
      file: filePath,
      line: lineNumberAt(content, match.index as number),
      rule: 'transition-expensive-property',
      message: `transition에 "${propMatch[0]}"가 있습니다 — width/height/padding/margin 애니메이션은 레이아웃을 다시 계산해 느립니다. transform/opacity로 바꿀 수 있는지 확인하세요.`,
      autoFixed: false,
    });
  }

  return findings;
}

// --- 15. 헤딩 레벨 건너뜀 (힌트 전용) ---

/*
 * 파일 단위로만 순서를 본다 — 여러 컴포넌트 파일에 걸친 실제 렌더 순서까지는 정적 분석으로 알 수
 * 없다(알려진 한계, 이 파일의 다른 검사들과 같은 타협).
 */
const HEADING_TAG_REGEX = /<h([1-6])\b/gi;

function runHeadingLevelSkipCheck(filePath: string, content: string): MechanicalFinding[] {
  if (!hasExtension(filePath, ['.tsx', '.jsx', '.html'])) {
    return [];
  }

  const findings: MechanicalFinding[] = [];
  let prevLevel: number | null = null;

  for (const match of content.matchAll(HEADING_TAG_REGEX)) {
    const level = Number(match[1]);

    if (prevLevel !== null && level > prevLevel + 1) {
      findings.push({
        file: filePath,
        line: lineNumberAt(content, match.index as number),
        rule: 'heading-level-skip',
        message: `헤딩 레벨이 h${prevLevel}에서 h${level}로 건너뜁니다 — 중간 레벨(h${prevLevel + 1})을 채우거나 순서를 맞추세요.`,
        autoFixed: false,
      });
    }

    prevLevel = level;
  }

  return findings;
}

// --- 16. 본문 text-transform:uppercase / letter-spacing 과다 (힌트 전용) ---

/*
 * letter-spacing은 em 단위만 다룬다 — px 단위는 font-size를 알아야 상대 비율을 낼 수 있는데, 이
 * 파일에서 그 둘을 안전하게 짝지으려면 11번 검사와 같은 블록 스코핑이 또 필요해져 배보다 배꼽이
 * 커진다(알려진 한계).
 */
const TEXT_TRANSFORM_UPPERCASE_REGEX = /\b(?:text-transform|textTransform)\s*:\s*(['"]?)uppercase\1/gi;
const LETTER_SPACING_EM_REGEX = /\b(?:letter-spacing|letterSpacing)\s*:\s*(['"]?)(-?\d+(?:\.\d+)?)em\1/gi;
const LETTER_SPACING_MAX_EM = 0.05;

function runTypographyExtremesCheck(filePath: string, content: string): MechanicalFinding[] {
  if (!hasExtension(filePath, ['.tsx', '.jsx', '.css', '.scss'])) {
    return [];
  }

  const masked = maskComments(content);
  const findings: MechanicalFinding[] = [];

  for (const match of masked.matchAll(TEXT_TRANSFORM_UPPERCASE_REGEX)) {
    findings.push({
      file: filePath,
      line: lineNumberAt(content, match.index as number),
      rule: 'text-transform-uppercase',
      message:
        'text-transform:uppercase가 있습니다 — 본문에 쓰이면 가독성이 떨어질 수 있어 라벨·버튼 등 짧은 텍스트에만 쓰는지 확인하세요.',
      autoFixed: false,
    });
  }

  for (const match of masked.matchAll(LETTER_SPACING_EM_REGEX)) {
    const value = parseFloat(match[2]);

    if (Number.isNaN(value) || value <= LETTER_SPACING_MAX_EM) {
      continue;
    }

    findings.push({
      file: filePath,
      line: lineNumberAt(content, match.index as number),
      rule: 'letter-spacing-too-wide',
      message: `letter-spacing "${match[2]}em"이 0.05em을 넘습니다 — 본문에 쓰이면 읽기 어려울 수 있습니다.`,
      autoFixed: false,
    });
  }

  return findings;
}

// --- 17. 그라데이션 텍스트 / 오프셋 0인 유채색 그림자 (힌트 전용) ---

const BG_CLIP_TEXT_REGEX =
  /\b(?:background-clip|backgroundClip|WebkitBackgroundClip|-webkit-background-clip)\s*:\s*(['"]?)text\1/gi;

function runGradientTextCheck(filePath: string, content: string): MechanicalFinding[] {
  if (!hasExtension(filePath, ['.tsx', '.jsx', '.css', '.scss'])) {
    return [];
  }

  const masked = maskComments(content);
  const findings: MechanicalFinding[] = [];

  for (const match of masked.matchAll(BG_CLIP_TEXT_REGEX)) {
    findings.push({
      file: filePath,
      line: lineNumberAt(content, match.index as number),
      rule: 'gradient-text-clip',
      message:
        'background-clip:text로 그라데이션 텍스트를 쓰고 있습니다 — 브라우저 호환성·가독성 문제가 없는지, 남용되지 않았는지 확인하세요.',
      autoFixed: false,
    });
  }

  return findings;
}

/*
 * OKLab 채도(chroma = sqrt(a^2+b^2))로 "유채색"을 가린다 — 이미 위쪽(섹션 2)의 rgbToOklab/
 * parseColorLiteral을 그대로 재사용해 색을 또 파싱하는 코드를 새로 안 만든다. 채도가 거의 0이면
 * 회색·검정·흰색이라 대상이 아니다(문턱값 0.02는 무채색의 미세한 색조 오차를 흡수하는 여유값).
 */
const SHADOW_DECL_REGEX = /\b(?:box-shadow|boxShadow|text-shadow|textShadow)\s*:\s*(['"]?)([^'",;}\n]+)\1/gi;
const SHADOW_ZERO_OFFSET_REGEX = /^\s*(?:inset\s+)?0(?:px)?\s+0(?:px)?(?:\s+|$)/i;
const SHADOW_CHROMA_THRESHOLD = 0.02;

function findFirstColorInText(text: string): string | null {
  for (const regex of [HEX_COLOR_REGEX, RGB_FN_REGEX, HSL_FN_REGEX, OKLCH_FN_REGEX]) {
    const found = text.match(regex);

    if (found && found[0]) {
      return found[0];
    }
  }

  return null;
}

function runZeroOffsetChromaticShadowCheck(filePath: string, content: string): MechanicalFinding[] {
  if (!hasExtension(filePath, ['.tsx', '.jsx', '.css', '.scss'])) {
    return [];
  }

  const masked = maskComments(content);
  const findings: MechanicalFinding[] = [];

  for (const match of masked.matchAll(SHADOW_DECL_REGEX)) {
    const value = match[2];

    if (!SHADOW_ZERO_OFFSET_REGEX.test(value)) {
      continue;
    }

    const colorRaw = findFirstColorInText(value);

    if (!colorRaw) {
      continue;
    }

    const parsed = parseColorLiteral(colorRaw);

    if (!parsed) {
      continue;
    }

    const chroma = Math.sqrt(parsed.a ** 2 + parsed.b ** 2);

    if (chroma < SHADOW_CHROMA_THRESHOLD) {
      continue;
    }

    findings.push({
      file: filePath,
      line: lineNumberAt(content, match.index as number),
      rule: 'zero-offset-chromatic-shadow',
      message: `오프셋이 0인 유채색 그림자("${colorRaw}")가 있습니다 — 발광 효과가 과할 수 있어 의도한 디자인인지 확인하세요.`,
      autoFixed: false,
    });
  }

  return findings;
}

// --- 18. 요약 카드에 숫자만 있고 보조 문구 없음 (골격 1~6, 힌트 전용 — 휴리스틱) ---

/*
 * new-prompt.ts <app_skeletons> 요약 카드 규칙(D) + <external_data_and_metrics>의 "Numeric/metric
 * cards" 규칙을 코드 레벨에서 보강한다. cr-card 안에 숫자가 있는데 cr-caption 클래스도, 대비/목표성
 * 문구도 없으면 "숫자만 있는 카드"로 본다 — 텍스트 정규식 기반 휴리스틱이라 오탐 가능(예: 카드 안에
 * 순수 라벨용 숫자가 우연히 들어간 경우)이지만, 판정이 필요한 값이라 자동수정 대신 힌트로만 남기고
 * LLM 검토(reviewGeneratedApp.ts)가 실제로 고친다 — 골격 7(소개·홍보형)은 카드 자체가 없는 골격이라
 * isSkeleton7File로 제외한다.
 */
const SUMMARY_CARD_OPEN_TAG_REGEX = /<(\w+)\b[^>]*\bclass(?:Name)?=(["'])[^"']*\bcr-card\b[^"']*\2[^>]*>/gi;
const SUMMARY_CARD_METRIC_DIGIT_REGEX = /\d[\d,]*/;
const SUMMARY_CARD_CAPTION_CLASS_REGEX = /\bcr-caption\b/;
const SUMMARY_CARD_SUPPORT_TEXT_REGEX = /(대비|목표|전일|어제|지난|달성률|진행률|증가|감소|▲|▼)/;

function runSummaryCardMissingContextHintCheck(filePath: string, content: string): MechanicalFinding[] {
  if (!hasExtension(filePath, ['.tsx', '.jsx', '.html']) || isSkeleton7File(content)) {
    return [];
  }

  const findings: MechanicalFinding[] = [];

  for (const open of content.matchAll(SUMMARY_CARD_OPEN_TAG_REGEX)) {
    const tagStart = open.index as number;
    const tagName = open[1];
    const span = findChapterSpan(content, tagStart, tagName);

    if (!span) {
      continue;
    }

    const cardText = content.slice(span.start, span.end);

    if (!SUMMARY_CARD_METRIC_DIGIT_REGEX.test(cardText)) {
      continue;
    }

    if (SUMMARY_CARD_CAPTION_CLASS_REGEX.test(cardText) || SUMMARY_CARD_SUPPORT_TEXT_REGEX.test(cardText)) {
      continue;
    }

    findings.push({
      file: filePath,
      line: lineNumberAt(content, tagStart),
      rule: 'summary-card-missing-context',
      message:
        '요약 카드에 숫자만 있고 보조 문구(전일 대비/목표 대비/세부 내역)가 없어 보입니다 — cr-caption으로 보조 텍스트를 추가하세요.',
      autoFixed: false,
    });
  }

  return findings;
}

// --- 오케스트레이션 ---

/**
 * 파일별로 1(이모지) -> 2(색상 리터럴) 순으로 자동수정을 적용한 뒤(뒤 검사가 앞 검사의 결과를 보게),
 * 3(map 가드)·5(외부 이미지)·6(외부 스톡/플레이스홀더 도메인)은 최종 내용 기준으로 힌트만 남긴다.
 * 자동수정된 파일만 updatedFiles에 담기고, 호출자가 이걸 실제로 쓸지 말지(적용 시점·1회 쓰기 배치
 * 등)는 전적으로 결정한다 — 이 함수는 store에 아무것도 쓰지 않는다.
 */
export function runMechanicalChecks(files: Record<string, string>, resolvedHue: number | null): MechanicalCheckOutcome {
  const findings: MechanicalFinding[] = [];
  const updatedFiles: Record<string, string> = {};

  for (const [filePath, originalContent] of Object.entries(files)) {
    let content = originalContent;

    const emojiResult = runEmojiCheck(filePath, content);
    findings.push(...emojiResult.findings);
    content = emojiResult.content;

    const colorResult = runColorLiteralCheck(filePath, content, resolvedHue);
    findings.push(...colorResult.findings);
    content = colorResult.content;

    const ch7SlotResult = runSkeleton7DataSlotCheck(filePath, content);
    findings.push(...ch7SlotResult.findings);
    content = ch7SlotResult.content;

    const ch7HeadlineResult = runSkeleton7FallbackHeadlineCheck(filePath, content);
    findings.push(...ch7HeadlineResult.findings);
    content = ch7HeadlineResult.content;

    const ch7CaptionResult = runSkeleton7CaptionDedupeCheck(filePath, content);
    findings.push(...ch7CaptionResult.findings);
    content = ch7CaptionResult.content;

    const fontSizeResult = runFontSizeMinimumCheck(filePath, content);
    findings.push(...fontSizeResult.findings);
    content = fontSizeResult.content;

    const lineHeightResult = runLineHeightRatioCheck(filePath, content);
    findings.push(...lineHeightResult.findings);
    content = lineHeightResult.content;

    const imgMaxWidthResult = runImgMaxWidthCheck(filePath, content);
    findings.push(...imgMaxWidthResult.findings);
    content = imgMaxWidthResult.content;

    /*
     * 골격 7 챕터 판정(위)이 원본 "100vh" 리터럴에 의존하므로 이 자동수정은 반드시 마지막에 —
     * 100dvh로 바꾼 뒤에 챕터 검사가 돌면 챕터를 하나도 못 찾는다.
     */
    const vhResult = run100vhToDvhCheck(filePath, content);
    findings.push(...vhResult.findings);
    content = vhResult.content;

    if (MAP_GUARD_ENABLED) {
      findings.push(...runMapGuardCheck(filePath, content));
    }

    findings.push(...runExternalImageCheck(filePath, content));
    findings.push(...runStockImageDomainCheck(filePath, content));
    findings.push(...runSkeleton7CardGridHintCheck(filePath, content));
    findings.push(...runSummaryCardMissingContextHintCheck(filePath, content));
    findings.push(...runSpacingGridCheck(filePath, content));
    findings.push(...runTextContainerMaxWidthCheck(filePath, content));
    findings.push(...runExpensiveTransitionCheck(filePath, content));
    findings.push(...runHeadingLevelSkipCheck(filePath, content));
    findings.push(...runTypographyExtremesCheck(filePath, content));
    findings.push(...runGradientTextCheck(filePath, content));
    findings.push(...runZeroOffsetChromaticShadowCheck(filePath, content));

    if (content !== originalContent) {
      updatedFiles[filePath] = content;
    }
  }

  /*
   * 크로스 파일 캡션 중복은 파일 하나씩 보는 위 루프로는 못 잡는다(공용 컴포넌트 호출 지점이
   * 다른 챕터 파일에 흩어져 있음) — 루프가 끝난 뒤 전체 파일셋(자동수정 반영본)을 한 번에 본다.
   */
  const postLoopFiles: Record<string, string> = {};

  for (const filePath of Object.keys(files)) {
    postLoopFiles[filePath] = updatedFiles[filePath] ?? files[filePath];
  }

  const sharedCaptionResult = runSkeleton7SharedCaptionCheck(postLoopFiles);
  findings.push(...sharedCaptionResult.findings);

  for (const [filePath, content] of Object.entries(sharedCaptionResult.updatedFiles)) {
    updatedFiles[filePath] = content;
  }

  return { findings, updatedFiles };
}

/**
 * 기계 검사 결과를 LLM 텍스트 검토의 message 앞에 붙일 힌트 블록으로 조립한다. 자동수정된 항목은
 * "이미 수정됨" 목록으로 분리해서, LLM이 같은 자리를 또 고치려다 기계 검사 결과와 충돌하지 않게 한다.
 */
export function formatMechanicalFindingsForPrompt(findings: MechanicalFinding[]): string {
  if (findings.length === 0) {
    return '';
  }

  const fixed = findings.filter((f) => f.autoFixed);
  const hints = findings.filter((f) => !f.autoFixed);
  const sections: string[] = [];

  if (fixed.length > 0) {
    const lines = fixed.map((f) => `- ${f.file}:${f.line} — ${f.message}`).join('\n');
    sections.push(`[이미 기계 검사가 수정함 — 같은 자리를 다시 고치지 마세요]\n${lines}`);
  }

  if (hints.length > 0) {
    const lines = hints.map((f) => `- ${f.file}:${f.line} — ${f.message}`).join('\n');
    sections.push(`[기계 검사 힌트 — 아래 위치를 확인하고 필요하면 고치세요]\n${lines}`);
  }

  return `### 기계 검사 결과\n\n${sections.join('\n\n')}`;
}

// 유닛 테스트가 개별 검사를 직접 두드릴 수 있도록 내보낸다.
export const __internal = {
  runEmojiCheck,
  runColorLiteralCheck,
  runMapGuardCheck,
  runExternalImageCheck,
  runStockImageDomainCheck,
  runSkeleton7DataSlotCheck,
  runSkeleton7FallbackHeadlineCheck,
  runSkeleton7CaptionDedupeCheck,
  runSkeleton7SharedCaptionCheck,
  runSkeleton7CardGridHintCheck,
  runSummaryCardMissingContextHintCheck,
  isSkeleton7File,
  isCinematicTrackFile,
  findChapterSpan,
  findSkeleton7ChapterSpans,
  fixHeadlineTagFontSize,
  runSpacingGridCheck,
  maskComments,
  classifyEmojiContext,
  run100vhToDvhCheck,
  runFontSizeMinimumCheck,
  runLineHeightRatioCheck,
  runImgMaxWidthCheck,
  runTextContainerMaxWidthCheck,
  runExpensiveTransitionCheck,
  runHeadingLevelSkipCheck,
  runTypographyExtremesCheck,
  runGradientTextCheck,
  runZeroOffsetChromaticShadowCheck,
  isCustomPropertyValue,
};
