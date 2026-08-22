/**
 * Fixed clarifying-question bank for first-message onboarding. Answers map to concrete
 * generation directives (see answer-directives.ts) instead of free text glued onto the prompt.
 * Runs alongside generateAppQuestions.ts (see PromptClarification.tsx), which generates 0-2
 * app-specific questions in parallel — those use this same ClarifyQuestionDef shape (marked
 * isDynamic: true) but are answered as free text, not directive-mapped, since their ids are
 * arbitrary and app-specific rather than one of the fixed cases answer-directives.ts knows about.
 *
 * Kept deliberately data-only: adding a fixed question is adding an entry here (+ a case in
 * answer-directives.ts), never a change to how PromptClarification.tsx renders or sequences
 * questions.
 */

/** Not populated by any question yet — the extension point for a future app-type classifier to
 * select a different/extra question set. Every question below applies to every type today
 * (appliesTo omitted), so selectQuestions() currently just returns the whole bank unfiltered. */
export type AppTypeTag = 'ecommerce' | 'booking' | 'community' | 'portfolio' | 'tool';

export interface ClarifyOption<TValue = unknown> {
  /** Stable machine key, e.g. 'solo'. Used for the "custom text" escape hatch: id 'custom'. */
  id: string;
  /** Korean button label. */
  label: string;
  /** Structured value answer-directives.ts's mapAnswerToDirectives consumes. null for "unsure". */
  value: TValue;
  /** Marks the "잘 모르겠어요" option so the UI can render it distinctly (last, muted). */
  isUnsure?: boolean;
}

export interface ClarifyQuestionDef<TValue = unknown> {
  id: string;
  question: string;
  options: ClarifyOption<TValue>[];
  /** undefined = common question, always included. See AppTypeTag. */
  appliesTo?: AppTypeTag[];
  /** Set (by generateAppQuestions.ts, not the LLM) on app-specific questions generated per
   * request. Tells buildFinalPromptAndDirectives in PromptClarification.tsx to synthesize the
   * answer as free text instead of routing it through answer-directives.ts's fixed-id switch. */
  isDynamic?: boolean;
}

export const QUESTION_BANK: ClarifyQuestionDef[] = [
  {
    id: 'audience',
    question: '이 앱은 주로 누가 쓰게 될까요?',
    options: [
      { id: 'solo', label: '나만 써요', value: 'solo' },
      { id: 'team', label: '팀 내부에서 써요', value: 'team' },
      { id: 'public', label: '일반 고객이 써요', value: 'public' },
      { id: 'unsure', label: '잘 모르겠어요', value: null, isUnsure: true },
    ],
  },
  {
    id: 'persistence',
    question: '데이터를 저장해야 하나요?',
    options: [
      { id: 'withAuth', label: '저장 필요해요 (로그인 포함)', value: 'withAuth' },
      { id: 'withoutAuth', label: '저장 필요해요 (로그인 없이)', value: 'withoutAuth' },
      { id: 'none', label: '저장 필요 없어요', value: 'none' },
      { id: 'unsure', label: '잘 모르겠어요', value: null, isUnsure: true },
    ],
  },
  {
    id: 'device',
    question: '주로 어디서 보게 될까요?',
    options: [
      { id: 'mobile', label: '모바일', value: 'mobile' },
      { id: 'desktop', label: '데스크톱', value: 'desktop' },
      { id: 'both', label: '둘 다', value: 'both' },
      { id: 'unsure', label: '잘 모르겠어요', value: null, isUnsure: true },
    ],
  },
  {
    id: 'mood',
    question: '어떤 분위기였으면 좋겠어요?',
    options: [
      { id: 'trust', label: '차분하고 신뢰감 있게', value: 'trust' },
      { id: 'friendly', label: '밝고 친근하게', value: 'friendly' },
      { id: 'minimal', label: '미니멀하게', value: 'minimal' },
      { id: 'unsure', label: '잘 모르겠어요', value: null, isUnsure: true },
    ],
  },
];

export function selectQuestions(appType: AppTypeTag | undefined, bank: ClarifyQuestionDef[] = QUESTION_BANK) {
  return bank.filter((q) => !q.appliesTo || (appType !== undefined && q.appliesTo.includes(appType)));
}
