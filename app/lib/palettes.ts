/**
 * 생성물 색의 single source of truth. 생성물과 관련된 색을 쓰는 코드는 전부 이 파일을 import해서
 * 쓰고, 다른 곳에 색 값을 중복 정의하지 않는다.
 *
 * 12종 색 값(coral/dark의 브랜드 액센트 두 개를 제외한 전부)은 Tailwind CSS 기본 팔레트(MIT)
 * 기반 — tailwindlabs/tailwindcss v3 colors.js에서 직접 확인한 hex 값이다(v4는 oklch 정의라
 * hex 근사가 필요한데, v3 hex가 그 근사값과 동일하면서 더 단순해 그대로 썼다). coral의 액센트
 * #FF5330과 dark의 액센트 #FF5A36은 Tailwind가 아니라 코랄레드 자체 브랜드 색이다(coral은
 * app/utils/paletteToHue.ts의 CORALRED_DEFAULT_HUE=33이 바로 이 #FF5330에서 나온 값).
 */

export type PaletteId =
  | 'coral'
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'indigo'
  | 'purple'
  | 'pink'
  | 'brown'
  | 'teal'
  | 'dark'
  | 'minimal';

export interface Palette {
  id: PaletteId;
  name: string;
  accent: string;

  /** 액센트 위에 올리는 버튼 텍스트 색. null이면 흰색(#FFFFFF)을 쓴다. */
  accentTextOverride: string | null;
  bgBase: string;
  bgSurface: string;
  textMain: string;
  textSub: string;
  border: string;

  /** 이 팔레트를 추천할 업종 키워드. coral은 기본값이라 비워둔다. */
  targets: string[];
  dark: boolean;
  ok: string;
  warn: string;
  err: string;
}

/*
 * 상태색 공통값 — 원래 500 램프(green-500/amber-500/red-500)였으나 대비 테스트 실측 결과
 * bgBase 대부분(거의 흰색·파스텔)과 3:1을 못 넘어(1.96~2.28) 600으로 내렸다. green-600/
 * red-600은 전 팔레트에서 3:1을 넘지만, amber-600은 coral·purple·pink의 bgBase에서 여전히
 * 2.90~2.94로 미달이라 그 세 팔레트만 WARN_HIGH(amber-700)로 한 단계 더 내린다(brown 팔레트는
 * 액센트 자체가 amber-700이라 warn도 700으로 올리면 같은 팔레트 안에서 액센트=warn이 돼버려
 * 제외 — brown은 amber-600 그대로 둬도 3.05:1로 통과한다).
 */
const OK = '#16a34a'; // green-600
const WARN = '#d97706'; // amber-600
const WARN_HIGH = '#b45309'; // amber-700 — coral/purple/pink 전용
const ERR = '#dc2626'; // red-600

// red·pink는 액센트 자체가 red/rose 계열이라 공통 err와 구분이 잘 안 됨 — red-700으로.
const ERR_ON_RED_FAMILY = '#b91c1c';

// dark는 어두운 배경 위라 밝은 램프가 필요해 400을 쓴다 — 이미 전부 3:1을 넉넉히 넘어 그대로 둔다.
const OK_ON_DARK = '#4ade80';
const WARN_ON_DARK = '#fbbf24';
const ERR_ON_DARK = '#f87171';

