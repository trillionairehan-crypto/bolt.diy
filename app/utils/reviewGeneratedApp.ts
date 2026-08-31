import type { ProviderInfo } from '~/types/model';
import type { File as FileEntry, FileMap } from '~/lib/stores/files';
import { PROVIDER_LIST, WORK_DIR } from './constants';
import { buildReviewSystemPrompt, buildVisualReviewSystemPrompt } from '~/lib/common/prompts/review-checklist';
import {
  formatMechanicalFindingsForPrompt,
  resolveHueFromFiles,
  runMechanicalChecks,
  type MechanicalFinding,
} from '~/lib/review/mechanical-checks';
import { workbenchStore } from '~/lib/stores/workbench';
import { createScopedLogger } from './logger';

/**
 * 생성물 자동 검토(auto-review) — 첫 생성의 미리보기가 성공적으로 뜬 직후 한 번, 채팅 파이프라인
 * 밖에서 별도로 도는 검토 호출. sendMessage()/generationChargeGateRef를 거치지 않아 차감이 없고,
 * 채팅 메시지 배열에도 전혀 안 들어가 사용자 화면에 흔적이 남지 않는다. 실패/타임아웃이면 무조건
 * 원본을 그대로 두고 조용히 리턴한다 — 검토 때문에 멀쩡한 생성이 망가지면 안 된다.
 *
 * 3단계: 기계 검사(확정적, MECHANICAL_CHECKS_PLAN 승인) -> 텍스트 검토(Haiku) -> 시각 검토(Sonnet,
 * 스크린샷 기반) 순으로 돈다. 파일 쓰기는 WebContainer HMR을 매번 흔들어 미리보기가 깜빡이므로 두
 * 번으로 고정한다: 1) 기계+텍스트 결과를 합쳐 한 번, 2) 시각 결과를 한 번. 기계 검사 자체는 store에
 * 아무것도 쓰지 않고 메모리에서만 텍스트 검토 입력에 반영된다(applyMechanicalFixesInMemory).
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

/** 검토 대상 파일(src/** 아래 텍스트 파일)만 골라낸다 — 기계 검사와 텍스트 검토가 같은 집합을 본다. */
export function selectReviewableEntries(files: FileMap): Array<[string, FileEntry]> {
  const srcPrefix = `${WORK_DIR}/src/`;

  return Object.entries(files).filter((entry): entry is [string, FileEntry] => {
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
}

/**
 * 검토 대상 파일을 프롬프트 입력으로 직렬화한다. 호출/파싱/적용 로직과 분리해둔 이유: 시각 검토가
 * 스크린샷을 추가로 붙일 때도 이 함수는 그대로 재사용하기 위함.
 */
export function buildReviewInput(files: FileMap): ReviewInput {
  const entries = selectReviewableEntries(files);
  const text = entries.map(([filePath, file]) => `--- ${filePath} ---\n${file.content}`).join('\n\n');

  return { text, fileCount: entries.length };
}

/** --hue 탐색은 src/** 밖(주로 index.html)도 봐야 해서 필터링 없이 전체 파일을 텍스트로 변환한다. */
function toContentRecord(files: FileMap): Record<string, string> {
  const record: Record<string, string> = {};

  for (const [filePath, dirent] of Object.entries(files)) {
    if (dirent && dirent.type === 'file' && !dirent.isBinary) {
      record[filePath] = dirent.content;
    }
  }

  return record;
}

/** 기계 검사가 고친 내용을 store에는 아직 쓰지 않고 메모리상의 FileMap에만 반영한다(1회 쓰기 원칙). */
function mergeContentIntoFileMap(files: FileMap, updates: Record<string, string>): FileMap {
  if (Object.keys(updates).length === 0) {
    return files;
  }

  const merged: FileMap = { ...files };

  for (const [filePath, content] of Object.entries(updates)) {
    const existing = files[filePath];

    if (existing && existing.type === 'file') {
      merged[filePath] = { ...existing, content };
    }
  }

  return merged;
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
    logger.info('applyFiles: wrote batch', { count: filesWritten.length, files: filesWritten });
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

export interface TextReviewOutcome {
  issues: string[];
  files: Record<string, string>;
}

/**
 * 순수 호출/파싱만 한다 — store에 쓰지 않는다(2회 쓰기 원칙, orchestration이 기계 검사 결과와 합쳐서
 * 한 번에 쓴다). `mechanicalHints`는 기계 검사가 이미 고친 자리(다시 건드리지 말라는 목록)와 힌트
 * (3·5번 항목)를 message 앞에 붙인다.
 */
async function runTextReview(files: FileMap, mechanicalHints: string): Promise<TextReviewOutcome | null> {
  const provider = PROVIDER_LIST.find((p) => p.name === AUTO_REVIEW_PROVIDER_NAME) as ProviderInfo | undefined;

  if (!provider) {
    return null;
  }

  const input = buildReviewInput(files);

  if (input.fileCount === 0) {
    return null;
  }

  const message = mechanicalHints ? `${mechanicalHints}\n\n${input.text}` : input.text;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AUTO_REVIEW_TEXT_TIMEOUT_MS);

  try {
    const response = await fetch('/api/llmcall', {
      method: 'POST',
      signal: controller.signal,
      body: JSON.stringify({
        message,
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

    logger.info('text review: parsed result', {
      issueCount: parsed.issues.length,
      fileCount: Object.keys(parsed.files).length,
      usage,
    });

    return { issues: parsed.issues, files: parsed.files };
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

export interface VisualReviewOutcome {
  issues: VisualIssue[];
  files: Record<string, string>;
  screenshotCaptured: boolean;
}

/**
 * 오탐 방지 게이트: confidence:high이고 element가 특정된 지적이 최소 하나 없으면, files에 뭐가
 * 들어있든 전부 무시한다(적용 안 함) — 프롬프트로만 지시하는 게 아니라 코드에서도 강제. 파일 개수가
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

/** 순수 호출/파싱만 한다 — store에 쓰지 않는다(applyFiles는 orchestration이 한 번만 호출). */
async function runVisualReview(
  files: FileMap,
  model: string = AUTO_REVIEW_VISUAL_MODEL,
): Promise<VisualReviewOutcome | null> {
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

    return { issues: parsed.issues, files: applicable, screenshotCaptured: true };
  } catch (error) {
    logger.error('visual review: failed', error);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/*
 * PREVIEW_SETTLE_FIX(2026-09-01): write #1(기계+텍스트 결과)이 WebContainer의 fs에 반영되면 Vite
 * HMR이 돌아 iframe이 다시 렌더된다. 이 순간과 스크린샷 캡처 사이에 간격이 없으면 시각 검토가 옛
 * 화면(수정 전)을 보고 기계/텍스트가 이미 고친 걸 또 지적하게 된다. inspector-script.js의
 * VITE_COMPILE_OK는 "최초 1회"만 발화하는 래치라 재렌더 완료 신호로 재사용할 수 없어(Preview.tsx의
 * firstRenderConfirmed 가드), 정확한 "이 HMR 사이클이 끝났다" 신호 대신 고정 지연을 쓴다 — 값은
 * 실제 생성물로 실측해서 정한 것(아래 검증 보고 참고).
 */
const PREVIEW_SETTLE_DELAY_MS = 1500;

async function waitForPreviewToSettle(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, PREVIEW_SETTLE_DELAY_MS));
}

// --- 오케스트레이션 ---

export interface AutoReviewResult {
  mechanicalFindings: MechanicalFinding[];
  textIssues: string[];
  visualIssues: VisualIssue[];
  filesWritten: string[];
  screenshotCaptured: boolean;
}

/**
 * 체크리스트 검토를 별도 LLM 호출로 실행한다 — app/utils/generateAppQuestions.ts와 같은
 * "/api/llmcall 호출 → JSON 파싱 → 실패 시 조용히 null" 패턴. 파일 쓰기는 정확히 두 번:
 *   1) 기계 검사(메모리에서만 반영) + 텍스트 검토 결과를 합쳐서 한 번
 *   2) 시각 검토 결과가 있으면 한 번 더
 * 기계 검사는 store에 아무것도 쓰지 않고, 텍스트 검토 입력에 이미 반영된 상태로 넘어간다 — 그래서
 * LLM이 같은 자리를 다시 고치려 들지 않도록 "이미 수정됨" 목록도 함께 전달한다.
 */
export async function reviewGeneratedApp(): Promise<AutoReviewResult | null> {
  const initialFiles = workbenchStore.files.get();
  const reviewableEntries = selectReviewableEntries(initialFiles);

  if (reviewableEntries.length === 0) {
    return null;
  }

  const reviewableRecord: Record<string, string> = Object.fromEntries(
    reviewableEntries.map(([filePath, file]) => [filePath, file.content]),
  );

  const resolvedHue = resolveHueFromFiles(toContentRecord(initialFiles));

  const mechanicalStart = performance.now();
  let mechanical: { findings: MechanicalFinding[]; updatedFiles: Record<string, string> } = {
    findings: [],
    updatedFiles: {},
  };

  try {
    mechanical = runMechanicalChecks(reviewableRecord, resolvedHue);
  } catch (error) {
    logger.error('mechanical checks: failed, skipping', error);
  }

  logger.info('mechanical checks: done', {
    elapsedMs: Math.round(performance.now() - mechanicalStart),
    findingCount: mechanical.findings.length,
    autoFixedCount: mechanical.findings.filter((f) => f.autoFixed).length,
    hueResolved: resolvedHue !== null,
  });

  const filesForTextReview = mergeContentIntoFileMap(initialFiles, mechanical.updatedFiles);
  const hints = formatMechanicalFindingsForPrompt(mechanical.findings);
  const textResult = await runTextReview(filesForTextReview, hints);

  // write #1: 기계 검사 자동수정 + 텍스트 검토 결과를 합쳐서 한 번에 쓴다(텍스트가 겹치는 파일의 최종본).
  const writeBatch1: Record<string, string> = { ...mechanical.updatedFiles, ...(textResult?.files ?? {}) };
  const filesWrittenBatch1 = Object.keys(writeBatch1).length > 0 ? await applyFiles(writeBatch1, initialFiles) : [];

  if (textResult === null) {
    /*
     * 텍스트 검토 자체가 통째로 실패(provider 없음/네트워크 오류 등)면 시각 검토도 의미가 없다.
     * 기계 검사 결과는 이미 안전하게 검증된 것이므로 write #1에 반영된 채로 남긴다.
     */
    if (filesWrittenBatch1.length === 0 && mechanical.findings.length === 0) {
      return null;
    }

    return {
      mechanicalFindings: mechanical.findings,
      textIssues: [],
      visualIssues: [],
      filesWritten: filesWrittenBatch1,
      screenshotCaptured: false,
    };
  }

  if (filesWrittenBatch1.length > 0) {
    await waitForPreviewToSettle();
  }

  const filesAfterBatch1 = workbenchStore.files.get();
  const visualResult = await runVisualReview(filesAfterBatch1);

  // write #2: 시각 검토 결과가 있으면 한 번 더.
  const filesWrittenBatch2 =
    visualResult && Object.keys(visualResult.files).length > 0
      ? await applyFiles(visualResult.files, filesAfterBatch1)
      : [];

  return {
    mechanicalFindings: mechanical.findings,
    textIssues: textResult.issues,
    visualIssues: visualResult?.issues ?? [],
    filesWritten: [...filesWrittenBatch1, ...filesWrittenBatch2],
    screenshotCaptured: visualResult?.screenshotCaptured ?? false,
  };
}
