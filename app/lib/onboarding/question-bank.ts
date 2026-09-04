/**
 * 온보딩 설문 5문항의 데이터 정의 — 순수 데이터만 담는다(구조/렌더링은 PromptClarification.tsx,
 * 답변→지시문 변환은 answer-directives.ts). 2026-09 전면 개편: 기존 고정 4문항(사용자/저장/기기/
 * 분위기) + Haiku 동적질문 0~2개 구조를 폐기하고, 골격 매칭·팔레트·연동 수요조사까지 실제로 연결되는
 * 5문항(Q1 사용자, Q2 저장, Q3 업종, Q4 연동, Q5 색)으로 바꿨다.
 */

import type { PaletteId } from '~/lib/palettes';

// --- 골격 7종 — new-prompt.ts <app_skeletons>의 표기와 정확히 일치해야 한다 ---

export type SkeletonId = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const SKELETON_NAMES: Record<SkeletonId, string> = {
  1: '명단·차감형',
  2: '예약·일정형',
  3: '거래·수지형',
  4: '목록·상세형',
  5: '기록·추이형',
  6: '순위·티어형',
  7: '소개·홍보형',
};

export type UserPerspective = '관리자' | '본인' | '방문자';

/** new-prompt.ts가 골격별로 이미 정의한 기본 사용자 관점 — 골격 1·2=관리자, 3·5·6=본인, 4·7=방문자. */
export const SKELETON_DEFAULT_PERSPECTIVE: Record<SkeletonId, UserPerspective> = {
  1: '관리자',
  2: '관리자',
  3: '본인',
  4: '방문자',
  5: '본인',
  6: '본인',
  7: '방문자',
};

// --- Q1. 누가 쓰나요 ---

export type Q1Value = 'solo' | 'team' | 'public';

export interface Q1Option {
  id: Q1Value;
  label: string;
  perspective: UserPerspective;
}

export const Q1_OPTIONS: Q1Option[] = [
  { id: 'solo', label: '나 혼자 써요', perspective: '본인' },
  { id: 'team', label: '나와 직원이 관리해요', perspective: '관리자' },
  { id: 'public', label: '손님·고객도 써요', perspective: '방문자' },
];

// --- Q2. 데이터를 저장할까요 ---

export type Q2Value = 'cloud' | 'none' | 'supabase';

export interface Q2Option {
  id: Q2Value;
  label: string;
}

export const Q2_OPTIONS: Q2Option[] = [
  { id: 'cloud', label: '코랄레드 Cloud로 저장' },
  { id: 'none', label: '저장 없이 만들기 (샘플 데이터 모드)' },
  { id: 'supabase', label: '내 Supabase 연결 (고급)' },
];

// --- Q3. 어떤 일을 하시나요 (격자 + 직접 입력) ---

export interface Q3GridItem {
  id: string;
  label: string;
  skeleton: SkeletonId;

  /** 이 업종을 선택했을 때 Q5에서 상단에 "추천" 배지로 띄울 팔레트 1~2개. */
  recommendedPalettes: PaletteId[];
}

/*
 * 실측 근거는 app.lib.onboarding 조사 보고 참고 — 최대한 new-prompt.ts <app_skeletons>가 각
 * 골격 설명에 이미 적어둔 예시 업종(괄호 안 목록)과 글자 그대로 겹치는 항목을 우선 매칭했다:
 * 학원·헬스→명단·차감형("학원", "헬스장" 골격1 예시), 미용·병원→예약·일정형("미용실", "병원" 골격2
 * 예시), 쇼핑·부동산→목록·상세형("쇼핑", "부동산" 골격4 예시), 프리랜서→거래·수지형("정산" 골격3
 * 예시), 개인 기록→기록·추이형(카테고리명 자체가 "기록"과 직결, "습관" 골격5 예시). 카페·음식점은
 * 골격1 예시에도 "카페 적립"이 있지만, 이번 세션 실측(골격 7 검증 라운드 다수가 카페·빵집 프롬프트로
 * 진행됨)과 "가게 소개" 수요가 더 흔하다고 판단해 소개·홍보형으로 뒀다. 모임·동호회는 직접 겹치는
 * 예시가 없어 "게임 티어표"(골격6 예시)와 구조적으로 가장 가까운 순위·티어형으로 배정했다 — 근거가
 * 가장 약한 항목.
 */
export const Q3_GRID: Q3GridItem[] = [
  { id: 'cafe', label: '카페·음식점', skeleton: 7, recommendedPalettes: ['brown'] },
  { id: 'beauty', label: '미용·뷰티', skeleton: 2, recommendedPalettes: ['pink'] },
  { id: 'academy', label: '학원·교육', skeleton: 1, recommendedPalettes: ['yellow'] },
  { id: 'fitness', label: '헬스·운동', skeleton: 1, recommendedPalettes: ['green'] },
  { id: 'clinic', label: '병원·의원', skeleton: 2, recommendedPalettes: ['teal'] },
  { id: 'shopping', label: '쇼핑·판매', skeleton: 4, recommendedPalettes: ['red'] },
  { id: 'realestate', label: '공간·부동산', skeleton: 4, recommendedPalettes: ['blue'] },
  { id: 'freelance', label: '프리랜서·서비스', skeleton: 3, recommendedPalettes: ['indigo'] },
  { id: 'club', label: '모임·동호회', skeleton: 6, recommendedPalettes: ['purple'] },
  { id: 'personal', label: '개인 기록(가계부·습관)', skeleton: 5, recommendedPalettes: ['coral'] },
];

export const Q3_CUSTOM_OPTION_ID = 'custom';

// --- Q4. 필요한 연동 (다중 선택, 수요조사 전용 — DB 저장만, 지시문/프롬프트/생성물로 흐르지 않는다) ---

export interface Q4Category {
  id: string;
  label: string;
}

export const Q4_CATEGORIES: Q4Category[] = [
  { id: 'auth', label: '인증 (소셜 로그인·본인인증)' },
  { id: 'payment', label: '결제 (PG)' },
  { id: 'notification', label: '알림 (알림톡·SMS)' },
  { id: 'tax', label: '세금·행정 (홈택스)' },
  { id: 'location', label: '위치·지도' },
  { id: 'storage', label: '파일 보관' },
];

// --- Q5. 색 (팔레트 카드) — 옵션은 app/lib/palettes.ts의 PALETTES 13종을 그대로 쓴다 ---
