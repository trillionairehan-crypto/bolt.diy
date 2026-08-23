/**
 * Turns question-bank.ts answers into concrete generation directives, instead of just gluing
 * "질문: 답변" text onto the prompt (the old PromptClarification.tsx behavior). Kept as pure
 * functions, separate from the question data and from the UI, so a new question only needs a
 * new case here — no restructuring.
 *
 * Only `hue` has a real pre-generation code hook today (designSchemeToHue's injection into the
 * template — see hueToRepresentativeHex below and its use in Chat.client.tsx). `connectSupabase`
 * has no separate mechanism to plug into beyond the prompt itself — there's no "toggle Supabase
 * on/off" hook in the generation pipeline independent of what the LLM is told to build — so its
 * real effect is still through promptAdditions; the boolean is kept structured for whatever
 * later needs to branch on it (e.g. skipping a "Supabase 연결하세요" nudge elsewhere).
 */

export interface GenerationDirectives {
  /** Natural-language lines appended to the prompt under "추가로 알려주신 내용:". */
  promptAdditions: string[];

  /**
   * Whether the generated app should use Supabase at all. Undefined = no opinion (defer to
   * new-prompt.ts's own "don't add auth unless it's actually needed" judgment).
   */
  connectSupabase?: boolean;

  /** OKLCH hue (0-359) for the design kit's --hue token. Undefined = keep the brand default. */
  hue?: number;
}

const TRUST_HUE = 222; // calm teal-blue — see hueToRepresentativeHex for the hex this decodes from
const FRIENDLY_HUE = 33; // brand default (#FF5330), matches paletteToHue.ts's CORALRED_DEFAULT_HUE

const EMPTY: Partial<GenerationDirectives> = {};

/**
 * Per-question, per-option mapping. "잘 모르겠어요" (value === null) and any option not listed
 * here fall through to the default case, which is intentionally EMPTY for every question right
 * now — see the per-case comments for why silence (deferring to the base prompt/existing
 * new-prompt.ts judgment) is the correct behavior in this phase, not a guessed default. A real
 * app-type-specific default would replace these once a type classifier exists.
 */
export function mapAnswerToDirectives(questionId: string, value: unknown): Partial<GenerationDirectives> {
  switch (questionId) {
    case 'audience':
      switch (value) {
        case 'solo':
          return {
            promptAdditions: [
              '이 앱은 만드는 사람 본인만 써요 — 온보딩이나 도움말 문구는 최소화하고 핵심 기능에 집중하세요. 본인만 쓰는 만큼 항목을 추가·수정·삭제하는 관리 기능도 자연스럽게 포함하세요.',
            ],
          };
        case 'team':
          return {
            promptAdditions: [
              '팀 내부에서 함께 쓸 앱이에요 — 담당자 표시, 활동 이력처럼 여러 사용자를 구분하는 요소를 자연스럽게 고려하세요. 팀만 쓰는 만큼 항목을 추가·수정·삭제하는 관리 기능도 자연스럽게 포함하세요.',
            ],
          };
        case 'public':
          return {
            promptAdditions: [
              '일반 고객이 쓰는 앱이에요 — 처음 보는 사람도 바로 이해할 수 있게 문구와 흐름을 더 친절하고 명확하게 만드세요.',
            ],
          };
        default:
          /*
           * Unsure — no safe app-wide default audience exists; guessing risks contradicting
           * what the user's own request already implied.
           */
          return EMPTY;
      }

    case 'persistence':
      switch (value) {
        case 'withAuth':
          return {
            connectSupabase: true,
            promptAdditions: [
              '사용자별로 로그인해서 자기 데이터를 저장하고 관리하는 구조로 만들어주세요. Supabase 인증과 RLS를 사용하세요.',
            ],
          };
        case 'withoutAuth':
          return {
            connectSupabase: true,
            promptAdditions: [
              '로그인 없이도 데이터가 저장되는 구조로 만들어주세요 (공용 데이터 또는 기기별 로컬 저장과 Supabase 동기화).',
            ],
          };
        case 'none':
          return {
            connectSupabase: false,
            promptAdditions: [
              '이 앱은 데이터를 서버에 저장할 필요가 없어요. Supabase를 연결하지 말고, 필요한 상태는 컴포넌트 state로만 관리하는 클라이언트 전용 앱으로 만들어주세요.',
            ],
          };
        default:
          /*
           * Unsure — deliberately don't set connectSupabase at all, so new-prompt.ts's existing
           * "don't add auth unless the app actually needs per-user data" rule keeps deciding,
           * instead of a guessed default overriding an already-reasonable judgment.
           */
          return EMPTY;
      }

    case 'device':
      switch (value) {
        case 'mobile':
          return {
            promptAdditions: [
              '모바일에서 주로 사용될 앱이에요 — 터치하기 편한 큰 버튼, 세로 레이아웃, 하단 고정 액션 버튼처럼 모바일 우선 UI로 만들어주세요.',
            ],
          };
        case 'desktop':
          return {
            promptAdditions: [
              '데스크톱에서 주로 사용될 앱이에요 — 사이드바, 다단 구성처럼 넓은 화면을 활용한 레이아웃을 고려해도 좋아요.',
            ],
          };
        default:
          // 'both' and unsure both mean "no bias" — the baseline is already responsive.
          return EMPTY;
      }

    case 'mood':
      switch (value) {
        case 'trust':
          return { hue: TRUST_HUE };
        case 'friendly':
          return { hue: FRIENDLY_HUE };
        case 'minimal':
          /*
           * The kit's --accent chroma is fixed in CSS (design-handoff/coralred-ui.css), only hue
           * is a variable — there's no way to make it read as "desaturated" through --hue alone,
           * so minimal stays a prompt instruction instead of a hue value.
           */
          return { promptAdditions: ['액센트 색 사용을 최소화하고, 강조가 꼭 필요한 곳에만 쓰세요.'] };
        default:
          return EMPTY;
      }

    default:
      return EMPTY;
  }
}

/**
 * Cross-question adjustments that don't fit a single question's independent mapping. No active
 * rules right now — the one rule this existed for (audience solo/team + coreAction) was folded
 * directly into the 'audience' case above after coreAction (Q2) was removed from the fixed bank.
 * Kept as a real call site (see PromptClarification.tsx) so a future cross-question rule doesn't
 * need any restructuring to add.
 */
export function combineDirectives(_answerValues: Record<string, unknown>): Partial<GenerationDirectives> {
  return EMPTY;
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
 * The only two hue values mapAnswerToDirectives ever produces right now. designSchemeToHue
 * (paletteToHue.ts) only reads DesignScheme.palette.primary as a hex color and derives the hue
 * from it — there's no direct "set this hue" entry point — so this is the representative hex
 * for each, verified against the real hexToOklchHue conversion (33 matches the brand default's
 * own documented hex #FF5330; 222 is #0891B2, chosen because it decodes to ~220 as intended).
 * A lookup table (not a general hue->hex inverse) is enough since only these two values exist.
 */
const HUE_REPRESENTATIVE_HEX: Record<number, string> = {
  [FRIENDLY_HUE]: '#FF5330',
  [TRUST_HUE]: '#0891B2',
};

export function hueToRepresentativeHex(hue: number): string | undefined {
  return HUE_REPRESENTATIVE_HEX[hue];
}
