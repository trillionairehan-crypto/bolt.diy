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

import { SKELETON_NAMES, type Q1Value, type Q2Value, type SkeletonId } from './question-bank';

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

  /** Q3에서 정해진 골격 기본값 — 골격 7이면 이미지 세트 생성을 미리 시작하는 데 쓴다. */
  skeleton?: SkeletonId | null;

  /** 업종 라벨(격자 항목 이름) 또는 직접 입력 원문 — 이미지 프롬프트 재료. */
  industry?: string;
}

const EMPTY: Partial<GenerationDirectives> = {};

/**
 * Q1(누가 쓰나요) 답은 사용자가 직접 밝힌 사실이라 무조건 강제한다 — 골격이 무엇으로 정해지든 이
 * 관점을 따라야 한다. skeletonDefault를 참조하지 않는 이유: 골격 자체가 이제 기본값일 뿐 강제가
 * 아니라서(아래 buildSkeletonAndPerspectiveDirective 참고), 실제로 어느 골격이 쓰일지 directive
 * 생성 시점엔 알 수 없다 — 그래서 "이 골격이 관리자·본인 전용이면"처럼 조건부로, 어떤 골격이 와도
 * 맞게 쓴다.
 */
const Q1_PERSPECTIVE_DIRECTIVE: Record<Q1Value, string> = {
  solo: '사용자 관점: 본인 — 만드는 사람 혼자 씁니다.',
  team: '사용자 관점: 관리자 — 관리자·직원이 관리합니다.',
  public:
    '사용자 관점: 이 골격이 원래 관리자·본인 전용이면 그 관점은 유지한 채 손님·고객이 쓰는 방문자용 화면을 추가로 포함하고, 원래 방문자 관점이면 방문자 기준 그대로 만드세요.',
};

/**
 * Q1(누가 쓰나요) + Q3에서 정해진 업종의 골격을 지시문 줄들로 만든다.
 *
 * 실측 1차(2026-09-04, 헬스장 시나리오): "골격: X"를 강제 문구로 두면 "헬스장 예약 앱"처럼 요청 자체가
 * 다른 골격(예약·일정형)을 명확히 말하고 있는데도 업종 기반 기본값(명단·잔액형)이 요청을 덮어써
 * 버리는 문제가 있었다 — 업종은 어디까지나 힌트지 요청 자체보다 우선할 수 없다.
 *
 * 실측 2차(2026-09-04): "요청이 다른 골격을 더 명확히 가리키면 그 요청을 따르고, 모호하면 이
 * 기본값을 쓴다"는 조건부 서술문으로 1차 수정했지만 여전히 실패했다 — "헬스장 예약 앱"→명단·잔액형,
 * "카페 포인트 적립 앱"→소개·홍보형(둘 다 기본값 그대로, 요청의 명확한 신호를 무시함). 서술문은
 * 모델이 "판단 후 조건 적용"을 실제로 수행하게 만들지 못했다. 그래서 순서를 명시하는 절차문으로 다시
 * 바꿨다 — "먼저 요청 문장만 보고 판단, 근거가 없을 때만 기본값" 순서를 1)2)로 못박는다. Q1의 사용자
 * 관점 줄은 그대로 강제 유지한다 — 이건 업종 추측이 아니라 사용자가 실제로 답한 사실이기 때문이다.
 *
 * 골격 이름은 new-prompt.ts <app_skeletons>의 표기와 정확히 일치해야 한다(SKELETON_NAMES 참고).
 */
export function buildSkeletonAndPerspectiveDirective(q1: Q1Value, skeleton: SkeletonId | null): string[] {
  const perspectiveLine = Q1_PERSPECTIVE_DIRECTIVE[q1];

  if (!skeleton) {
    return [perspectiveLine];
  }

  const skeletonName = SKELETON_NAMES[skeleton];
  const skeletonLine = `골격 기본값(최후 순위): ${skeletonName} — 판단 순서: 1) 먼저 사용자가 실제로 쓴 요청 문장만 보고 골격을 정하세요. 문장에 골격을 가리키는 핵심 명사(예: 예약, 적립, 순위)가 있으면 이 기본값과 달라도 그 문장을 따르세요. 2) 문장에 그런 근거가 전혀 없을 때만 이 기본값을 쓰세요.`;

  return [skeletonLine, perspectiveLine];
}

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

    if (part.skeleton !== undefined) {
      result.skeleton = part.skeleton;
    }

    if (part.industry !== undefined) {
      result.industry = part.industry;
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
