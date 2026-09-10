/**
 * 모델 벤치마크 공용 헬퍼 — 순수 함수만. Node로 직접 실행한다(node --experimental-strip-types),
 * 별도 빌드 스텝 없음 — 그래서 상대 경로만 쓰고(별칭 ~/ 없음), 실제 앱 소스(getBaselineTemplate,
 * mechanical-checks)를 그대로 import해서 로직 중복을 피한다.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { getBaselineTemplate } from '../../app/utils/selectStarterTemplate.ts';
import {
  runMechanicalChecks,
  formatMechanicalFindingsForPrompt,
  resolveHueFromFiles,
} from '../../app/lib/review/mechanical-checks.ts';

export const WORK_DIR = '/home/project';
export const FIXED_HUE = 33; // coral 기본값 — 모델 간 비교에서 팔레트를 변수로 두지 않기 위해 고정.

// --- 원가 계산 ---

export type ModelId = 'claude-sonnet-5' | 'claude-opus-5' | 'claude-fable-5-1';

interface PricePerMTok {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

/*
 * claude-api 스킬(2026-06-24 기준 캐시된 표)에서 확인한 실제 가격. 캐시 write/read는 Fable 5.1만
 * 문서에 명시값이 있고(write 1.25배는 일반 공식, read는 $0.25/MTok로 별도 명시 — 일반 0.1배 공식과
 * 다름), Opus 5/Sonnet 5는 별도 명시가 없어 Anthropic의 일반 공식(write=input*1.25, read=input*0.1)을
 * 그대로 적용했다 — 이 가정은 실제와 다를 수 있어 최종 리포트에 각주로 남긴다.
 */
export const PRICING: Record<ModelId, PricePerMTok> = {
  'claude-sonnet-5': { input: 2.0, output: 10.0, cacheWrite: 2.5, cacheRead: 0.2 },
  'claude-opus-5': { input: 5.0, output: 25.0, cacheWrite: 6.25, cacheRead: 0.5 },
  'claude-fable-5-1': { input: 10.0, output: 50.0, cacheWrite: 12.5, cacheRead: 0.25 },
};

export const USD_TO_KRW = 1400;

export interface UsageTokens {
  promptTokens: number;
  completionTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export function calcCostKrw(model: ModelId, usage: UsageTokens): number {
  const p = PRICING[model];

  /*
   * promptTokens(누적 usage)는 AI SDK 관례상 캐시 히트/생성분을 포함한 전체 입력 토큰이라, 캐시
   * 토큰만큼은 순수 미스 단가에서 빼고 각자의 단가를 적용한다(이중 계산 방지).
   */
  const uncachedPromptTokens = Math.max(usage.promptTokens - usage.cacheReadTokens - usage.cacheWriteTokens, 0);

  const usd =
    (uncachedPromptTokens / 1_000_000) * p.input +
    (usage.completionTokens / 1_000_000) * p.output +
    (usage.cacheWriteTokens / 1_000_000) * p.cacheWrite +
    (usage.cacheReadTokens / 1_000_000) * p.cacheRead;

  return usd * USD_TO_KRW;
}

// --- 파일맵 변환 ---

export interface SimpleFile {
  path: string;
  content: string;
}

export type FileMap = Record<string, { type: 'file'; content: string; isBinary: boolean }>;

export function simpleFilesToFileMap(files: SimpleFile[]): FileMap {
  const map: FileMap = {};

  for (const f of files) {
    const path = f.path.startsWith(WORK_DIR) ? f.path : `${WORK_DIR}/${f.path}`;
    map[path] = { type: 'file', content: f.content, isBinary: false };
  }

  return map;
}

export function flatRecordToFileMap(record: Record<string, string>): FileMap {
  const map: FileMap = {};

  for (const [path, content] of Object.entries(record)) {
    map[path] = { type: 'file', content, isBinary: false };
  }

  return map;
}

export function fileMapToFlatRecord(map: FileMap): Record<string, string> {
  const record: Record<string, string> = {};

  for (const [path, entry] of Object.entries(map)) {
    record[path] = entry.content;
  }

  return record;
}

// --- boltArtifact 파싱 (스트리밍 파서 대신 완결된 텍스트에서 정규식으로 추출 — 벤치마크용 단순화) ---

const BOLT_ACTION_FILE_REGEX = /<boltAction\s+type="file"\s+filePath="([^"]+)"[^>]*>([\s\S]*?)<\/boltAction>/g;

export function extractFilesFromAssistantText(text: string): SimpleFile[] {
  const files: SimpleFile[] = [];

  for (const match of text.matchAll(BOLT_ACTION_FILE_REGEX)) {
    const [, path, rawContent] = match;

    // 모델이 앞뒤로 개행 하나씩 넣는 습관이 있어(가독성) 앞뒤 개행 1개씩만 벗긴다 — trim()은 들여쓰기까지 깎아 과함.
    const content = rawContent.replace(/^\n/, '').replace(/\n$/, '');
    files.push({ path, content });
  }

  return files;
}

// --- 기준 프로젝트(첫 생성 시드) ---

/*
 * 출시 블로커 조사(2026-09-10)로 발견: coralredKit.ts가 `~design-handoff/coralred-ui.css?raw`로
 * 킷 CSS를 읽는데, 이 harness는 esbuild로 번들해서 node로 직접 실행한다(bundleAndRun.cjs) — esbuild는
 * Vite의 `?raw` 원문 로더 규칙을 모르고 조용히 빈 객체({})로 resolve해버려서, 템플릿 리터럴에 꽂히는
 * 순간 문자열 "[object Object]"가 된다(에러도 안 남, esbuild가 unknown import를 에러 없이 빈 객체로
 * 처리). 프로덕션(Vite/Remix)에서는 `?raw`가 정상 동작해 실제 생성물에는 영향 없다 — harness 전용
 * 버그. 디스크에서 직접 읽어 대체한다.
 */
const REAL_CORALRED_UI_CSS = (() => {
  try {
    return readFileSync(path.resolve('design-handoff/coralred-ui.css'), 'utf-8');
  } catch {
    return null;
  }
})();

export function baselineFileMap(): FileMap {
  const { assistantMessage } = getBaselineTemplate(FIXED_HUE);
  const files = extractFilesFromAssistantText(assistantMessage);

  if (REAL_CORALRED_UI_CSS) {
    for (const file of files) {
      if (file.path.endsWith('public/coralred-ui.css') && file.content.trim() === '[object Object]') {
        file.content = REAL_CORALRED_UI_CSS;
      }
    }
  }

  return simpleFilesToFileMap(files);
}

export function baselineUserFollowup(): string {
  return getBaselineTemplate(FIXED_HUE).userMessage;
}

// --- 메시지 태깅 ---

export function taggedMessage(model: ModelId, providerName: string, content: string): string {
  return `[Model: ${model}]\n\n[Provider: ${providerName}]\n\n${content}`;
}

// --- 기계 검사 래퍼 ---

export function runChecks(fileMapOrRecord: FileMap | Record<string, string>) {
  const record =
    typeof Object.values(fileMapOrRecord)[0] === 'string'
      ? (fileMapOrRecord as Record<string, string>)
      : fileMapToFlatRecord(fileMapOrRecord as FileMap);

  const hue = resolveHueFromFiles(record) ?? FIXED_HUE;

  return { ...runMechanicalChecks(record, hue), hue };
}

export { formatMechanicalFindingsForPrompt };
