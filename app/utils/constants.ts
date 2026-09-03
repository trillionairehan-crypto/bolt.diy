import { LLMManager } from '~/lib/modules/llm/manager';

export const WORK_DIR_NAME = 'project';
export const WORK_DIR = `/home/${WORK_DIR_NAME}`;
export const MODIFICATIONS_TAG_NAME = 'bolt_file_modifications';
export const MODEL_REGEX = /^\[Model: (.*?)\]\n\n/;
export const PROVIDER_REGEX = /\[Provider: (.*?)\]\n\n/;

/*
 * PromptClarification.tsx appends the onboarding survey's synthesized instructions after this
 * exact marker when building the message text sent to the model. UserMessage.tsx splits on it to
 * show only the user's original prompt in the chat bubble — the model still receives the full
 * text (marker and all) since only display is affected, not what gets sent.
 */
export const ONBOARDING_ADDITIONS_MARKER = '\n\n추가로 알려주신 내용:\n';

/*
 * Switched to 'claude-sonnet-5' 2026-08-21: the forced `temperature: 0` injection that used to
 * make Sonnet 5 (and Opus 5) reject non-reasoning calls was tied to the old ai SDK (v4.3.16).
 * Confirmed resolved after the v7 SDK migration (ai@7.0.70) via live generateText/streamText
 * calls against claude-sonnet-5 through both api.llmcall.ts and api.chat.ts — both completed
 * with finishReason "stop" and no temperature-related error.
 */
export const DEFAULT_MODEL = 'claude-sonnet-5';
export { SHOW_DEV_TOOLS, CORALRED_NEW_METERING } from './featureFlags';
export const PROMPT_COOKIE_KEY = 'cachedPrompt';

/*
 * /examples 카드 클릭 → 채팅 홈 입력창 채움 전용 1회성 키. PROMPT_COOKIE_KEY와 다른 목적(그건
 * 타이핑 중 자동 저장 — 디바운스로 계속 갱신되고 30일 유지)이라 재사용하면 "새로고침해도 다시
 * 채워지지 않아야 한다"는 요구를 못 지킨다. Chat.client.tsx가 마운트 시 이 키를 읽어 입력값
 * 초기화에만 쓰고, 값이 있든 없든 즉시 지운다 — 다음 새로고침엔 아무 것도 안 남는다.
 */
export const EXAMPLE_PROMPT_FILL_KEY = 'examplePromptFill';
export const TOOL_EXECUTION_APPROVAL = {
  APPROVE: 'Yes, approved.',
  REJECT: 'No, rejected.',
} as const;
export const TOOL_NO_EXECUTE_FUNCTION = 'Error: No execute function found on tool';
export const TOOL_EXECUTION_DENIED = 'Error: User denied access to tool execution';
export const TOOL_EXECUTION_ERROR = 'Error: An error occured while calling tool';

const llmManager = LLMManager.getInstance(import.meta.env);

export const PROVIDER_LIST = llmManager.getAllProviders();
export const DEFAULT_PROVIDER = llmManager.getDefaultProvider();

export const providerBaseUrlEnvKeys: Record<string, { baseUrlKey?: string; apiTokenKey?: string }> = {};
PROVIDER_LIST.forEach((provider) => {
  providerBaseUrlEnvKeys[provider.name] = {
    baseUrlKey: provider.config.baseUrlKey,
    apiTokenKey: provider.config.apiTokenKey,
  };
});

/*
 * 여러 프레임워크 스타터 템플릿(Astro/Vue/Angular/Next.js 등)을 LLM이 골라 GitHub에서 가져오던
 * 자동 템플릿 선택 기능은 제거했다(2026-09-03, 출시 블로커) — coralred의 생성 파이프라인은
 * App.tsx 기반 React+Vite 한 가지만 전제하는데, 이 목록에 있던 대부분의 프레임워크는 그 전제와
 * 아예 안 맞아서(가장 먼저 발견된 사례: Astro — App.tsx를 써도 실제 서빙되는 index.astro는
 * 그대로 방치돼 생성물이 완전히 죽어 있었다) 골랐다 하면 결과물이 깨졌다. 이제는 항상
 * selectStarterTemplate.ts의 getBaselineTemplate()만 쓴다 — GitHub 의존도, LLM 선택 호출도 없고
 * coralredKit이 처음부터 다 박혀 있다.
 */
