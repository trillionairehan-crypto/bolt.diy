/**
 * Gemini 이미지 생성(Nano Banana) — generateContent REST 직접 호출. @ai-sdk/google을 거치지 않는 이유:
 * 이미지 응답(inlineData)과 imageConfig(aspectRatio)를 SDK 버전에 흔들리지 않고 그대로 다루기 위함.
 *
 * 텍스트→이미지 1장, 또는 레퍼런스 이미지+텍스트→이미지 1장(체이닝). 항상 1장만 돌려준다.
 */

export const GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-image';

/**
 * 원가(USD, 표준 요금, 2026-09-11 ai.google.dev/gemini-api/docs/pricing 확인):
 *   gemini-3.1-flash-image      1K $0.067 (1120 tok)  — 기본값
 *   gemini-3.1-flash-lite-image 1K $0.0336 (1120 tok)
 *   gemini-2.5-flash-image      1K $0.039 (1290 tok)  — 레거시
 *   gemini-3-pro-image          1K/2K $0.134 (1120 tok)
 * 실제 청구는 출력 토큰 기준이라 usageMetadata.candidatesTokenCount로 계산한다.
 */
const OUTPUT_USD_PER_TOKEN: Record<string, number> = {
  'gemini-3.1-flash-image': 0.067 / 1120,
  'gemini-3.1-flash-lite-image': 0.0336 / 1120,
  'gemini-2.5-flash-image': 0.039 / 1290,
  'gemini-3-pro-image': 0.134 / 1120,
};

// 텍스트 입력 토큰 단가(USD/token) — 이미지 대비 미미하지만 레퍼런스 이미지 입력이 있을 때 수백 토큰이 잡힌다.
const INPUT_USD_PER_TOKEN: Record<string, number> = {
  'gemini-3.1-flash-image': 0.5 / 1_000_000,
  'gemini-3.1-flash-lite-image': 0.25 / 1_000_000,
  'gemini-2.5-flash-image': 0.3 / 1_000_000,
  'gemini-3-pro-image': 2 / 1_000_000,
};

export type ImageAspectRatio = '1:1' | '3:2' | '2:3' | '3:4' | '4:3' | '16:9' | '9:16' | '21:9';

export interface GeminiImageInput {
  apiKey: string;
  prompt: string;
  aspectRatio: ImageAspectRatio;

  /** 레퍼런스 이미지(체이닝). 있으면 프롬프트 앞에 이미지 파트로 붙는다. */
  reference?: { bytes: Uint8Array; mimeType: string };
  model?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface GeminiImageResult {
  bytes: Uint8Array;
  mimeType: string;
  model: string;
  promptTokens: number;
  outputTokens: number;
  costUsd: number;
}

export class GeminiImageError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly kind: 'http' | 'timeout' | 'no_image' | 'blocked',
  ) {
    super(message);
    this.name = 'GeminiImageError';
  }
}

const DEFAULT_TIMEOUT_MS = 90_000;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;

  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }

  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

interface GenerateContentResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}

export function estimateImageCostUsd(model: string, promptTokens: number, outputTokens: number): number {
  const out = OUTPUT_USD_PER_TOKEN[model] ?? OUTPUT_USD_PER_TOKEN[GEMINI_IMAGE_MODEL];
  const inp = INPUT_USD_PER_TOKEN[model] ?? INPUT_USD_PER_TOKEN[GEMINI_IMAGE_MODEL];

  return Number((promptTokens * inp + outputTokens * out).toFixed(6));
}

export async function generateGeminiImage(input: GeminiImageInput): Promise<GeminiImageResult> {
  const model = input.model ?? GEMINI_IMAGE_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const parts: Array<Record<string, unknown>> = [];

  if (input.reference) {
    parts.push({ inlineData: { mimeType: input.reference.mimeType, data: bytesToBase64(input.reference.bytes) } });
  }

  parts.push({ text: input.prompt });

  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      imageConfig: { aspectRatio: input.aspectRatio },
    },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), input.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const onOuterAbort = () => controller.abort();
  input.signal?.addEventListener('abort', onOuterAbort);

  let response: Response;

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': input.apiKey },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new GeminiImageError('Gemini image request timed out', 0, 'timeout');
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
    input.signal?.removeEventListener('abort', onOuterAbort);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new GeminiImageError(`Gemini image HTTP ${response.status}: ${text.slice(0, 300)}`, response.status, 'http');
  }

  const json = (await response.json()) as GenerateContentResponse;

  if (json.promptFeedback?.blockReason) {
    throw new GeminiImageError(`Gemini image blocked: ${json.promptFeedback.blockReason}`, 200, 'blocked');
  }

  const candidate = json.candidates?.[0];
  const imagePart = candidate?.content?.parts?.find((part) => part.inlineData);

  if (!imagePart?.inlineData) {
    const reason = candidate?.finishReason ?? 'unknown';
    throw new GeminiImageError(`Gemini image returned no image (finishReason=${reason})`, 200, 'no_image');
  }

  const promptTokens = json.usageMetadata?.promptTokenCount ?? 0;
  const outputTokens = json.usageMetadata?.candidatesTokenCount ?? 0;

  return {
    bytes: base64ToBytes(imagePart.inlineData.data),
    mimeType: imagePart.inlineData.mimeType || 'image/png',
    model,
    promptTokens,
    outputTokens,
    costUsd: estimateImageCostUsd(model, promptTokens, outputTokens),
  };
}
