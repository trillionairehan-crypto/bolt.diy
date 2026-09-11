import { generateGeminiImage, type GeminiImageResult } from './gemini-image';
import { generateSeedreamImage } from './seedream-image';
import { putR2Object, r2PublicUrl, type R2Config } from './r2';
import { pickShotList } from '~/lib/media/shotlist';

/**
 * 골격 7(소개·홍보형) 이미지 세트 — 히어로 1장을 먼저 만들고, 그 결과를 레퍼런스로 ch1 → ch2 → ch3를
 * 순서대로 체이닝한다(총 4장, 직렬). 색감·질감·조명은 아래 STYLE_LOCK 고정 문구로 4장 모두 같은 톤을
 * 유지하게 한다. 병렬로 돌리면 30초쯤 빨라지지만 ch2·ch3가 ch1을 못 보게 되어 톤이 흩어질 수 있어
 * 지시대로 직렬을 유지한다.
 */

export const SKELETON7_SLOTS = ['hero', 'ch1', 'ch2', 'ch3'] as const;
export type Skeleton7Slot = (typeof SKELETON7_SLOTS)[number];

export const JOB_ID_REGEX = /^[a-z0-9][a-z0-9-]{7,63}$/;

export interface Skeleton7ImageSetInput {
  /** 클라이언트가 생성 전에 미리 정한 잡 id — R2 키가 여기서 결정돼 URL을 프롬프트에 먼저 넣을 수 있다. */
  jobId: string;
  chatId: string;

  /** 업종 라벨(예: "카페·음식점") 또는 사용자가 직접 입력한 업종 원문. */
  industry: string;

  /** 사용자의 원래 요청 문장(온보딩 추가 내용 제외). */
  prompt: string;

  /** 팔레트 액센트 hex — 색감 고정에 힌트로만 쓴다. */
  accentHex: string;
  darkPalette: boolean;

  /**
   * 딥 브리프 Direction Sheet(decided) 에서 온 연출 — 있으면 기본 STYLE_LOCK·샷리스트 대신 쓴다.
   * shots 는 슬롯별 프롬프트 주어(ShotPlan.prompt), styleLockPrompt 는 세계관 STYLE_LOCK + 무드 + 인물 절.
   * 없는 슬롯은 기본 샷리스트로 채운다.
   */
  direction?: {
    styleLockPrompt: string;
    shots: Partial<Record<Skeleton7Slot, string>>;
  };
}

export type ImageProvider = 'gemini' | 'seedream';

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

  /** 기본 gemini(프로덕션 그대로). seedream 은 IMAGE_PROVIDER=seedream + ARK_API_KEY 일 때만. */
  provider?: ImageProvider;
  arkApiKey?: string;
  seedreamModel?: string;
}

/*
 * 실측(2026-09-11, 4장 세트 1회): "clean negative space on one side"를 모델이 매번 "오른쪽 1/3을 흐린 벽으로
 * 가림"으로 해석해 4장에 같은 장치가 반복됐다. 여백 지시를 빼고 전경 가림을 명시적으로 금지한다.
 */
const STYLE_LOCK = (accentHex: string, dark: boolean) =>
  [
    'Editorial photography, one cohesive series.',
    `Color grading: warm neutral base with a single accent hue close to ${accentHex}, low saturation, no neon.`,
    `Lighting: soft natural window light, ${dark ? 'moody low-key' : 'bright airy'}, gentle shadows, no harsh flash.`,
    'Texture: subtle film grain, matte surfaces, shallow depth of field on the subject only.',
    'Composition: full frame, nothing blurred or blocking the foreground edges, no walls or pillars cutting the frame.',

    // 사용자 판정(2026-09-11): 생성 인물은 어색하다 — 사람·얼굴·손 전부 금지, 사물·공간·제품만.
    'No people, no faces, no hands, no body parts anywhere in the frame. No text, no letters, no signs, no logos, no watermarks.',
  ].join(' ');

