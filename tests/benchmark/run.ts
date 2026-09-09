/**
 * 모델 벤치마크 오케스트레이터. 사용법:
 *   node tests/benchmark/.dist/run.mjs <dev서버 로그 파일 경로> [--only=<model>] [--cases=<n>]
 *
 * 순차 실행(레이트 리밋 방지) — 동시 호출 없음. 진행 상황은 tests/benchmark/progress.log에 계속 남는다.
 */
import { writeFileSync, appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  type ModelId,
  type FileMap,
  baselineFileMap,
  baselineUserFollowup,
  extractFilesFromAssistantText,
  simpleFilesToFileMap,
  flatRecordToFileMap,
  fileMapToFlatRecord,
  runChecks,
  formatMechanicalFindingsForPrompt,
  calcCostKrw,
} from './lib.ts';
import { callChat, userMessage, assistantMessage, type ChatMessage } from './chatClient.ts';
import { logSizeNow, extractCacheUsageSince } from './usageLog.ts';
import { getBaselineTemplate } from '../../app/utils/selectStarterTemplate.ts';

const BASE_URL = 'http://localhost:5173';
const DEV_LOG_PATH = process.argv[2];

if (!DEV_LOG_PATH) {
  console.error('사용법: run.mjs <dev서버 로그 파일 경로>');
  process.exit(1);
}

const ONLY_MODEL = process.env.BENCH_ONLY_MODEL as ModelId | undefined;
const SMOKE = process.env.BENCH_SMOKE === '1';
const MODELS: ModelId[] = ONLY_MODEL ? [ONLY_MODEL] : ['claude-sonnet-5', 'claude-opus-5', 'claude-fable-5-1'];
const PROVIDER_NAME = 'Anthropic';
const FETCH_TIMEOUT_MS = 15 * 60 * 1000; // Fable 5.1은 몇 분씩 걸릴 수 있다는 문서 경고 반영.

const RESULTS_ROOT = path.resolve('tests/benchmark/results');
const DATE_STR = new Date().toISOString().slice(0, 10);
const RUN_DIR = path.join(RESULTS_ROOT, DATE_STR);
const RECORDS_DIR = path.join(RUN_DIR, 'records');
const PROGRESS_LOG = path.resolve('tests/benchmark/progress.log');

mkdirSync(RECORDS_DIR, { recursive: true });
writeFileSync(PROGRESS_LOG, `=== 벤치마크 시작 ${new Date().toISOString()} ===\n`);

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  appendFileSync(PROGRESS_LOG, line + '\n');
}

interface RunRecord {
  category: 'first_gen' | 'normal_edit' | 'light_edit' | 'blocked_autofix';
  caseId: string;
  model: string;
  task: string;
  promptTokens: number;
  completionTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costKrw: number;
  elapsedSec: number;
  mechanicalFindingsCount: number;
  autoFixedCount: number;
  httpStatus: number;
  errorText: string | null;
  fileCount: number;
  recordFile: string;
}

const allRecords: RunRecord[] = [];

// --- 헬스체크 ---

async function isServerHealthy(): Promise<boolean> {
  try {
    const res = await fetch(BASE_URL, { signal: AbortSignal.timeout(5000) });
    return res.status === 200;
  } catch {
    return false;
  }
}

/** 3회 실패하면 false — 호출부가 실제 요청 없이 바로 server_down으로 기록하고 다음 케이스로 넘어간다. */
async function ensureServerHealthy(): Promise<boolean> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (await isServerHealthy()) {
      return true;
    }

    log(`서버 헬스체크 실패 (${attempt}/3)${attempt < 3 ? ' — 5초 대기 후 재시도' : ' — 포기, server_down으로 기록'}`);

    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  return false;
}

