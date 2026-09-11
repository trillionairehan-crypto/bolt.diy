import { workbenchStore } from '~/lib/stores/workbench';
import { selectReviewableEntries } from '~/utils/reviewGeneratedApp';
import { createScopedLogger } from '~/utils/logger';
import { injectSkeleton7Images, type Skeleton7ImageUrls } from './injectSkeleton7Images';
import { isSkeleton7File } from '~/lib/review/mechanical-checks';

/**
 * 골격 7 이미지 세트 — 클라이언트 오케스트레이션.
 *
 * 온보딩이 골격 7을 기본값으로 정하면 생성 시작과 동시에 /api/media-images를 먼저 띄운다(4장 직렬
 * 생성 ~60초가 LLM 생성 120~160초 안에 끝나므로 사용자 체감 지연이 없다). 미리보기가 뜨고 자동 검토
 * (data-slot 재명명 포함)가 끝난 뒤 applySkeleton7Images()가 결과를 기다려 파일에 주입한다.
 *
 * LLM이 골격 7 대신 다른 골격을 골랐으면 결과를 버린다(원가 낭비 — 골격 7 매핑 업종에서만 미리
 * 시작하므로 빈도는 낮다). 반대로 미리 시작하지 않았는데 생성물이 골격 7이면 그때 시작한다(주입이
 * 그만큼 늦지만 빠지진 않는다).
 */

const logger = createScopedLogger('Skeleton7Images');

export interface Skeleton7ImageJobInput {
  chatId: string;
  industry: string;
  prompt: string;
  accentHex: string;
  darkPalette: boolean;
}

interface PendingJob {
  chatId: string;
  promise: Promise<Skeleton7ImageUrls | null>;
}

const REQUEST_TIMEOUT_MS = 250_000;

let pending: PendingJob | null = null;
let lastInput: Skeleton7ImageJobInput | null = null;

async function requestImageSet(input: Skeleton7ImageJobInput): Promise<Skeleton7ImageUrls | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch('/api/media-images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: controller.signal,
    });

    if (!response.ok) {
      logger.warn('image set request failed', response.status);
      return null;
    }

    const data = (await response.json()) as { images?: Skeleton7ImageUrls; costUsd?: number; elapsedMs?: number };
    logger.info('image set ready', { costUsd: data.costUsd, elapsedMs: data.elapsedMs });

    return data.images ?? null;
  } catch (error) {
    logger.warn('image set request errored', error);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/** 생성 시작 직후 호출 — 결과는 기다리지 않는다. 같은 chatId로 이미 진행 중이면 다시 시작하지 않는다. */
export function startSkeleton7ImageJob(input: Skeleton7ImageJobInput): void {
  lastInput = input;

  if (pending && pending.chatId === input.chatId) {
    return;
  }

  pending = { chatId: input.chatId, promise: requestImageSet(input) };
}

/** 골격 7 기본값이 아닐 때 — 시작은 안 하고 재료만 기억해둔다(생성물이 골격 7로 나오면 그때 시작). */
export function rememberSkeleton7Context(input: Skeleton7ImageJobInput): void {
  lastInput = input;
}

export interface ApplyResult {
  filesWritten: string[];
  injected: string[];
  missing: string[];
}

export async function applySkeleton7Images(): Promise<ApplyResult | null> {
  const files = workbenchStore.files.get();
  const entries = selectReviewableEntries(files).filter(([, file]) => isSkeleton7File(file.content));

  if (entries.length === 0) {
    if (pending) {
      logger.info('generated app is not skeleton 7 — discarding pre-started image set');
      pending = null;
    }

    return null;
  }

  if (!pending) {
    if (!lastInput) {
      return null;
    }

    startSkeleton7ImageJob(lastInput);
  }

  const job = pending as PendingJob;
  const urls = await job.promise;
  pending = null;

  if (!urls) {
    return null;
  }

  const filesWritten: string[] = [];
  const injected = new Set<string>();
  const missing = new Set<string>();

  for (const [filePath, file] of entries) {
    const result = injectSkeleton7Images(file.content, urls);

    result.injected.forEach((slot) => injected.add(slot));
    result.missing.forEach((slot) => missing.add(slot));

    if (result.injected.length > 0) {
      await workbenchStore.writeFileDirect(filePath, result.content);
      filesWritten.push(filePath);
    }
  }

  if (filesWritten.length > 0) {
    workbenchStore.resetAllFileModifications();
  }

  const summary = { filesWritten, injected: [...injected], missing: [...missing] };
  logger.info('applied', summary);

  return summary;
}