function styleLockFor(input: Skeleton7ImageSetInput): string {
  return input.direction?.styleLockPrompt || STYLE_LOCK(input.accentHex, input.darkPalette);
}

function subjectFor(slot: Skeleton7Slot, input: Skeleton7ImageSetInput): string {
  return input.direction?.shots[slot] || pickShotList(input.industry)[slot];
}

function buildHeroPrompt(input: Skeleton7ImageSetInput): string {
  return [
    `Hero photograph for a Korean small business website. Business: ${input.industry}. What the owner asked for: "${input.prompt}".`,
    subjectFor('hero', input),
    styleLockFor(input),
  ].join('\n');
}

function buildChapterPrompt(slot: Exclude<Skeleton7Slot, 'hero'>, input: Skeleton7ImageSetInput): string {
  return [
    `Continue the same photo series as the reference image (same place, same palette, same light). Business: ${input.industry}.`,
    subjectFor(slot, input),
    'Match the reference image exactly in color grading, lighting, and texture. Different subject and framing, same world.',
    styleLockFor(input),
  ].join('\n');
}

/** 슬롯별 최종 프롬프트 — 테스트·로그용. 생성 경로와 같은 함수를 쓴다. */
export function buildSkeleton7Prompts(input: Skeleton7ImageSetInput): Record<Skeleton7Slot, string> {
  return {
    hero: buildHeroPrompt(input),
    ch1: buildChapterPrompt('ch1', input),
    ch2: buildChapterPrompt('ch2', input),
    ch3: buildChapterPrompt('ch3', input),
  };
}

/*
 * 키는 잡 id + 슬롯으로 결정적이다 — 생성 전에 URL을 알아야 프롬프트에 "사용자 제공 사진"으로 넘길 수 있다.
 * 확장자는 실제 mime과 무관하게 .jpg로 고정(R2가 저장된 Content-Type으로 서빙하므로 png가 와도 브라우저는
 * 정상 표시한다).
 */
export function skeleton7ObjectKey(jobId: string, slot: Skeleton7Slot): string {
  return `media/${jobId}/${slot}.jpg`;
}

export function skeleton7ImageUrls(r2: R2Config, jobId: string): Record<Skeleton7Slot, string> {
  const urls = {} as Record<Skeleton7Slot, string>;

  for (const slot of SKELETON7_SLOTS) {
    urls[slot] = r2PublicUrl(r2, skeleton7ObjectKey(jobId, slot));
  }

  return urls;
}

export async function generateSkeleton7ImageSet(
  input: Skeleton7ImageSetInput,
  deps: Skeleton7ImageSetDeps,
): Promise<Skeleton7ImageSet> {
  const started = Date.now();
  const images = {} as Record<Skeleton7Slot, string>;
  let promptTokens = 0;
  let outputTokens = 0;
  let costUsd = 0;
  let model = '';
  let previous: GeminiImageResult | null = null;

  const useSeedream = deps.provider === 'seedream' && !!deps.arkApiKey;

  for (const slot of SKELETON7_SLOTS) {
    const prompt = slot === 'hero' ? buildHeroPrompt(input) : buildChapterPrompt(slot, input);
    const aspectRatio = slot === 'hero' ? '16:9' : '4:3';
    const reference: { bytes: Uint8Array; mimeType: string } | undefined = previous
      ? { bytes: previous.bytes, mimeType: previous.mimeType }
      : undefined;
    const result: GeminiImageResult = useSeedream
      ? await generateSeedreamImage({
          apiKey: deps.arkApiKey!,
          model: deps.seedreamModel,
          prompt,
          aspectRatio,
          references: reference ? [reference] : undefined,
          signal: deps.signal,
        })
      : await generateGeminiImage({ apiKey: deps.apiKey, prompt, aspectRatio, reference, signal: deps.signal });

    images[slot] = await putR2Object(deps.r2, skeleton7ObjectKey(input.jobId, slot), result.bytes, result.mimeType);

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