async function runOne(opts: {
  category: RunRecord['category'];
  caseId: string;
  model: ModelId;
  task: string;
  messages: ChatMessage[];
  files: FileMap;
  chatId: string;

  /** 리포트용 표시 이름만 다르게(예: 'claude-opus-5-thinking-on') — 실제 API에 보내는 모델은 opts.model 그대로. */
  recordLabel?: string;
}): Promise<{ text: string; files: FileMap; record: RunRecord }> {
  const displayModel = opts.recordLabel ?? opts.model;
  log(`START ${opts.category}/${opts.caseId}/${displayModel} — "${opts.task}"`);

  const offset = logSizeNow(DEV_LOG_PATH);

  let result;
  const t0 = performance.now();

  if (!(await ensureServerHealthy())) {
    result = {
      text: '',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      elapsedSec: (performance.now() - t0) / 1000,
      httpStatus: 0,
      errorText: 'server_down',
    };
  } else {
    try {
      result = await Promise.race([
        callChat({ baseUrl: BASE_URL, messages: opts.messages, files: opts.files, chatId: opts.chatId }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('client-side timeout')), FETCH_TIMEOUT_MS)),
      ]);
    } catch (error) {
      result = {
        text: '',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        elapsedSec: FETCH_TIMEOUT_MS / 1000,
        httpStatus: 0,
        errorText: String((error as Error)?.message ?? error),
      };
    }
  }

  const cache = extractCacheUsageSince(DEV_LOG_PATH, offset) ?? { cacheReadTokens: 0, cacheWriteTokens: 0 };

  const extractedFiles = extractFilesFromAssistantText(result.text);
  const newFileMap: FileMap = { ...opts.files, ...simpleFilesToFileMap(extractedFiles) };

  const checks = extractedFiles.length > 0 ? runChecks(newFileMap) : { findings: [], updatedFiles: {} };

  const usage = {
    promptTokens: result.usage.promptTokens,
    completionTokens: result.usage.completionTokens,
    cacheReadTokens: cache.cacheReadTokens,
    cacheWriteTokens: cache.cacheWriteTokens,
  };

  const record: RunRecord = {
    category: opts.category,
    caseId: opts.caseId,
    model: displayModel,
    task: opts.task,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    cacheReadTokens: usage.cacheReadTokens,
    cacheWriteTokens: usage.cacheWriteTokens,
    costKrw: Math.round(calcCostKrw(opts.model, usage) * 100) / 100,
    elapsedSec: Math.round(result.elapsedSec * 10) / 10,
    mechanicalFindingsCount: checks.findings.length,
    autoFixedCount: checks.findings.filter((f: any) => f.autoFixed).length,
    httpStatus: result.httpStatus,
    errorText: result.errorText ?? null,
    fileCount: extractedFiles.length,
    recordFile: `${opts.category}-${opts.caseId}-${displayModel}.json`,
  };

  writeFileSync(
    path.join(RECORDS_DIR, record.recordFile),
    JSON.stringify(
      {
        ...record,
        findings: checks.findings,
        responseText: result.text,
        files: fileMapToFlatRecord(newFileMap),
      },
      null,
      2,
    ),
  );

  allRecords.push(record);
  log(
    `DONE  ${opts.category}/${opts.caseId}/${displayModel} — ${record.elapsedSec}s, ${record.costKrw}원, ` +
      `기계검사 ${record.mechanicalFindingsCount}건(자동수정 ${record.autoFixedCount}), 파일 ${record.fileCount}개` +
      (record.errorText ? ` — 에러: ${record.errorText.slice(0, 200)}` : ''),
  );

  return { text: result.text, files: newFileMap, record };
}

const A_TASKS_FULL = ['미용실 예약 앱', '동네 빵집 소개 페이지', '헬스장 회원 관리'];
const B_TASKS_FULL = ['예약 목록에 검색 추가', '챕터 하나 더', '잔여 횟수 색 강조'];
const C_TASKS_FULL = ['버튼 문구 바꿔', '제목 색을 코랄로', '간격 넓혀'];
const D_FIXTURES_FULL = ['bakery', 'portfolio', 'cafe'];

const A_TASKS = SMOKE ? A_TASKS_FULL.slice(0, 1) : A_TASKS_FULL;
const B_TASKS = SMOKE ? B_TASKS_FULL.slice(0, 1) : B_TASKS_FULL;
const C_TASKS = SMOKE ? C_TASKS_FULL.slice(0, 1) : C_TASKS_FULL;
const D_FIXTURES = SMOKE ? D_FIXTURES_FULL.slice(0, 1) : D_FIXTURES_FULL;

const FIXTURES_DIR = path.resolve('tests/fixtures/generated');

