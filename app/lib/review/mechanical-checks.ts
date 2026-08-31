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

      if (isInsideRanges(index, rootRanges)) {
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

// --- 오케스트레이션 ---

/**
 * 파일별로 1(이모지) -> 2(색상 리터럴) 순으로 자동수정을 적용한 뒤(뒤 검사가 앞 검사의 결과를 보게),
 * 3(map 가드)·5(외부 이미지)는 최종 내용 기준으로 힌트만 남긴다. 자동수정된 파일만 updatedFiles에
 * 담기고, 호출자가 이걸 실제로 쓸지 말지(적용 시점·1회 쓰기 배치 등)는 전적으로 결정한다 — 이 함수는
 * store에 아무것도 쓰지 않는다.
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

    if (MAP_GUARD_ENABLED) {
      findings.push(...runMapGuardCheck(filePath, content));
    }

    findings.push(...runExternalImageCheck(filePath, content));

    if (content !== originalContent) {
      updatedFiles[filePath] = content;
    }
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
  maskComments,
  classifyEmojiContext,
};
