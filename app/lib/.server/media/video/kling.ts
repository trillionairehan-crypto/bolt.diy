import {
  DEFAULT_LOOP_PROMPT,
  VideoProviderError,
  type VideoCostEstimate,
  type VideoProvider,
  type VideoTaskInput,
  type VideoTaskState,
} from './types';

/**
 * Kling (kling.ai 개발자 플랫폼). 인증: Access Key/Secret Key로 HS256 JWT를 직접 만들어
 * `Authorization: Bearer <jwt>` (claims iss=accessKey, exp=now+30m, nbf=now-5s).
 * 생성 POST /v1/videos/image2video, 조회 GET /v1/videos/image2video/{task_id}.
 * task_status: submitted | processing | succeed | failed. 영상 URL은 30일 보관.
 * 원가: 응답에 없으므로 모델·모드·길이 표로 추정(리소스 패키지 표준 단가, 2026-09 3rd-party 집계 기준).
 */

export const KLING_DEFAULT_MODEL = 'kling-v2-1';

const DEFAULT_BASE_URL = 'https://api-singapore.klingai.com';
const JWT_TTL_SEC = 1800;

// USD per 5s clip. std 720p ≈ $0.42, pro 1080p ≈ $0.56 (costbench 2026-08). 10초는 2배.
const USD_PER_5S: Record<'std' | 'pro', number> = { std: 0.42, pro: 0.56 };

export interface KlingConfig {
  accessKey: string;
  secretKey: string;
  model?: string;
  mode?: 'std' | 'pro';
  baseUrl?: string;
}

interface KlingEnvelope<T> {
  code?: number;
  message?: string;
  data?: T;
}

interface KlingTaskData {
  task_id?: string;
  task_status?: string;
  task_status_msg?: string;
  task_result?: { videos?: Array<{ id?: string; url?: string; duration?: string }> };
}

function base64url(bytes: Uint8Array): string {
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function signKlingJwt(
  accessKey: string,
  secretKey: string,
  nowSec = Math.floor(Date.now() / 1000),
): Promise<string> {
  const encoder = new TextEncoder();
  const header = base64url(encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const payload = base64url(
    encoder.encode(JSON.stringify({ iss: accessKey, exp: nowSec + JWT_TTL_SEC, nbf: nowSec - 5 })),
  );
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(`${header}.${payload}`)));

  return `${header}.${payload}.${base64url(signature)}`;
}

export function createKlingProvider(config: KlingConfig): VideoProvider {
  const model = config.model || KLING_DEFAULT_MODEL;
  const mode = config.mode || 'std';
  const baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');

  async function authHeaders(): Promise<Record<string, string>> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${await signKlingJwt(config.accessKey, config.secretKey)}`,
    };
  }

  return {
    name: 'kling',
    model,

    async createTask(input: VideoTaskInput) {
      const body = {
        model_name: input.model || model,
        image: input.imageUrl,
        prompt: input.prompt || DEFAULT_LOOP_PROMPT,
        mode,
        duration: String(input.durationSec),
        cfg_scale: 0.5,
      };

      const response = await fetch(`${baseUrl}/v1/videos/image2video`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify(body),
      });
      const json = (await response.json().catch(() => ({}))) as KlingEnvelope<KlingTaskData>;

      if (!response.ok || json.code !== 0 || !json.data?.task_id) {
        throw new VideoProviderError(
          'kling',
          `create failed: HTTP ${response.status} code ${json.code ?? '?'} ${json.message ?? ''}`.trim(),
          response.status,
        );
      }

      return { taskId: json.data.task_id };
    },

    async getTask(taskId: string): Promise<VideoTaskState> {
      const response = await fetch(`${baseUrl}/v1/videos/image2video/${encodeURIComponent(taskId)}`, {
        headers: await authHeaders(),
      });
      const json = (await response.json().catch(() => ({}))) as KlingEnvelope<KlingTaskData>;

      if (!response.ok || json.code !== 0) {
        throw new VideoProviderError(
          'kling',
          `get failed: HTTP ${response.status} code ${json.code ?? '?'} ${json.message ?? ''}`.trim(),
          response.status,
        );
      }

      const data = json.data ?? {};

      switch (data.task_status) {
        case 'succeed':
          return { status: 'succeeded', videoUrl: data.task_result?.videos?.[0]?.url };
        case 'failed':
          return { status: 'failed', error: data.task_status_msg ?? 'failed' };
        case 'processing':
          return { status: 'running' };
        default:
          return { status: 'queued' };
      }
    },

    estimateCost(_state: VideoTaskState, input): VideoCostEstimate {
      const per5 = USD_PER_5S[mode];
      const usd = Number(((per5 * input.durationSec) / 5).toFixed(4));

      return { usd, basis: `table ${mode} $${per5}/5s × ${input.durationSec}s` };
    },
  };
}