const OPUS_THINKING_ON = process.env.BENCH_OPUS_THINKING_ON === '1';
const RESUME = process.env.BENCH_RESUME === '1';

function isValidRecord(rec: RunRecord | undefined): rec is RunRecord {
  return !!rec && rec.httpStatus === 200 && !rec.errorText;
}

function loadExistingRecords(): Map<string, RunRecord> {
  const map = new Map<string, RunRecord>();

  try {
    const existing: RunRecord[] = JSON.parse(readFileSync(path.join(RUN_DIR, 'all-records.json'), 'utf-8'));

    for (const rec of existing) {
      map.set(`${rec.category}:${rec.caseId}:${rec.model}`, rec);
    }
  } catch {
    log('재개할 기존 all-records.json이 없음 — 처음부터 시작.');
  }

  return map;
}

function loadResponseText(rec: RunRecord): string {
  try {
    const full = JSON.parse(readFileSync(path.join(RECORDS_DIR, rec.recordFile), 'utf-8'));
    return full.responseText ?? '';
  } catch {
    return '';
  }
}

async function runOpusThinkingOnExtra() {
  log('=== 추가: claude-opus-5 thinking ON — 첫 생성 3건 ===');

  for (let i = 0; i < A_TASKS_FULL.length; i++) {
    const task = A_TASKS_FULL[i];
    const files = baselineFileMap();
    const model: ModelId = 'claude-opus-5';
    const msg1 = userMessage(model, PROVIDER_NAME, task);
    const msg2 = assistantMessage(getBaselineTemplate(33).assistantMessage);
    const msg3 = userMessage(model, PROVIDER_NAME, baselineUserFollowup());

    await runOne({
      category: 'first_gen',
      caseId: `a${i + 1}`,
      model,
      task,
      messages: [msg1, msg2, msg3],
      files,
      chatId: `bench-a${i}-opus-thinking-on`,
      recordLabel: 'claude-opus-5-thinking-on',
    });
  }

  log('=== claude-opus-5 thinking ON 완료 ===');
}

