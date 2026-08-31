import type { ProviderInfo } from '~/types/model';
import type { File as FileEntry, FileMap } from '~/lib/stores/files';
import { PROVIDER_LIST, WORK_DIR } from './constants';
import { buildReviewSystemPrompt } from '~/lib/common/prompts/review-checklist';
import { workbenchStore } from '~/lib/stores/workbench';
import { createScopedLogger } from './logger';

/**
 * 생성물 자동 검토(auto-review) — 첫 생성의 미리보기가 성공적으로 뜬 직후 한 번, 채팅 파이프라인
 * 밖에서 별도로 도는 검토 호출. sendMessage()/generationChargeGateRef를 거치지 않아 차감이 없고,
 * 채팅 메시지 배열에도 전혀 안 들어가 사용자 화면에 흔적이 남지 않는다. 실패/타임아웃이면 무조건
 * 원본을 그대로 두고 조용히 리턴한다 — 검토 때문에 멀쩡한 생성이 망가지면 안 된다.
 */

const logger = createScopedLogger('AutoReview');

export const AUTO_REVIEW_MODEL = 'claude-haiku-4-5';
export const AUTO_REVIEW_PROVIDER_NAME = 'Anthropic';

const AUTO_REVIEW_TIMEOUT_MS = 30000;

// 체크리스트가 UI/브랜딩 관심사라 대상이 아니고 토큰만 태우는 순수 보일러플레이트 타입 선언 파일.
const EXCLUDED_FILENAMES = new Set(['vite-env.d.ts']);

export interface ReviewInput {
  text: string;
  fileCount: number;
}

/**
 * 검토 대상 파일(src/** 아래 텍스트 파일)을 프롬프트 입력으로 직렬화한다. 호출/파싱/적용 로직과
 * 분리해둔 이유: 다음 라운드에서 미리보기 스크린샷을 입력에 추가할 때(review-checklist.ts의
 * kind:'visual' 항목 활성화와 함께) 이 함수 시그니처만 확장하면 되게 하기 위함 — 이번 라운드는
 * 텍스트만 채운다.
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

interface RawReviewResult {
  issues: string[];
  files: Record<string, string>;
}

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);

  return fenced ? fenced[1].trim() : trimmed;
}

function isValidRawResult(value: unknown): value is RawReviewResult {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;

  if (!Array.isArray(record.issues) || !record.issues.every((issue) => typeof issue === 'string')) {
    return false;
  }

  if (!record.files || typeof record.files !== 'object' || Array.isArray(record.files)) {
    return false;
  }

  return Object.entries(record.files as Record<string, unknown>).every(
    ([filePath, content]) => typeof filePath === 'string' && typeof content === 'string',
  );
}

export interface AutoReviewResult {
  issues: string[];
  filesWritten: string[];
}

/**
 * 체크리스트 검토를 별도 LLM 호출(기본 Haiku 4.5)로 실행한다 — app/utils/generateAppQuestions.ts와
 * 같은 "/api/llmcall 호출 → JSON 파싱 → 실패 시 조용히 null" 패턴. 수정할 파일이 있으면
 * workbenchStore.writeFileDirect로 직접 써서 기존 파일을 덮어쓴다(새 파일은 만들 수 없음 —
 * FilesStore.saveFile이 이미 존재하는 경로만 받는다).
 */
export async function reviewGeneratedApp(): Promise<AutoReviewResult | null> {
  const provider = PROVIDER_LIST.find((p) => p.name === AUTO_REVIEW_PROVIDER_NAME) as ProviderInfo | undefined;

  if (!provider) {
    return null;
  }

  const files = workbenchStore.files.get();
  const input = buildReviewInput(files);

  if (input.fileCount === 0) {
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AUTO_REVIEW_TIMEOUT_MS);

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
      logger.error('llmcall failed', response.status);
      return null;
    }

    const { text, usage } = (await response.json()) as { text: string; usage?: unknown };
    const parsed: unknown = JSON.parse(stripCodeFences(text));

    if (!isValidRawResult(parsed)) {
      logger.error('response failed schema validation', text.slice(0, 200));
      return null;
    }

    const fileEntries = Object.entries(parsed.files);

    logger.info('parsed result', { issueCount: parsed.issues.length, fileCount: fileEntries.length, usage });

    if (fileEntries.length === 0) {
      return { issues: parsed.issues, filesWritten: [] };
    }

    const filesWritten: string[] = [];

    for (const [filePath, content] of fileEntries) {
      const existing = files[filePath];

      if (!existing || existing.type !== 'file') {
        logger.error('skipped unknown file path', filePath);
        continue;
      }

      await workbenchStore.writeFileDirect(filePath, content);
      filesWritten.push(filePath);
    }

    // 검토의 diff가 사용자의 다음 후속 메시지에 "같이 변경된 파일"로 조용히 끼어들지 않게 한다.
    workbenchStore.resetAllFileModifications();

    return { issues: parsed.issues, filesWritten };
  } catch (error) {
    logger.error('failed', error);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
