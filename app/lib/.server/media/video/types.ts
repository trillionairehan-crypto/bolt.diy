/**
 * 이미지 1장 → 짧은 무음 루프 영상. 공급자(Seedance·Kling)는 이 인터페이스 뒤에 숨고, 호출부는
 * `provider` 문자열 하나로 바꾼다. 둘 다 "작업 생성 → 작업 id → 폴링 → 완료 시 임시 URL" 구조라
 * 인터페이스가 자연스럽게 같다. 임시 URL은 만료되므로(Seedance 24시간, Kling 30일) 완료 즉시 R2로 복사한다.
 */

export type VideoProviderName = 'seedance' | 'kling';

export interface VideoTaskInput {
  imageUrl: string;

  /** 움직임 지시. 비우면 공급자별 기본 루프 프롬프트. */
  prompt?: string;
  durationSec: 5 | 10;

  /** 공급자별 모델 id 덮어쓰기(없으면 env 기본값). */
  model?: string;

  /** 같은 이미지를 마지막 프레임으로도 줘서 이음새 없는 루프를 노린다(공급자가 지원할 때만). */
  loop?: boolean;
}

export type VideoTaskStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface VideoTaskState {
  status: VideoTaskStatus;

  /** 완료 시 공급자 임시 URL. */
  videoUrl?: string;
  error?: string;

  /** 공급자가 돌려주는 사용량 — 원가 계산 재료. */
  usage?: Record<string, number>;
}

export interface VideoCostEstimate {
  usd: number;
  basis: string;
}

export interface VideoProvider {
  readonly name: VideoProviderName;
  readonly model: string;
  createTask(input: VideoTaskInput): Promise<{ taskId: string }>;
  getTask(taskId: string): Promise<VideoTaskState>;

  /** 완료된 작업의 원가(usage 기반, 없으면 모델·길이 표 기반). */
  estimateCost(state: VideoTaskState, input: Pick<VideoTaskInput, 'durationSec'>): VideoCostEstimate;
}

export class VideoProviderError extends Error {
  constructor(
    readonly provider: VideoProviderName,
    message: string,
    readonly status = 0,
  ) {
    super(`${provider}: ${message}`);
    this.name = 'VideoProviderError';
  }
}

export const DEFAULT_LOOP_PROMPT =
  'Subtle ambient motion only: gentle light shift, soft steam or dust, slight fabric or leaf movement. Camera locked, no zoom, no pan. Seamless loop, silent, no text.';
