import { workbenchStore } from '~/lib/stores/workbench';
import { chatId as chatIdAtom, ensureChatId } from '~/lib/persistence';
import { selectReviewableEntries } from '~/utils/reviewGeneratedApp';
import { createScopedLogger } from '~/utils/logger';
import { injectSkeleton7Images, type Skeleton7ImageUrls } from './injectSkeleton7Images';
import { isSkeleton7File } from '~/lib/review/mechanical-checks';

/**
 * 골격 7 이미지 세트 — 클라이언트 오케스트레이션.
 *
 * 실측(2026-09-11, 실생성 3회): 생성물마다 마크업이 달랐다 — 인라인 코랄 틴트 div, 공용 ImagePlaceholder
 * 컴포넌트, 별도 파일의 <Chapter slot="ch1"> 컴포넌트 + 클래스 기반 플레이스홀더. 생성 뒤에 정규식으로
 * 이미지를 끼워 넣는 방식은 이 변주를 못 따라간다. 그래서 순서를 뒤집는다:
 *   1) 생성 전에 서버에서 잡 id로 결정적 URL 4개를 예약한다(/api/media-images { reserve: true }).
 *   2) 그 URL을 "사용자가 제공한 사진"으로 프롬프트에 넣는다 — LLM은 주어진 URL을 <img>로 쓰는 일은
 *      확실하게 한다(레이아웃 규칙 준수와 달리 사소한 지시라서).
 *   3) 이미지 생성(~60초)은 LLM 생성(~90~150초)과 동시에 돌린다.
 *   4) 자동 검토 뒤: 파일이 URL을 이미 쓰고 있으면 캐시버스터만 붙여 한 번 다시 그리고(이미지가 미리보기보다
 *      늦게 올라온 경우 대비), 안 쓰고 있으면 정규식 주입(injectSkeleton7Images)으로 폴백한다.
 */

const logger = createScopedLogger('Skeleton7Images');

export interface Skeleton7ImageJobInput {
  industry: string;
  prompt: string;
  accentHex: string;
  darkPalette: boolean;
}

interface PendingJob {
  jobId: string;
  urls: Skeleton7ImageUrls;
  promise: Promise<Skeleton7ImageUrls | null>;
}

const RESERVE_TIMEOUT_MS = 8_000;
const REQUEST_TIMEOUT_MS = 250_000;

let pending: PendingJob | null = null;
let lastInput: Skeleton7ImageJobInput | null = null;

/** 요청 문장만으로 "소개·홍보형 사이트"일 가능성을 본다 — 온보딩 골격 매핑이 자주 틀려서(빵집 → 거래·수지형) 보조 신호로 쓴다. */
export function looksLikeShowcasePrompt(prompt: string): boolean {
  return /소개|홍보|랜딩|브랜드|포트폴리오|홈페이지|사이트|웹페이지|landing|portfolio|showcase/i.test(prompt);
}

function newJobId(): string {
  const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 12);

  return `j${Date.now().toString(36)}-${rand}`;
}

