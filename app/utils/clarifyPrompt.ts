import type { ProviderInfo } from '~/types/model';
import { PROVIDER_LIST } from './constants';

export const CLARIFY_MODEL = 'claude-haiku-4-5';
export const CLARIFY_PROVIDER_NAME = 'Anthropic';

export type ClarifyQuestion = {
  question: string;
  options: string[];
};

const QUESTION_COUNT = 2;
const MIN_OPTIONS = 3;
const MAX_OPTIONS = 4;

const clarifyPromptSystemPrompt = `
You are a senior product manager who asks sharp, concrete clarifying questions before a developer starts building an app from a user's request.

Given the user's request below, write exactly ${QUESTION_COUNT} clarifying questions that would most change how the app should be built. Each question must have ${MIN_OPTIONS} to ${MAX_OPTIONS} short, concrete answer options.

Rules:
- Write the questions and options in natural, conversational Korean, the way a Korean product manager would talk to a client. Avoid stiff, translated-sounding phrasing.
- Each question must be about a decision that meaningfully changes the resulting app (target users, core feature priority, tone/style, scope, etc.), not something trivial.
- Each option must be short (a few words), concrete, and mutually distinct.
- Do not ask about technology choices (frameworks, languages, hosting) — the user is not a developer.
- Base the questions on the user's actual request, not generic boilerplate.

Response format: respond with ONLY a raw JSON array, no markdown code fences, no explanation, no extra text. Exact shape:
[
  { "question": "...", "options": ["...", "...", "..."] },
  { "question": "...", "options": ["...", "...", "..."] }
]
`;

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);

  return fenced ? fenced[1].trim() : trimmed;
}

function isValidQuestions(value: unknown): value is ClarifyQuestion[] {
  if (!Array.isArray(value) || value.length !== QUESTION_COUNT) {
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

export async function clarifyPrompt(userPrompt: string): Promise<ClarifyQuestion[] | null> {
  const provider = PROVIDER_LIST.find((p) => p.name === CLARIFY_PROVIDER_NAME) as ProviderInfo | undefined;

  if (!provider) {
    return null;
  }

  try {
    const response = await fetch('/api/llmcall', {
      method: 'POST',
      body: JSON.stringify({
        message: userPrompt,
        model: CLARIFY_MODEL,
        provider,
        system: clarifyPromptSystemPrompt,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const { text } = (await response.json()) as { text: string };
    const parsed = JSON.parse(stripCodeFences(text));

    return isValidQuestions(parsed) ? parsed : null;
  } catch (error) {
    console.error('Error generating clarifying questions:', error);
    return null;
  }
}
