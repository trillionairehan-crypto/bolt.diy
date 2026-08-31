import type { ProviderInfo } from '~/types/model';
import type { File as FileEntry, FileMap } from '~/lib/stores/files';
import { PROVIDER_LIST, WORK_DIR } from './constants';
import { buildReviewSystemPrompt, buildVisualReviewSystemPrompt } from '~/lib/common/prompts/review-checklist';
import { workbenchStore } from '~/lib/stores/workbench';
import { createScopedLogger } from './logger';

/**
 * 생성물 자동 검토(auto-review) — 첫 생성의 미리보기가 성공적으로 뜬 직후 한 번, 채팅 파이프라인
 * 밖에서 별도로 도는 검토 호출. sendMessage()/generationChargeGateRef를 거치지 않아 차감이 없고,
 * 채팅 메시지 배열에도 전혀 안 들어가 사용자 화면에 흔적이 남지 않는다. 실패/타임아웃이면 무조건
 * 원본을 그대로 두고 조용히 리턴한다 — 검토 때문에 멀쩡한 생성이 망가지면 안 된다.
 *
 * 2단계: 텍스트 검토(1단계, Haiku) 다음에 시각 검토(스크린샷 기반)를 순서대로 돌린다 — 동시에
 * 돌리면 둘 다 같은 파일을 고치려 할 때 쓰기가 겹칠 수 있어서 순차 실행으로 그 레이스를 피한다.
 * 시각 검토는 스크린샷 캡처가 실패/타임아웃이면 조용히 건너뛴다(텍스트 검토 결과는 이미 적용된 채로
 * 남는다) — 캡처 실패가 전체 검토를 막지 않는다.
 */

const logger = createScopedLogger('AutoReview');

export const AUTO_REVIEW_MODEL = 'claude-haiku-4-5';

/*
 * Haiku 4.5 실측(2026-09-01): 같은 스크린샷에서 high-confidence 지적 0개 — 시각 항목은 텍스트보다
 * "실제로 보고 판단"해야 하는 비중이 커서, 안전하게 아무것도 안 하는 쪽으로만 수렴했다. Sonnet 5는
 * 같은 스크린샷에서 구체적 요소를 짚은 high-confidence 지적 2개(뷰포트 대비 빈 공간, 줄바꿈으로 인한
 * 기준선 어긋남 — 둘 다 스크린샷 없이는 판단 불가능한 것들) — 텍스트 검토(Haiku)와 분리해서 시각
 * 검토만 Sonnet으로 올린다.
 */
export const AUTO_REVIEW_VISUAL_MODEL = 'claude-sonnet-5';
export const AUTO_REVIEW_PROVIDER_NAME = 'Anthropic';

// 텍스트 검토(Haiku)는 실측 응답 시간 편차가 3.6~30.6초로 커서 여유를 더 둔다.
const AUTO_REVIEW_TEXT_TIMEOUT_MS = 45000;

// 시각 검토(Sonnet, thinking 비활성)는 메인 생성(120~160초)에 비해 60초를 더해도 비율상 크지 않다.
const AUTO_REVIEW_VISUAL_TIMEOUT_MS = 60000;

const MAX_VISUAL_FIX_FILES = 2;

// 체크리스트가 UI/브랜딩 관심사라 대상이 아니고 토큰만 태우는 순수 보일러플레이트 타입 선언 파일.
const EXCLUDED_FILENAMES = new Set(['vite-env.d.ts']);

export interface ReviewInput {
  text: string;
  fileCount: number;
}

/**
 * 검토 대상 파일(src/** 아래 텍스트 파일)을 프롬프트 입력으로 직렬화한다. 호출/파싱/적용 로직과
 * 분리해둔 이유: 시각 검토가 스크린샷을 추가로 붙일 때도 이 함수는 그대로 재사용하기 위함.
 */
export function buildReviewInput(files: FileMap): ReviewInput {
  const srcPrefix = `${WORK_DIR}/src/`;

  const entries = Object.entries(files).filter((entry): entry is [string, FileEntry] => {
    const [filePath, dirent] = entry;

    if (!dirent || dirent.type !== 'file' || dirent.isBinary) {
      return false;
    }

    if (!filePath.startsWith(srcPrefix)) {
      return false;
    }

    const fileName = filePath.slice(filePath.lastIndexOf('/') + 1);

    return !EXCLUDED_FILENAMES.has(fileName);
  });

  const text = entries.map(([filePath, file]) => `--- ${filePath} ---\n${file.content}`).join('\n\n');

  return { text, fileCount: entries.length };
}

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);

  return fenced ? fenced[1].trim() : trimmed;
}

