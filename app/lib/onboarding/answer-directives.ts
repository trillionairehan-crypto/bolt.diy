/**
 * 온보딩 5문항(Q1~Q5) 답변을 구체적인 생성 지시문으로 바꾼다. "질문: 답변" 텍스트를 그대로 붙이는 게
 * 아니라, 실제 코드 훅(connectSupabase, 골격·관점 강제)이 있는 것만 구조화하고 나머지는 자연어
 * 문장으로 표현한다.
 *
 * Q4(연동)는 여기서 다루지 않는다 — DB에만 저장되는 수요조사 문항이라 지시문·프롬프트·생성물 어디로도
 * 흐르지 않는다(별도 요구사항). Q5(색)도 여기서 다루지 않는다 — app/lib/palettes.ts의 activePaletteId
 * 아톰으로 흐르고, getActivePalette()가 이미 designSchemeToHue()의 폴백 경로에 배선돼 있어 시스템
 * 프롬프트나 이 지시문 체계를 거칠 필요가 없다.
 */

import {
  SKELETON_DEFAULT_PERSPECTIVE,
  SKELETON_NAMES,
  type Q1Value,
  type Q2Value,
  type SkeletonId,
} from './question-bank';

export interface GenerationDirectives {
  /** Natural-language lines appended to the prompt under "추가로 알려주신 내용:". */
  promptAdditions: string[];

  /**
   * Whether the generated app should use Supabase at all. Undefined = no opinion (defer to
   * new-prompt.ts's own "don't add auth unless it's actually needed" judgment).
   */
  connectSupabase?: boolean;

  /**
   * OKLCH hue (0-359) for the design kit's --hue token. Undefined = keep whatever
   * getActivePalette() currently resolves to (coral by default, or the Q5 selection).
   * No current onboarding answer sets this — kept for backward compatibility with
   * hueToRepresentativeHex/Chat.client.tsx's designSchemeOverride wiring.
   */
  hue?: number;
}

const EMPTY: Partial<GenerationDirectives> = {};

/**
 * Q1(누가 쓰나요) + Q3에서 정해진 골격을 합쳐 "골격: X / 사용자 관점: Y" 한 줄을 만든다.
 * <app_skeletons>의 "사용자 요청에 관점이 명시되면 그것을 따른다" 규칙이 이 줄을 그대로 읽게
 * 설계했다 — 골격 이름은 new-prompt.ts의 표기와 정확히 일치해야 한다(SKELETON_NAMES 참고).
 *
 * Q1 답과 골격 기본 관점이 다를 때: 골격 기본이 방문자가 아닌데 Q1이 "손님·고객도 써요"(방문자)면
 * 대체가 아니라 추가로 포함시킨다(예: 기록·추이형은 원래 본인 전용이지만 손님도 쓴다면 방문자 화면도
 * 필요하다는 뜻이지, 본인용 화면을 없애라는 뜻이 아니다). 그 외의 불일치는 Q1이 그대로 관점을
 * 대체한다.
 */
export function buildSkeletonAndPerspectiveDirective(q1: Q1Value, skeleton: SkeletonId | null): string {
  const q1Perspective = Q1_TO_PERSPECTIVE[q1];

  if (!skeleton) {
    return `사용자 관점: ${q1Perspective}`;
  }

  const skeletonName = SKELETON_NAMES[skeleton];
  const skeletonDefault = SKELETON_DEFAULT_PERSPECTIVE[skeleton];

  if (q1Perspective === skeletonDefault) {
    return `골격: ${skeletonName} / 사용자 관점: ${skeletonDefault}`;
  }

  if (q1Perspective === '방문자' && skeletonDefault !== '방문자') {
    return `골격: ${skeletonName} / 사용자 관점: ${skeletonDefault} 기준으로 만들되, 손님·고객도 쓰는 방문자용 화면을 추가로 포함하세요.`;
  }

  return `골격: ${skeletonName} / 사용자 관점: ${q1Perspective} (사용자가 직접 밝힌 관점이므로 이 골격의 기본 관점(${skeletonDefault}) 대신 이 관점을 따르세요.)`;
}

const Q1_TO_PERSPECTIVE: Record<Q1Value, '관리자' | '본인' | '방문자'> = {
  solo: '본인',
  team: '관리자',
  public: '방문자',
};

export function mapQ2ToDirectives(value: Q2Value): Partial<GenerationDirectives> {
  switch (value) {
    case 'cloud':
      return {
        promptAdditions: [
          '데이터 저장은 코랄레드 Cloud(기본 저장 방식)를 씁니다 — 로그인 없이 기기와 무관하게 저장돼요.',
        ],
      };
    case 'none':
      return {
        connectSupabase: false,
        promptAdditions: [
          '이 앱은 데이터를 저장할 필요가 없어요. 저장 SDK도 Supabase도 쓰지 말고, 필요한 상태는 컴포넌트 state로만 관리하는 클라이언트 전용 앱으로 만들어주세요.',
        ],
      };
    case 'supabase':
      return {
        promptAdditions: [
          '사용자가 자기 Supabase 프로젝트를 연결해서 쓰고 싶어해요. 아직 연결 전이라면 화면 상단의 "저장 기능 켜기"를 눌러 연결하라고 답변에서 짧게 안내하세요. 이미 연결됐다면 Supabase 인증과 RLS로 실제 저장 구조를 만드세요.',
        ],
      };
    default:
      return EMPTY;
  }
}

export function mergeDirectives(parts: Array<Partial<GenerationDirectives>>): GenerationDirectives {
  const result: GenerationDirectives = { promptAdditions: [] };

  for (const part of parts) {
    if (part.promptAdditions) {
      result.promptAdditions.push(...part.promptAdditions);
    }

    if (part.connectSupabase !== undefined) {
      result.connectSupabase = part.connectSupabase;
    }

    if (part.hue !== undefined) {
      result.hue = part.hue;
    }
  }

  return result;
}

/**
 * The only hue value any onboarding answer could ever produce historically (the old 'mood'
 * question's 'friendly' case, now removed). Kept only so Chat.client.tsx's existing
 * designSchemeOverride wiring (directives.hue !== undefined -> hueToRepresentativeHex(hue))
 * keeps compiling — no current answer sets GenerationDirectives.hue, so this branch is
 * currently dead code, not a regression risk.
 */
const HUE_REPRESENTATIVE_HEX: Record<number, string> = {
  33: '#FF5330',
};

export function hueToRepresentativeHex(hue: number): string | undefined {
  return HUE_REPRESENTATIVE_HEX[hue];
}