async function reserveUrls(jobId: string): Promise<Skeleton7ImageUrls | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), RESERVE_TIMEOUT_MS);

  try {
    const response = await fetch('/api/media-images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reserve: true, jobId }),
      signal: controller.signal,
    });

    if (!response.ok) {
      logger.warn('reserve failed', response.status);
      return null;
    }

    const data = (await response.json()) as { images?: Skeleton7ImageUrls };

    return data.images ?? null;
  } catch (error) {
    logger.warn('reserve errored', error);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/*
 * chatId는 온보딩이 끝나는 시점에 아직 undefined다(PromptClarification의 saveOnboardingResponse가
 * ensureChatId()를 await 없이 호출) — 요청 직전에 여기서 직접 확정한다.
 */
async function requestImageSet(jobId: string, input: Skeleton7ImageJobInput): Promise<Skeleton7ImageUrls | null> {
  const chatId = (await ensureChatId().catch(() => undefined)) ?? chatIdAtom.get();

  if (!chatId) {
    logger.warn('image set skipped — no chatId');
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch('/api/media-images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...input, jobId, chatId }),
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

export interface PreparedSkeleton7Images {
  urls: Skeleton7ImageUrls;

  /** "추가로 알려주신 내용:" 블록에 붙일 줄들. */
  promptLines: string[];
}

function buildPromptLines(urls: Skeleton7ImageUrls): string[] {
  return [
    `사진 4장(사용자가 준 실제 URL — 반드시 이 URL 그대로 <img src>에 쓴다, 다른 이미지 URL이나 플레이스홀더 금지): 히어로 전면 배경 = ${urls.hero} · 챕터 1 = ${urls.ch1} · 챕터 2 = ${urls.ch2} · 챕터 3 = ${urls.ch3}`,
    '사진이 있으므로 코랄 틴트 플레이스홀더 박스와 "사진을 보내주시면 여기에 넣어드릴게요" 문구는 어디에도 쓰지 않는다. 히어로는 이미지를 전면(objectFit cover, 100vh)으로 깔고 그 위에 어두운 그라데이션과 흰 헤드라인을 올린다. 챕터 1~3은 각 이미지를 4:3 비율로 캡션 옆에 놓는다(loading="lazy", alt는 업종에 맞는 짧은 설명).',
  ];
}

/**
 * 생성 직전에 호출 — URL을 예약하고 이미지 생성을 시작한다(결과는 기다리지 않는다). 예약이 실패하면
 * null을 돌려주고, 생성 뒤 폴백(applySkeleton7Images의 정규식 주입)만 남는다.
 */
export async function prepareSkeleton7Images(input: Skeleton7ImageJobInput): Promise<PreparedSkeleton7Images | null> {
  lastInput = input;

  if (pending) {
    return { urls: pending.urls, promptLines: buildPromptLines(pending.urls) };
  }

  const jobId = newJobId();
  const urls = await reserveUrls(jobId);

  if (!urls || !urls.hero) {
    return null;
  }

  logger.info('image set job started', { jobId, industry: input.industry });
  pending = { jobId, urls, promise: requestImageSet(jobId, input) };

  return { urls, promptLines: buildPromptLines(urls) };
}

/** 골격 7 기본값이 아닐 때 — 시작은 안 하고 재료만 기억해둔다(생성물이 골격 7로 나오면 그때 시작). */
export function rememberSkeleton7Context(input: Skeleton7ImageJobInput): void {
  lastInput = input;
}

export interface ApplyResult {
  filesWritten: string[];
  injected: string[];
  missing: string[];
  mode: 'prompted' | 'injected';
}

function addCacheBuster(content: string, urls: Skeleton7ImageUrls, stamp: number): string {
  let next = content;

  for (const url of Object.values(urls)) {
    if (url) {
      next = next.split(url).join(`${url}?v=${stamp}`);
    }
  }

  return next;
}

export async function applySkeleton7Images(): Promise<ApplyResult | null> {
  const files = workbenchStore.files.get();
  const reviewable = selectReviewableEntries(files);
  const heroUrl = pending?.urls.hero;
  const alreadyPrompted = heroUrl ? reviewable.some(([, file]) => file.content.includes(heroUrl)) : false;
  const skeleton7Entries = reviewable.filter(([, file]) => isSkeleton7File(file.content));

  if (!alreadyPrompted && skeleton7Entries.length === 0) {
    if (pending) {
      logger.info('generated app is not skeleton 7 — discarding pre-started image set');
      pending = null;
    } else {
      logger.info('generated app is not skeleton 7 — nothing to inject');
    }

    return null;
  }

  if (!pending) {
    if (!lastInput) {
      logger.warn('skeleton 7 detected but no onboarding context — image set skipped');
      return null;
    }

    logger.info('skeleton 7 detected after generation — starting image set now');

    const prepared = await prepareSkeleton7Images(lastInput);

    if (!prepared) {
      return null;
    }
  }

  const job = pending as PendingJob;
  const urls = await job.promise;
  pending = null;

  if (!urls) {
    return null;
  }

  const filesWritten: string[] = [];

  if (alreadyPrompted) {
    // LLM이 URL을 직접 썼다 — 이미지가 미리보기보다 늦게 올라왔을 수 있으니 캐시버스터로 한 번 다시 그린다.
    const stamp = Date.now();

    for (const [filePath, file] of reviewable) {
      if (!file.content.includes(urls.hero as string) || file.content.includes(`?v=`)) {
        continue;
      }

      await workbenchStore.writeFileDirect(filePath, addCacheBuster(file.content, urls, stamp));
      filesWritten.push(filePath);
    }

    if (filesWritten.length > 0) {
      workbenchStore.resetAllFileModifications();
    }

    const summary: ApplyResult = { filesWritten, injected: [], missing: [], mode: 'prompted' };
    logger.info('applied (prompted)', summary);

    return summary;
  }

  const injected = new Set<string>();
  const missing = new Set<string>();

  for (const [filePath, file] of skeleton7Entries) {
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

  const summary: ApplyResult = { filesWritten, injected: [...injected], missing: [...missing], mode: 'injected' };
  logger.info('applied (injected)', summary);

  return summary;
}
