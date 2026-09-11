/**
 * ByteDance Seedream(BytePlus ModelArk images API) — 실사·제품·브루탈 세계관의 고정 생성기(style-locks.ts generator).
 * 2026-09-11 베이크오프: 실사 정면 비교에서 Gemini 대비 +1.0, ×8 최고 8.0. 정확한 버전 id 필요(dola-seedream-5-0-pro-260628);
 * size 는 '2048x1152' 처럼 픽셀로 준다('2K'는 세로 이미지가 나온다).
 * 결과 형태는 GeminiImageResult 와 같게 맞춰 skeleton7-image-set 이 공급자를 바꿔 끼울 수 있게 한다.
 */
import type { GeminiImageResult } from './gemini-image';

export const SEEDREAM_ENDPOINT = 'https://ark.ap-southeast.bytepluses.com/api/v3/images/generations';
export const DEFAULT_SEEDREAM_MODEL = 'dola-seedream-5-0-pro-260628';

/** 콘솔 청구 실측 전 추정치 — 실측되면 여기만 바꾼다. */
const SEEDREAM_USD_PER_IMAGE = 0.05;

export interface SeedreamImageInput {
  apiKey: string;
  prompt: string;
  aspectRatio: '16:9' | '4:3' | '1:1';

  /** 체이닝·앵커 레퍼런스 — image[] 로 data URL 전달 */
  references?: Array<{ bytes: Uint8Array; mimeType: string }>;
  model?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export class SeedreamImageError extends Error {
  constructor(
    readonly kind: 'http' | 'empty' | 'timeout' | 'network',
    message: string,
  ) {
    super(message);
    this.name = 'SeedreamImageError';
  }
}

const SIZE: Record<SeedreamImageInput['aspectRatio'], string> = {
  '16:9': '2048x1152',
  '4:3': '2048x1536',
  '1:1': '2048x2048',
};

function toDataUrl(ref: { bytes: Uint8Array; mimeType: string }): string {
  return `data:${ref.mimeType};base64,${Buffer.from(ref.bytes).toString('base64')}`;
}

export async function generateSeedreamImage(input: SeedreamImageInput): Promise<GeminiImageResult> {
  const model = input.model || DEFAULT_SEEDREAM_MODEL;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? 90_000);
  const onAbort = () => controller.abort();
  input.signal?.addEventListener('abort', onAbort);

  try {
    const body: Record<string, unknown> = {
      model,
      prompt: input.prompt,
      size: SIZE[input.aspectRatio],
      response_format: 'b64_json',
      watermark: false,
    };

    if (input.references?.length) {
      body.image = input.references.map(toDataUrl);
    }

    let res: Response;

    try {
      res = await fetch(SEEDREAM_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${input.apiKey}` },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      throw new SeedreamImageError(
        controller.signal.aborted ? 'timeout' : 'network',
        error instanceof Error ? error.message : String(error),
      );
    }

    const json = (await res.json()) as {
      data?: Array<{ b64_json?: string; url?: string }>;
      error?: { code?: string; message?: string };
    };

    if (!res.ok) {
      throw new SeedreamImageError(
        'http',
        `${res.status} ${json.error?.code || ''} ${json.error?.message || ''}`.trim(),
      );
    }

    const first = json.data?.[0];

    if (first?.b64_json) {
      return {
        bytes: new Uint8Array(Buffer.from(first.b64_json, 'base64')),
        mimeType: 'image/jpeg',
        model,
        promptTokens: 0,
        outputTokens: 0,
        costUsd: SEEDREAM_USD_PER_IMAGE,
      };
    }

    if (first?.url) {
      const img = await fetch(first.url, { signal: controller.signal });

      return {
        bytes: new Uint8Array(await img.arrayBuffer()),
        mimeType: img.headers.get('content-type') || 'image/jpeg',
        model,
        promptTokens: 0,
        outputTokens: 0,
        costUsd: SEEDREAM_USD_PER_IMAGE,
      };
    }

    throw new SeedreamImageError('empty', 'no image in response');
  } finally {
    clearTimeout(timeout);
    input.signal?.removeEventListener('abort', onAbort);
  }
}