export const PALETTES: Palette[] = [
  {
    id: 'coral',
    name: '코랄',
    accent: '#FF5330',

    // 흰 텍스트로는 4.5:1이 안 나와(3.21:1) 어두운 잉크로 — 브랜드 색이라 accent 자체는 안 바꿈.
    accentTextOverride: '#1A1A1A',
    bgBase: '#FBF5EE',
    bgSurface: '#FFFFFF',
    textMain: '#1A1A1A',
    textSub: '#6E645B', // 기존 #7A7067은 bgBase와 4.47:1로 미달 — 5.33:1로 통과하는 값으로 조정
    border: '#EFE4D6',
    targets: [],
    dark: false,
    ok: OK,
    warn: WARN_HIGH, // amber-600(2.94:1)은 미달이라 amber-700
    err: ERR,
  },
  {
    id: 'red',
    name: '레드',
    accent: '#dc2626', // red-600 — red-500(3.76:1)은 흰 버튼 텍스트 대비 미달이라 한 단계 하향
    accentTextOverride: null,
    bgBase: '#f8fafc', // slate-50
    bgSurface: '#FFFFFF',
    textMain: '#0f172a', // slate-900
    textSub: '#475569', // slate-600
    border: '#e2e8f0', // slate-200
    targets: ['푸드', '배달', '모빌리티', '커머스'],
    dark: false,
    ok: OK,
    warn: WARN,
    err: ERR_ON_RED_FAMILY,
  },
  {
    id: 'orange',
    name: '오렌지',
    accent: '#ea580c', // orange-600
    /*
     * orange-600은 흰 텍스트로 3.56:1(미달) — 한 단계 더(orange-700) 내리면 accent가 너무 어두워져,
     * 대신 어두운 잉크로 바꿔 4.89:1로 통과시킨다.
     */
    accentTextOverride: '#1A1A1A',
    bgBase: '#fafafa', // zinc-50
    bgSurface: '#FFFFFF',
    textMain: '#18181b', // zinc-900
    textSub: '#52525b', // zinc-600
    border: '#e4e4e7', // zinc-200
    targets: ['중고거래', '커뮤니티', '라이프스타일'],
    dark: false,
    ok: OK,
    warn: WARN,
    err: ERR,
  },
  {
    id: 'yellow',
    name: '옐로우',
    accent: '#eab308', // yellow-500
    accentTextOverride: '#18181b', // zinc-900 — 밝은 노랑 위 흰 텍스트는 대비가 안 나온다
    bgBase: '#fafafa', // zinc-50
    bgSurface: '#FFFFFF',
    textMain: '#18181b', // zinc-900
    textSub: '#3f3f46', // zinc-700
    border: '#e4e4e7', // zinc-200
    targets: ['메신저', '모빌리티', '키즈', '교육'],
    dark: false,
    ok: OK,
    warn: WARN,
    err: ERR,
  },
  {
    id: 'green',
    name: '그린',
    accent: '#059669', // emerald-600
    /*
     * emerald-600은 흰 텍스트로 3.77:1(미달) — emerald-700로 더 내리면 이 팔레트의 textSub와
     * 값이 겹쳐서(둘 다 emerald-700) 대신 어두운 잉크로 바꿔 4.62:1로 통과시킨다.
     */
    accentTextOverride: '#1A1A1A',
    bgBase: '#ecfdf5', // emerald-50
    bgSurface: '#FFFFFF',
    textMain: '#022c22', // emerald-950
    textSub: '#047857', // emerald-700
    border: '#a7f3d0', // emerald-200
    targets: ['핀테크', '헬스케어', '친환경'],
    dark: false,
    ok: OK,
    warn: WARN,
    err: ERR,
  },
  {
    id: 'blue',
    name: '블루',
    accent: '#2563eb', // blue-600
    accentTextOverride: null,
    bgBase: '#f8fafc', // slate-50
    bgSurface: '#FFFFFF',
    textMain: '#0f172a', // slate-900
    textSub: '#334155', // slate-700
    border: '#e2e8f0', // slate-200
    targets: ['금융', 'B2B', '메디컬'],
    dark: false,
    ok: OK,
    warn: WARN,
    err: ERR,
  },
  {
    id: 'indigo',
    name: '인디고',
    accent: '#4f46e5', // indigo-600 — indigo-500(4.47:1)은 흰 버튼 텍스트 4.5:1 기준 아슬아슬하게 미달
    accentTextOverride: null,
    bgBase: '#f8fafc', // slate-50
    bgSurface: '#FFFFFF',
    textMain: '#1e1b4b', // indigo-950
    textSub: '#3730a3', // indigo-800
    border: '#e2e8f0', // slate-200
    targets: ['개발자툴', '대시보드', '협업'],
    dark: false,
    ok: OK,
    warn: WARN,
    err: ERR,
  },
  {
    id: 'purple',
    name: '퍼플',
    accent: '#7c3aed', // violet-600 — violet-500(4.23:1)은 흰 버튼 텍스트 4.5:1 기준 미달
    accentTextOverride: null,
    bgBase: '#f5f3ff', // violet-50
    bgSurface: '#FFFFFF',
    textMain: '#2e1065', // violet-950
    textSub: '#5b21b6', // violet-800
    border: '#ddd6fe', // violet-200
    targets: ['AI', '엔터', '아트', '멤버십'],
    dark: false,
    ok: OK,
    warn: WARN_HIGH, // amber-600(2.90:1)은 미달이라 amber-700
    err: ERR,
  },
  {
    id: 'pink',
    name: '핑크',
    accent: '#db2777', // rose-600 — rose-500(3.67:1)은 흰 버튼 텍스트 4.5:1 기준 미달
    accentTextOverride: null,
    bgBase: '#fff1f2', // rose-50
    bgSurface: '#FFFFFF',
    textMain: '#111827', // gray-900
    textSub: '#4b5563', // gray-600
    border: '#fecdd3', // rose-200
    targets: ['데이팅', '뷰티', '쇼핑몰'],
    dark: false,
    ok: OK,
    warn: WARN_HIGH, // amber-600(2.90:1)은 미달이라 amber-700
    err: ERR_ON_RED_FAMILY,
  },
  {
    id: 'brown',
    name: '브라운',
    accent: '#b45309', // amber-700
    accentTextOverride: null,
    bgBase: '#fafaf9', // stone-50
    bgSurface: '#FFFFFF',
    textMain: '#451a03', // amber-950
    textSub: '#92400e', // amber-800
    border: '#e7e5e4', // stone-200
    targets: ['카페', '인테리어', '로컬'],
    dark: false,
    ok: OK,
    warn: WARN,
    err: ERR,
  },
  {
    id: 'teal',
    name: '틸',
    accent: '#0f766e', // teal-700 — teal-600(3.74:1)은 흰 버튼 텍스트 4.5:1 기준 미달
    accentTextOverride: null,
    bgBase: '#f0fdfa', // teal-50
    bgSurface: '#FFFFFF',
    textMain: '#0f172a', // slate-900
    textSub: '#334155', // slate-700
    border: '#99f6e4', // teal-200
    targets: ['헬스케어', '예약', '여행'],
    dark: false,
    ok: OK,
    warn: WARN,
    err: ERR,
  },
  {
    id: 'dark',
    name: '다크',
    accent: '#FF5A36', // 코랄레드 브랜드 액센트(다크 변형), Tailwind 아님 — 값 안 바꿈
    // 흰 텍스트로는 4.5:1이 안 나와(3.10:1) 어두운 잉크로.
    accentTextOverride: '#1A1A1A',
    bgBase: '#09090b', // zinc-950
    bgSurface: '#18181b', // zinc-900
    textMain: '#f4f4f5', // zinc-100
    textSub: '#a1a1aa', // zinc-400
    border: '#27272a', // zinc-800
    targets: ['패션', '포트폴리오', 'OTT'],
    dark: true,
    ok: OK_ON_DARK,
    warn: WARN_ON_DARK,
    err: ERR_ON_DARK,
  },
  {
    id: 'minimal',
    name: '미니멀',
    accent: '#18181b', // zinc-900
    accentTextOverride: '#FFFFFF',
    bgBase: '#FFFFFF',
    bgSurface: '#fafafa', // zinc-50
    textMain: '#09090b', // zinc-950
    textSub: '#71717a', // zinc-500
    border: '#e4e4e7', // zinc-200
    /*
     * 무채 화면에서 공통 상태색(초록/주황/빨강)만 유채로 튄다 — 미니멀 팔레트 특유의 절제된 톤과
     * 안 맞을 수 있어 향후 조정 후보로 남겨둔다. 지금은 공통값 그대로 쓴다.
     */
    targets: ['아티클', '메모', '갤러리'],
    dark: false,
    ok: OK,
    warn: WARN,
    err: ERR,
  },
];