async function main() {
  if (OPUS_THINKING_ON) {
    // 기존 같은 날짜 기록에 이어붙인다 — 본 실행(36건)이 이미 all-records.json을 만들어 둔 뒤 실행.
    const existingPath = path.join(RUN_DIR, 'all-records.json');

    try {
      const existing: RunRecord[] = JSON.parse(readFileSync(existingPath, 'utf-8'));
      allRecords.push(...existing);
    } catch {
      log('기존 all-records.json 없음 — 새로 시작.');
    }

    await runOpusThinkingOnExtra();
    writeFileSync(path.join(RUN_DIR, 'all-records.json'), JSON.stringify(allRecords, null, 2));
    log(`추가 실행 완료 — 총 ${allRecords.length}건 -> ${RUN_DIR}`);

    return;
  }

  const existingByKey = RESUME ? loadExistingRecords() : new Map<string, RunRecord>();

  for (const model of MODELS) {
    log(`=== 모델 ${model} 시작 ===`);

    // --- A: 첫 생성 (3건) ---
    const aOutcomes: Array<{ messages: ChatMessage[]; files: FileMap; kept: boolean } | null> = [];

    for (let i = 0; i < A_TASKS.length; i++) {
      const task = A_TASKS[i];
      const caseId = `a${i + 1}`;
      const files = baselineFileMap();
      const msg1 = userMessage(model, PROVIDER_NAME, task);
      const msg2 = assistantMessage(getBaselineTemplate(33).assistantMessage);
      const msg3 = userMessage(model, PROVIDER_NAME, baselineUserFollowup());

      const existing = existingByKey.get(`first_gen:${caseId}:${model}`);

      if (RESUME && isValidRecord(existing)) {
        log(`SKIP  first_gen/${caseId}/${model} — 이미 성공(재사용)`);
        allRecords.push(existing);

        const msg4 = assistantMessage(loadResponseText(existing));
        aOutcomes.push({
          messages: [msg1, msg2, msg3, msg4],
          files: flatRecordToFileMap(
            JSON.parse(readFileSync(path.join(RECORDS_DIR, existing.recordFile), 'utf-8')).files,
          ),
          kept: true,
        });
        continue;
      }

      const chatId = `bench-a${i}-${model}`;
      const { text, files: resultFiles } = await runOne({
        category: 'first_gen',
        caseId,
        model,
        task,
        messages: [msg1, msg2, msg3],
        files,
        chatId,
      });

      const msg4 = assistantMessage(text);
      aOutcomes.push({ messages: [msg1, msg2, msg3, msg4], files: resultFiles, kept: false });
    }

    // --- B: 일반 수정 (A 결과물 기반, 3건) — A가 새로 돌았으면(kept:false) B도 재실행(오염 방지) ---
    for (let i = 0; i < B_TASKS.length; i++) {
      const base = aOutcomes[i];

      if (!base) {
        continue;
      }

      const caseId = `b${i + 1}`;
      const existing = existingByKey.get(`normal_edit:${caseId}:${model}`);

      if (RESUME && base.kept && isValidRecord(existing)) {
        log(`SKIP  normal_edit/${caseId}/${model} — 이미 성공(재사용)`);
        allRecords.push(existing);
        continue;
      }

      const followup = userMessage(model, PROVIDER_NAME, B_TASKS[i]);
      await runOne({
        category: 'normal_edit',
        caseId,
        model,
        task: B_TASKS[i],
        messages: [...base.messages, followup],
        files: base.files,
        chatId: `bench-b${i}-${model}`,
      });
    }

    // --- C: 가벼운 수정 (A 결과물 기반, 3건) ---
    for (let i = 0; i < C_TASKS.length; i++) {
      const base = aOutcomes[i];

      if (!base) {
        continue;
      }

      const caseId = `c${i + 1}`;
      const existing = existingByKey.get(`light_edit:${caseId}:${model}`);

      if (RESUME && base.kept && isValidRecord(existing)) {
        log(`SKIP  light_edit/${caseId}/${model} — 이미 성공(재사용)`);
        allRecords.push(existing);
        continue;
      }

      const followup = userMessage(model, PROVIDER_NAME, C_TASKS[i]);
      await runOne({
        category: 'light_edit',
        caseId,
        model,
        task: C_TASKS[i],
        messages: [...base.messages, followup],
        files: base.files,
        chatId: `bench-c${i}-${model}`,
      });
    }

    // --- D: 막힌 자동수정 (기존 픽스처, 3건 — A/B/C와 무관, 자체 성공 여부만 본다) ---
    for (let i = 0; i < D_FIXTURES.length; i++) {
      const name = D_FIXTURES[i];
      const caseId = `d${i + 1}-${name}`;
      const existing = existingByKey.get(`blocked_autofix:${caseId}:${model}`);

      if (RESUME && isValidRecord(existing)) {
        log(`SKIP  blocked_autofix/${caseId}/${model} — 이미 성공(재사용)`);
        allRecords.push(existing);
        continue;
      }

      const raw = readFileSync(path.join(FIXTURES_DIR, `${name}.json`), 'utf-8');
      const record: Record<string, string> = JSON.parse(raw);
      const files = flatRecordToFileMap(record);
      const checks = runChecks(record);
      const hints = formatMechanicalFindingsForPrompt(checks.findings);

      const fixInstruction =
        hints.length > 0
          ? `아래 기계 검사 결과를 반영해서 코드를 고쳐줘.\n\n${hints}`
          : '기계 검사에서 걸린 문제를 찾아서 고쳐줘.';

      const msg = userMessage(model, PROVIDER_NAME, fixInstruction, { hidden: true, isAutoFix: true });

      await runOne({
        category: 'blocked_autofix',
        caseId,
        model,
        task: `[${name}] 기계검사 자동수정 (${checks.findings.length}건)`,
        messages: [msg],
        files,
        chatId: `bench-d${i}-${model}`,
      });
    }

    log(`=== 모델 ${model} 완료 ===`);
  }

  writeFileSync(path.join(RUN_DIR, 'all-records.json'), JSON.stringify(allRecords, null, 2));
  log(`전체 완료 — ${allRecords.length}건 기록됨 -> ${RUN_DIR}`);
}

main().catch((error) => {
  log(`치명적 오류: ${error?.stack ?? error}`);
  process.exit(1);
});
