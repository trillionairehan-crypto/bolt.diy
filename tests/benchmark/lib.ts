/**
 * 모델 벤치마크 공용 헬퍼 — 순수 함수만. Node로 직접 실행한다(node --experimental-strip-types),
 * 별도 빌드 스텝 없음 — 그래서 상대 경로만 쓰고(별칭 ~/ 없음), 실제 앱 소스(getBaselineTemplate,
 * mechanical-checks)를 그대로 import해서 로직 중복을 피한다.
 */
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

export function baselineFileMap(): FileMap {
  const { assistantMessage: _assistantMessage } = getBaselineTemplate(FIXED_HUE);
  void _assistantMessage;

  /*
   * getBaselineTemplate는 assistantMessage 텍스트로 파일을 "표현"하지만, 실제로 필요한 건 그
   * 파일 목록 자체다 — assistantMessage를 다시 파싱하는 대신 같은 함수가 내부적으로 쓰는 파일
   * 배열을 재구성한다. getBaselineTemplate가 배열을 직접 반환하지 않으므로 텍스트에서 역파싱한다.
   */
  const { assistantMessage } = getBaselineTemplate(FIXED_HUE);
  const files = extractFilesFromAssistantText(assistantMessage);

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
