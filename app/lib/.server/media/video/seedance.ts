import {
  DEFAULT_LOOP_PROMPT,
  VideoProviderError,
  type VideoCostEstimate,
  type VideoProvider,
  type VideoTaskInput,
  type VideoTaskState,
} from './types';

/**
 * Seedance (BytePlus ModelArk). 인증: `Authorization: Bearer $ARK_API_KEY`.
 * 생성 POST /api/v3/contents/generations/tasks, 조회 GET /api/v3/contents/generations/tasks/{id}.
 * 길이·비율·해상도는 ModelArk 관례대로 텍스트 프롬프트 끝에 `--duration 5 --ratio adaptive --resolution 720p`
 * 플래그로 붙인다(I2V는 첫 프레임 비율을 따르므로 ratio adaptive).
 * 원가: usage.completion_tokens × 모델 단가(USD/M tokens). 토큰 = W×H×fps×초/1024.
 */

/*
 * 실측(2026-09-11): 이 계정엔 1.0이 없고(단종) 콘솔에 활성화된 id는 dreamina-seedance-2-5-260628,
 * dreamina-seedance-2-0-260128, dreamina-seedance-2-0-fast-260128, dreamina-seedance-2-0-mini-260615.
 * 평문 id(seedance-2-0 등)는 InvalidEndpointOrModel.NotFound.
 */
export const SEEDANCE_DEFAULT_MODEL = 'dreamina-seedance-2-0-fast-260128';

const DEFAULT_BASE_URL = 'https://ark.ap-southeast.bytepluses.com/api/v3';

// USD per 1M video tokens (docs.byteplus.com pricing, 2026-09-11 확인분만). 모르는 모델은 pro 단가로 추정.
const USD_PER_M_TOKENS: Record<string, number> = {
  'seedance-1-0-pro-250528': 2.5,
  'seedance-1-0-pro-fast-251015': 2.5,
  'seedance-1-0-lite-i2v-250428': 1.8,

  // 2.5는 공개 단가($10.7/M, 480p $0.10/s·720p $0.23/s). 2.0 계열은 공개 단가를 못 찾아 2.5 값으로 상한 추정 — 콘솔 청구서로 보정할 것.
  'dreamina-seedance-2-5-260628': 10.7,
  'dreamina-seedance-2-0-260128': 10.7,
  'dreamina-seedance-2-0-fast-260128': 10.7,
  'dreamina-seedance-2-0-mini-260615': 10.7,
};

export interface SeedanceConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  resolution?: '480p' | '720p' | '1080p';
}

interface CreateResponse {
  id?: string;
  error?: { code?: string; message?: string };
}

interface TaskResponse {
  id?: string;
  status?: string;
  content?: { video_url?: string };
  usage?: { completion_tokens?: number; total_tokens?: number };
  error?: { code?: string; message?: string };
}

export function createSeedanceProvider(config: SeedanceConfig): VideoProvider {
  const model = config.model || SEEDANCE_DEFAULT_MODEL;
  const baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
  const resolution = config.resolution || '720p';
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` };

  return {
    name: 'seedance',
    model,

    async createTask(input: VideoTaskInput) {
      // 실측: 2.5는 i2v에서 --camerafixed를 거부한다("camera_fixed … must be empty") — 카메라 고정은 프롬프트 문장으로만.
      const text = `${input.prompt || DEFAULT_LOOP_PROMPT} --duration ${input.durationSec} --ratio adaptive --resolution ${resolution} --watermark false`;
      const body = {
        model: input.model || model,
        content: [
          { type: 'text', text },
          { type: 'image_url', image_url: { url: input.imageUrl }, role: 'first_frame' },
        ],
      };

      const response = await fetch(`${baseUrl}/contents/generations/tasks`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      const json = (await response.json().catch(() => ({}))) as CreateResponse;

      if (!response.ok || !json.id) {
        throw new VideoProviderError(
          'seedance',
          `create failed: HTTP ${response.status} ${json.error?.code ?? ''} ${json.error?.message ?? ''}`.trim(),
          response.status,
        );
      }

      return { taskId: json.id };
    },

    async getTask(taskId: string): Promise<VideoTaskState> {
      const response = await fetch(`${baseUrl}/contents/generations/tasks/${encodeURIComponent(taskId)}`, { headers });
      const json = (await response.json().catch(() => ({}))) as TaskResponse;

      if (!response.ok) {
        throw new VideoProviderError(
          'seedance',
          `get failed: HTTP ${response.status} ${json.error?.message ?? ''}`,
          response.status,
        );
      }

      const usage =
        json.usage?.completion_tokens !== undefined ? { completion_tokens: json.usage.completion_tokens } : undefined;

      switch (json.status) {
        case 'succeeded':
          return { status: 'succeeded', videoUrl: json.content?.video_url, usage };
        case 'failed':
        case 'cancelled':
        case 'expired':
          return { status: 'failed', error: json.error?.message ?? json.status, usage };
        case 'running':
          return { status: 'running' };
        default:
          return { status: 'queued' };
      }
    },

    estimateCost(state: VideoTaskState, input): VideoCostEstimate {
      const rate = USD_PER_M_TOKENS[model] ?? USD_PER_M_TOKENS[SEEDANCE_DEFAULT_MODEL];
      const tokens = state.usage?.completion_tokens;

      if (tokens) {
        return { usd: Number(((tokens / 1_000_000) * rate).toFixed(4)), basis: `${tokens} tokens × $${rate}/M` };
      }

      // 720p 16:9 = 1280×720×24fps×sec/1024 ≈ 21,600 tokens/sec
      const estimated = Math.round((1280 * 720 * 24 * input.durationSec) / 1024);

      return {
        usd: Number(((estimated / 1_000_000) * rate).toFixed(4)),
        basis: `estimated ${estimated} tokens × $${rate}/M`,
      };
    },
  };
}