const PALETTES_BY_ID: Record<PaletteId, Palette> = Object.fromEntries(
  PALETTES.map((palette) => [palette.id, palette]),
) as Record<PaletteId, Palette>;

export function getPalette(id: PaletteId): Palette {
  return PALETTES_BY_ID[id];
}

/**
 * 업종 문자열을 targets에 매칭해 팔레트 1~2개를 추천한다(부분 문자열 양방향 매칭). coral은
 * targets가 비어있는 기본값이라 매칭 대상에서 제외하고, 아무것도 안 맞으면 coral로 폴백한다.
 */
export function recommendPalette(industry: string): PaletteId[] {
  const normalized = industry.trim();

  if (!normalized) {
    return ['coral'];
  }

  const matches: PaletteId[] = [];

  for (const palette of PALETTES) {
    if (palette.id === 'coral') {
      continue;
    }

    const hit = palette.targets.some((target) => normalized.includes(target) || target.includes(normalized));

    if (hit) {
      matches.push(palette.id);
    }

    if (matches.length >= 2) {
      break;
    }
  }

  return matches.length > 0 ? matches : ['coral'];
}

/**
 * 현재 활성 팔레트. 항상 coral을 반환한다 — 팔레트 선택 기능은 아직 시스템 프롬프트에 연결되지
 * 않았고(이번 라운드 범위 아님), 이 함수는 그 연결 지점만 미리 배선해두는 용도다. 동작 변경 없음.
 */
export function getActivePalette(): Palette {
  return PALETTES_BY_ID.coral;
}
