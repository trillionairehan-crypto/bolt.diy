import { generateGeminiImage, type GeminiImageResult } from './gemini-image';
import { putR2Object, type R2Config } from './r2';

/**
 * 골격 7(소개·홍보형) 이미지 세트 — 히어로 1장을 먼저 만들고, 그 결과를 레퍼런스로 ch1 → ch2 → ch3를
 * 순서대로 체이닝한다(총 4장, 직렬). 색감·질감·조명은 아래 STYLE_LOCK 고정 문구로 4장 모두 같은 톤을
 * 유지하게 한다. 병렬로 돌리면 30초쯤 빨라지지만 ch2·ch3가 ch1을 못 보게 되어 톤이 흩어질 수 있어
 * 지시대로 직렬을 유지한다.
 */

export const SKELETON7_SLOTS = ['hero', 'ch1', 'ch2', 'ch3'] as const;
export type Skeleton7Slot = (typeof SKELETON7_SLOTS)[number];

export interface Skeleton7ImageSetInput {
  chatId: string;

  /** 업종 라벨(예: "카페·음식점") 또는 사용자가 직접 입력한 업종 원문. */
  industry: string;

  /** 사용자의 원래 요청 문장(온보딩 추가 내용 제외). */
  prompt: string;

  /** 팔레트 액센트 hex — 색감 고정에 힌트로만 쓴다. */
  accentHex: string;
  darkPalette: boolean;
}

export interface Skeleton7ImageSet {
  images: Record<Skeleton7Slot, string>;
  model: string;
  promptTokens: number;
  outputTokens: number;
  costUsd: number;
  elapsedMs: number;
}

export interface Skeleton7ImageSetDeps {
  apiKey: string;
  r2: R2Config;
  signal?: AbortSignal;
}

const STYLE_LOCK = (accentHex: string, dark: boolean) =>
  [
    'Editorial photography, one cohesive series.',
    `Color grading: warm neutral base with a single accent hue close to ${accentHex}, low saturation, no neon.`,
    `Lighting: soft natural window light, ${dark ? 'moody low-key' : 'bright airy'}, gentle shadows, no harsh flash.`,
    'Texture: subtle film grain, matte surfaces, shallow depth of field.',
    'Composition: clean negative space on one side for a headline overlay. No text, no letters, no logos, no watermarks, no people looking at the camera.',
  ].join(' ');

function buildHeroPrompt(input: Skeleton7ImageSetInput): string {
  return [
    `Hero photograph for a Korean small business website. Business: ${input.industry}. What the owner asked for: "${input.prompt}".`,
    'Wide establishing shot that shows the place or the craft at its best moment.',
    STYLE_LOCK(input.accentHex, input.darkPalette),
  ].join('\n');
}

const CHAPTER_SUBJECTS: Record<Exclude<Skeleton7Slot, 'hero'>, string> = {
  ch1: 'Close-up detail of the signature product, service, or craft — hands at work or the product itself.',
  ch2: 'The space or atmosphere customers experience — interior, seating, tools, or workspace, mid-distance.',
  ch3: 'A welcoming closing image — entrance, storefront, table setting, or a finished result ready for a customer.',
};

function buildChapterPrompt(slot: Exclude<Skeleton7Slot, 'hero'>, input: Skeleton7ImageSetInput): string {
  return [
    `Continue the same photo series as the reference image (same place, same palette, same light). Business: ${input.industry}.`,
    CHAPTER_SUBJECTS[slot],
    'Match the reference image exactly in color grading, lighting, and texture. Different subject and framing, same world.',
    STYLE_LOCK(input.accentHex, input.darkPalette),
  ].join('\n');
}

function extensionFor(mimeType: string): string {
  if (mimeType === 'image/jpeg') {
    return 'jpg';
  }

  if (mimeType === 'image/webp') {
    return 'webp';
  }

  return 'png';
}

export function skeleton7ObjectKey(chatId: string, slot: Skeleton7Slot, stamp: number, ext: string): string {
  const safeChat = chatId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);

  return `media/${safeChat}/${stamp}-${slot}.${ext}`;
}

export async function generateSkeleton7ImageSet(
  input: Skeleton7ImageSetInput,
  deps: Skeleton7ImageSetDeps,
): Promise<Skeleton7ImageSet> {
  const started = Date.now();
  const stamp = started;
  const images = {} as Record<Skeleton7Slot, string>;
  let promptTokens = 0;
  let outputTokens = 0;
  let costUsd = 0;
  let model = '';
  let previous: GeminiImageResult | null = null;

  for (const slot of SKELETON7_SLOTS) {
    const result = await generateGeminiImage({
      apiKey: deps.apiKey,
      prompt: slot === 'hero' ? buildHeroPrompt(input) : buildChapterPrompt(slot, input),
      aspectRatio: slot === 'hero' ? '16:9' : '4:3',
      reference: previous ? { bytes: previous.bytes, mimeType: previous.mimeType } : undefined,
      signal: deps.signal,
    });

    const key = skeleton7ObjectKey(input.chatId, slot, stamp, extensionFor(result.mimeType));
    images[slot] = await putR2Object(deps.r2, key, result.bytes, result.mimeType);

    promptTokens += result.promptTokens;
    outputTokens += result.outputTokens;
    costUsd += result.costUsd;
    model = result.model;
    previous = result;
  }

  return {
    images,
    model,
    promptTokens,
    outputTokens,
    costUsd: Number(costUsd.toFixed(6)),
    elapsedMs: Date.now() - started,
  };
}