function isPlainFilesRecord(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  return Object.entries(value as Record<string, unknown>).every(
    ([filePath, content]) => typeof filePath === 'string' && typeof content === 'string',
  );
}

/** 파일이 실제로 이미 존재할 때만 적용하고(새 파일 생성 불가), 결과를 workbenchStore에 반영한다. */
async function applyFiles(candidateFiles: Record<string, string>, currentFiles: FileMap): Promise<string[]> {
  const filesWritten: string[] = [];

  for (const [filePath, content] of Object.entries(candidateFiles)) {
    const existing = currentFiles[filePath];

    if (!existing || existing.type !== 'file') {
      logger.error('skipped unknown file path', filePath);
      continue;
    }

    await workbenchStore.writeFileDirect(filePath, content);
    filesWritten.push(filePath);
  }

  if (filesWritten.length > 0) {
    // 검토의 diff가 사용자의 다음 후속 메시지에 "같이 변경된 파일"로 조용히 끼어들지 않게 한다.
    workbenchStore.resetAllFileModifications();
  }

  return filesWritten;
}

// --- 1단계: 텍스트 검토 ---

interface RawTextReviewResult {
  issues: string[];
  files: Record<string, string>;
}

function isValidRawTextResult(value: unknown): value is RawTextReviewResult {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;

  if (!Array.isArray(record.issues) || !record.issues.every((issue) => typeof issue === 'string')) {
    return false;
  }

  return isPlainFilesRecord(record.files);
}

export interface TextReviewResult {
  issues: string[];
  filesWritten: string[];
}

