import { createKlingProvider } from './kling';
import { createSeedanceProvider } from './seedance';
import type { VideoProvider, VideoProviderName } from './types';

export type { VideoProvider, VideoProviderName, VideoTaskInput, VideoTaskState } from './types';
export { VideoProviderError, DEFAULT_LOOP_PROMPT } from './types';

/**
 * env 이름:
 *   VIDEO_PROVIDER            기본 공급자('seedance' | 'kling'). 결과 비교 뒤 사용자가 정한다.
 *   ARK_API_KEY               BytePlus ModelArk API 키 (Seedance)
 *   SEEDANCE_MODEL            기본 seedance-1-0-pro-250528
 *   KLING_ACCESS_KEY / KLING_SECRET_KEY   kling.ai 개발자 플랫폼 키 쌍
 *   KLING_MODEL / KLING_MODE  기본 kling-v2-1 / std
 *   KLING_API_BASE_URL        기본 https://api-singapore.klingai.com
 */
export interface VideoEnv {
  VIDEO_PROVIDER?: string;
  ARK_API_KEY?: string;
  SEEDANCE_MODEL?: string;

  /** 새 개발자 플랫폼의 단일 API 키(`api-key-kling-…`) — 있으면 Bearer로 바로 쓴다. */
  KLING_API_KEY?: string;
  KLING_ACCESS_KEY?: string;
  KLING_SECRET_KEY?: string;
  KLING_MODEL?: string;
  KLING_MODE?: string;
  KLING_API_BASE_URL?: string;
}

export function isVideoProviderName(value: unknown): value is VideoProviderName {
  return value === 'seedance' || value === 'kling';
}

/** 설정이 없으면 null — 라우트는 503으로 답하고, 비교 스크립트는 그 공급자만 건너뛴다. */
export function getVideoProvider(name: VideoProviderName, env: VideoEnv | undefined): VideoProvider | null {
  if (name === 'seedance') {
    return env?.ARK_API_KEY ? createSeedanceProvider({ apiKey: env.ARK_API_KEY, model: env.SEEDANCE_MODEL }) : null;
  }

  if (!env) {
    return null;
  }

  const hasKeyPair = Boolean(env.KLING_ACCESS_KEY && env.KLING_SECRET_KEY);

  if (!env.KLING_API_KEY && !hasKeyPair) {
    return null;
  }

  const mode = env.KLING_MODE === 'pro' ? 'pro' : 'std';

  return createKlingProvider({
    apiKey: env.KLING_API_KEY,
    accessKey: env.KLING_ACCESS_KEY,
    secretKey: env.KLING_SECRET_KEY,
    model: env.KLING_MODEL,
    mode,
    baseUrl: env.KLING_API_BASE_URL,
  });
}

export function defaultVideoProviderName(env: VideoEnv | undefined): VideoProviderName {
  return isVideoProviderName(env?.VIDEO_PROVIDER) ? env.VIDEO_PROVIDER : 'seedance';
}
