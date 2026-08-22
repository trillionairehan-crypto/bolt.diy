import type { ProviderInfo } from '~/types/model';
import { PROVIDER_LIST } from './constants';
import type { ClarifyQuestionDef } from '~/lib/onboarding/question-bank';

/**
 * Generates 0-2 app-specific clarifying questions per request, run in parallel with the fixed
 * question bank (question-bank.ts) by PromptClarification.tsx. The fixed bank covers what's the
 * same for every app (audience, persistence, device, tone); this covers what's specific to THIS
 * app idea and would actually change its screens/data/core flow — e.g. "주식/코인/외환?" for a
 * trading bot request, which the fixed bank has no way to ask.
 *
 * Replaces the old clarifyPrompt() (2 always-generated, generic questions with no relation to
 * the fixed bank) — see the system prompt below for the rubric this now follows.
 */

export const APP_QUESTIONS_MODEL = 'claude-haiku-4-5';
export const APP_QUESTIONS_PROVIDER_NAME = 'Anthropic';

const MAX_QUESTIONS = 2;
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 4;

const appQuestionsSystemPrompt = `
당신은 사용자의 앱 아이디어를 읽고, "답이 달라지면 이 앱의 화면 구성이나 핵심 데이터, 주요 흐름이 실제로 달라지는" 질문만 골라내는 프로덕트 디자이너입니다.

이미 별도로 물어보고 있으니 아래 주제는 절대 질문하지 마세요:
- 데이터 저장 여부, 로그인 여부
- 주로 쓰는 기기 (모바일/데스크톱)
- 디자인 톤/분위기

규칙:
- 사용자의 원문에 이미 답이 나와있는 질문은 만들지 마세요. (예: "재고 관리 앱"이라고 이미 말했는데 "무엇을 관리하나요?"를 다시 묻지 마세요.)
- 질문은 이 특정 앱 아이디어에 대해 진짜 궁금한 것이어야 합니다. 어떤 앱에도 붙일 수 있는 뻔한 질문은 만들지 마세요.
- 비개발자가 3초 안에 이해하고 고를 수 있어야 합니다 — 전문 용어, 애매한 표현 금지.
- 선택지는 2~4개, 짧고 구체적이고 서로 겹치지 않아야 합니다.
- 각 질문의 첫 번째 선택지는 이 아이디어에 가장 무난하게 어울리는 추천 답이어야 합니다 — 사용자가 잘 몰라서 그냥 첫 번째를 눌러도 자연스럽게 말이 되도록 순서를 정하세요.
- 최대 ${MAX_QUESTIONS}개까지만 만드세요. 1개나 0개도 완전히 정상입니다.
- 프롬프트가 이미 충분히 구체적이라 더 물어볼 게 없다면, 빈 배열을 반환하는 게 정답입니다. 억지로 질문을 만들지 마세요.

좋은 예 — "AI 자동 트레이딩 봇 만들어줘":
[
  { "question": "어떤 자산을 매매하나요?", "options": ["암호화폐", "주식", "외환(FX)"] },
  { "question": "매매 방식은 어떻게 되나요?", "options": ["자동으로 바로 체결", "신호만 주고 사람이 최종 확인"] }
]
→ 좋은 이유: 자산 종류에 따라 시세 표시 방식과 데이터 모델이 실제로 달라지고, 자동/반자동 여부에 따라 확인 버튼 같은 화면 요소가 실제로 달라짐.

나쁜 예 — 같은 요청에 대해:
[
  { "question": "로그인 기능이 필요한가요?", "options": ["예", "아니오"] },
  { "question": "모바일에서도 쓰실 건가요?", "options": ["예", "아니오"] }
]
→ 나쁜 이유: 둘 다 고정 질문에서 이미 다루는 주제라서 절대 만들면 안 됨.

좋은 예 — "우리 동네 빵집 홈페이지 만들어줘, 신메뉴 소개랑 위치 안내가 있으면 좋겠어":
[]
→ 좋은 이유: 핵심 화면(신메뉴 소개, 위치 안내)이 이미 구체적으로 나와있어서 더 물어볼 게 없음. 빈 배열이 정답.

응답 형식: 순수 JSON 배열만 응답하세요, 마크다운 코드펜스나 설명 없이. 정확한 형태:
[
  { "question": "...", "options": ["...", "...", "..."] }
]
`;

type RawAppQuestion = { question: string; options: string[] };

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);

  return fenced ? fenced[1].trim() : trimmed;
}

function isValidRawQuestions(value: unknown): value is RawAppQuestion[] {
  if (!Array.isArray(value) || value.length > MAX_QUESTIONS) {
    return false;
  }

  return value.every(
    (item) =>
      item &&
      typeof item.question === 'string' &&
      item.question.trim().length > 0 &&
      Array.isArray(item.options) &&
      item.options.length >= MIN_OPTIONS &&
      item.options.length <= MAX_OPTIONS &&
      item.options.every((option: unknown) => typeof option === 'string' && option.trim().length > 0),
  );
}

/**
 * Converts one LLM-returned {question, options} pair into a full ClarifyQuestionDef. isDynamic
 * and the "잘 모르겠어요" option are added here in code, not left to the LLM to remember — the
 * same reasoning as question-bank.ts's fixed questions: a structural UI requirement shouldn't
 * depend on prompt compliance when the code can just guarantee it.
 */
function toClarifyQuestionDef(raw: RawAppQuestion, index: number): ClarifyQuestionDef {
  return {
    id: `dynamic-${index}`,
    question: raw.question,
    isDynamic: true,
    options: [
      ...raw.options.map((label, optionIndex) => ({ id: `opt-${optionIndex}`, label, value: label })),
      { id: 'unsure', label: '잘 모르겠어요', value: null, isUnsure: true },
    ],
  };
}

export async function generateAppQuestions(userPrompt: string): Promise<ClarifyQuestionDef[] | null> {
  const provider = PROVIDER_LIST.find((p) => p.name === APP_QUESTIONS_PROVIDER_NAME) as ProviderInfo | undefined;

  if (!provider) {
    return null;
  }

  try {
    const response = await fetch('/api/llmcall', {
      method: 'POST',
      body: JSON.stringify({
        message: userPrompt,
        model: APP_QUESTIONS_MODEL,
        provider,
        system: appQuestionsSystemPrompt,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const { text } = (await response.json()) as { text: string };
    const parsed = JSON.parse(stripCodeFences(text));

    if (!isValidRawQuestions(parsed)) {
      return null;
    }

    return parsed.map((raw, index) => toClarifyQuestionDef(raw, index));
  } catch (error) {
    console.error('Error generating app-specific questions:', error);
    return null;
  }
}
