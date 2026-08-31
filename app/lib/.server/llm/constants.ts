/*
 * Maximum tokens for response generation (updated for modern model capabilities)
 * This serves as a fallback when model-specific limits are unavailable
 * Modern models like Claude 3.5, GPT-4o, and Gemini Pro support 128k+ tokens
 */
export const MAX_TOKENS = 128000;

/*
 * Provider-specific default completion token limits
 * Used as fallbacks when model doesn't specify maxCompletionTokens
 */
export const PROVIDER_COMPLETION_LIMITS: Record<string, number> = {
  OpenAI: 4096, // Standard GPT models (o1 models have much higher limits)
  Github: 4096, // GitHub Models use OpenAI-compatible limits
  Anthropic: 64000, // Conservative limit for Claude 4 models (Opus: 32k, Sonnet: 64k)
  Google: 8192, // Gemini 1.5 Pro/Flash standard limit
  Cohere: 4000,
  DeepSeek: 8192,
  Groq: 8192,
  HuggingFace: 4096,
  Mistral: 8192,
  Ollama: 8192,
  OpenRouter: 8192,
  Perplexity: 8192,
  Together: 8192,
  xAI: 8192,
  LMStudio: 8192,
  OpenAILike: 8192,
  AmazonBedrock: 8192,
  Hyperbolic: 8192,
};

/*
 * Reasoning models that require maxCompletionTokens instead of maxTokens
 * These models use internal reasoning tokens and have different API parameter requirements
 */
export function isReasoningModel(modelName: string): boolean {
  const result = /^(o1|o3|gpt-5)/i.test(modelName);

  // DEBUG: Test regex matching
  console.log(`REGEX TEST: "${modelName}" matches reasoning pattern: ${result}`);

  return result;
}

// limits the number of model responses that can be returned in a single request
export const MAX_RESPONSE_SEGMENTS = 2;

/*
 * Sonnet 5 / Opus 5 think adaptively by default even with no `thinking` param sent at all —
 * confirmed live via coralred.kr repro (2026-08-22): Anthropic opens a `content_block_start`
 * type "thinking" unprompted, and the silent thinking phase can run 45s+ with zero stream
 * output, tripping stream-recovery's stall timeout. Capping effort to 'medium' (still adaptive)
 * did NOT bound this reliably — an A/B test the same day (short prompt, fresh chat, effort:
 * medium) still hit a full 45s stall on attempt 1, while the exact same prompt against Sonnet
 * 4.5 (no thinking at all) had zero stall and a ~4s time-to-first-token. So thinking is
 * disabled outright here rather than capped. Shared between stream-text.ts (main generation)
 * and api.llmcall.ts (single-shot calls like auto-review) so both stay in sync.
 */
export const NO_THINKING_MODELS = ['claude-sonnet-5', 'claude-opus-5'];

export function isAnthropicNoThinkingModel(providerName: string, modelName: string): boolean {
  return providerName === 'Anthropic' && NO_THINKING_MODELS.some((name) => modelName.includes(name));
}

export interface File {
  type: 'file';
  content: string;
  isBinary: boolean;
  isLocked?: boolean;
  lockedByFolder?: string;
}

export interface Folder {
  type: 'folder';
  isLocked?: boolean;
  lockedByFolder?: string;
}

type Dirent = File | Folder;

export type FileMap = Record<string, Dirent | undefined>;

export const IGNORE_PATTERNS = [
  'node_modules/**',
  '.git/**',
  'dist/**',
  'build/**',
  '.next/**',
  'coverage/**',
  '.cache/**',
  '.vscode/**',
  '.idea/**',
  '**/*.log',
  '**/.DS_Store',
  '**/npm-debug.log*',
  '**/yarn-debug.log*',
  '**/yarn-error.log*',
  '**/*lock.json',
  '**/*lock.yml',
];