async function runTextReview(files: FileMap): Promise<TextReviewResult | null> {
  const provider = PROVIDER_LIST.find((p) => p.name === AUTO_REVIEW_PROVIDER_NAME) as ProviderInfo | undefined;

  if (!provider) {
    return null;
  }

  const input = buildReviewInput(files);

  if (input.fileCount === 0) {
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AUTO_REVIEW_TEXT_TIMEOUT_MS);

  try {
    const response = await fetch('/api/llmcall', {
      method: 'POST',
      signal: controller.signal,
      body: JSON.stringify({
        message: input.text,
        model: AUTO_REVIEW_MODEL,
        provider,
        system: buildReviewSystemPrompt(),
      }),
    });

    if (!response.ok) {
      logger.error('text review: llmcall failed', response.status);
      return null;
    }

    const { text, usage } = (await response.json()) as { text: string; usage?: unknown };
    const parsed: unknown = JSON.parse(stripCodeFences(text));

    if (!isValidRawTextResult(parsed)) {
      logger.error('text review: response failed schema validation', text.slice(0, 200));
      return null;
    }

    const fileEntries = Object.entries(parsed.files);
    logger.info('text review: parsed result', {
      issueCount: parsed.issues.length,
      fileCount: fileEntries.length,
      usage,
    });

    const filesWritten = fileEntries.length > 0 ? await applyFiles(parsed.files, files) : [];

    return { issues: parsed.issues, filesWritten };
  } catch (error) {
    logger.error('text review: failed', error);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

// --- 2단계: 시각 검토 ---

export interface VisualIssue {
  description: string;
  element: string;
  confidence: 'high' | 'medium' | 'low';
}

interface RawVisualReviewResult {
  issues: VisualIssue[];
  files: Record<string, string>;
}

function isValidRawVisualResult(value: unknown): value is RawVisualReviewResult {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;

  if (!Array.isArray(record.issues)) {
    return false;
  }

  const validIssues = record.issues.every(
    (issue) =>
      issue &&
      typeof issue === 'object' &&
      typeof (issue as Record<string, unknown>).description === 'string' &&
      typeof (issue as Record<string, unknown>).element === 'string' &&
      ['high', 'medium', 'low'].includes((issue as Record<string, unknown>).confidence as string),
  );

  if (!validIssues) {
    return false;
  }

  return isPlainFilesRecord(record.files);
}

export interface VisualReviewResult {
  issues: VisualIssue[];
  filesWritten: string[];
  screenshotCaptured: boolean;
}

/**
 * 오탐 방지 게이트: confidence:high이고 element가 특정된 지적이 최소 하나 없으면, files에 뭐가
 *들어있든 전부 무시한다(적용 안 함) — 프롬프트로만 지시하는 게 아니라 코드에서도 강제. 파일 개수가
 * 2개를 넘어도 전부 무시한다("최대 2개" 위반이면 부분 적용 대신 아예 적용 안 함 — 일부만 적용하면
 * 서로 의존하는 변경이 어중간하게 반영될 위험이 있음).
 */
function selectApplicableVisualFixes(parsed: RawVisualReviewResult): Record<string, string> {
  const fileCount = Object.keys(parsed.files).length;

  if (fileCount === 0) {
    return {};
  }

  if (fileCount > MAX_VISUAL_FIX_FILES) {
    logger.error('visual review: rejected — exceeded max file count', fileCount);
    return {};
  }

  const hasHighConfidenceLocalizedIssue = parsed.issues.some(
    (issue) => issue.confidence === 'high' && issue.element.trim().length > 0,
  );

  if (!hasHighConfidenceLocalizedIssue) {
    logger.error('visual review: rejected — no high-confidence localized issue backs the proposed fix');
    return {};
  }

  return parsed.files;
}

async function runVisualReview(
  files: FileMap,
  model: string = AUTO_REVIEW_VISUAL_MODEL,
): Promise<VisualReviewResult | null> {
  const provider = PROVIDER_LIST.find((p) => p.name === AUTO_REVIEW_PROVIDER_NAME) as ProviderInfo | undefined;

  if (!provider) {
    return null;
  }

  const screenshot = await workbenchStore.requestPreviewScreenshot();

  if (!screenshot) {
    logger.info('visual review: no screenshot available, skipping');
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AUTO_REVIEW_VISUAL_TIMEOUT_MS);

  try {
    const response = await fetch('/api/llmcall', {
      method: 'POST',
      signal: controller.signal,
      body: JSON.stringify({
        message: '아래는 방금 생성된 앱의 미리보기 스크린샷입니다(데스크톱 1280×800, 첫 화면).',
        model,
        provider,
        system: buildVisualReviewSystemPrompt(),
        image: screenshot,
      }),
    });

    if (!response.ok) {
      logger.error('visual review: llmcall failed', response.status);
      return null;
    }

    const { text, usage } = (await response.json()) as { text: string; usage?: unknown };
    const parsed: unknown = JSON.parse(stripCodeFences(text));

    if (!isValidRawVisualResult(parsed)) {
      logger.error('visual review: response failed schema validation', text.slice(0, 300));
      return null;
    }

    logger.info('visual review: parsed result', {
      model,
      issueCount: parsed.issues.length,
      fileCount: Object.keys(parsed.files).length,
      usage,
    });

    const applicable = selectApplicableVisualFixes(parsed);
    const filesWritten = Object.keys(applicable).length > 0 ? await applyFiles(applicable, files) : [];

    return { issues: parsed.issues, filesWritten, screenshotCaptured: true };
  } catch (error) {
    logger.error('visual review: failed', error);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

// --- 오케스트레이션 ---

export interface AutoReviewResult {
  textIssues: string[];
  visualIssues: VisualIssue[];
  filesWritten: string[];
  screenshotCaptured: boolean;
}

/**
 * 체크리스트 검토를 별도 LLM 호출로 실행한다 — app/utils/generateAppQuestions.ts와 같은
 * "/api/llmcall 호출 → JSON 파싱 → 실패 시 조용히 null" 패턴. 텍스트 검토를 먼저 적용하고, 그
 * 다음(같은 파일에 대한 쓰기 레이스를 피하려고 동시가 아니라 순차로) 시각 검토를 돌린다.
 */
export async function reviewGeneratedApp(): Promise<AutoReviewResult | null> {
  const textResult = await runTextReview(workbenchStore.files.get());

  // 텍스트 검토 자체가 통째로 실패(provider 없음/파일 0개)면 시각 검토도 의미가 없다.
  if (textResult === null) {
    return null;
  }

  const filesAfterTextReview = workbenchStore.files.get();
  const visualResult = await runVisualReview(filesAfterTextReview);

  const filesWritten = [...textResult.filesWritten, ...(visualResult?.filesWritten ?? [])];

  return {
    textIssues: textResult.issues,
    visualIssues: visualResult?.issues ?? [],
    filesWritten,
    screenshotCaptured: visualResult?.screenshotCaptured ?? false,
  };
}
