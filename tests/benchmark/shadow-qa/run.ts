/**
 * Shadow Visual QA A/B — 자동 검토 3단계(시각 검토, reviewGeneratedApp.ts의 runVisualReview)를
 * claude-sonnet-5 대신 GPT로 바꾸면 지적 내용이 달라지는지 "측정만" 한다. 파이프라인에는 전혀
 * 배선하지 않고(reviewGeneratedApp.ts/review-checklist.ts는 import만 해서 읽기 전용으로 재사용),
 * 어느 쪽 결과도 자동으로 파일에 적용하지 않는다. 판정은 사람이 HTML 리포트를 보고 한다.
 *
 * 시스템 프롬프트는 buildVisualReviewSystemPrompt()를 그대로 가져다 쓴다(문구 수정 없음). 단
 * 프로덕션 호출부(app/routes/api.llmcall.ts)는 이미지 1장만 받으므로, 이 실험이 요구하는
 * 데스크톱+모바일 2장을 같은 호출에 넣기 위해 provider API를 직접 호출한다(models.ts) — 라우트
 * 코드는 건드리지 않는다.
 *
 * 사용법:
 *   node tests/skeleton7-dom/bundleAndRun.cjs tests/benchmark/shadow-qa/run.ts
 *
 * 필요 환경변수(.env):
 *   ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY — 없으면 그 provider를 쓰는 모델 결과가
 *   call_failed로 기록됨(스크립트가 죽지 않고 나머지 모델/케이스는 계속 진행).
 *
 * 모델 구성(단가 포함)은 MODEL_CONFIGS(아래) 상수에 있다 — 2026-09-10 성민 지시로 확정된 값,
 * env로 덮어쓰지 않는다. 바꾸려면 이 배열을 직접 수정한다.
 *
 * SHADOW_QA_BASE_URL — "오늘 생성한 골격 1" 샘플을 새로 뽑을 dev 서버 주소. 기본값
 *   http://localhost:5173 — 서버가 안 떠 있으면 이 케이스만 건너뛰고 기존 픽스처 3건은 진행한다.
 */
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import {
  baselineFileMap,
  baselineUserFollowup,
  extractFilesFromAssistantText,
  simpleFilesToFileMap,
  fileMapToFlatRecord,
  runChecks,
  formatMechanicalFindingsForPrompt,
  PRICING,
} from '../lib.ts';
import { callChat, userMessage, assistantMessage } from '../chatClient.ts';
import { getBaselineTemplate } from '../../../app/utils/selectStarterTemplate.ts';
import { buildVisualReviewSystemPrompt } from '../../../app/lib/common/prompts/review-checklist.ts';
import type { FixtureRecord } from '../../skeleton7-dom/renderFixture.ts';
import { captureScreenshots, type CapturedScreenshots } from './screenshots.ts';
import { callClaudeVisual, callOpenAiVisual, callGeminiVisual, type RawVisualCallResult } from './models.ts';
import { normalizeVisualResult, type NormalizedResult } from './normalize.ts';
import { printConsoleTable, writeHtmlReport, type ShadowQaCase } from './report.ts';

/*
 * dotenv 패키지는 esbuild ESM 번들에서 require('fs') 동적 require 문제로 깨져서(bundleAndRun.cjs는
 * 공용 인프라라 건드리지 않음) .env를 직접 최소 파싱한다 — 이미 설정된 process.env 값은 덮어쓰지
 * 않는다(쉘에서 직접 export한 값 우선).
 */
function loadDotEnv() {
  const envPath = path.resolve('.env');

  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const eq = trimmed.indexOf('=');

    if (eq === -1) {
      continue;
    }

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadDotEnv();

const BASE_URL = process.env.SHADOW_QA_BASE_URL ?? 'http://localhost:5173';
const PROVIDER_NAME = 'Anthropic';
const SKELETON1_TASK = '동네 헬스장 회원 관리 앱'; // 골격 1(명단·차감형).

/*
 * 2026-09-10 성민 지시 — 검토층 비교용 모델 구성. 단가는 성민이 직접 준 값을 그대로 씀(웹검색
 * 추정 아님). gpt-6-astra는 "품질 상한 확인용, 1건만"이라 onlyFirstCase로 제한 — 어느 케이스가
 * 첫 번째인지는 main()의 최종 케이스 순서(골격1 신규 생성이 있으면 그게 첫 번째, 없으면 bakery)를
 * 따른다.
 */
interface ModelConfig {
  key: string;
  provider: 'claude' | 'openai' | 'gemini';
  model: string;
  inputPrice: number;
  outputPrice: number;
  onlyFirstCase?: boolean;
}

const MODEL_CONFIGS: ModelConfig[] = [
  {
    key: 'claude-sonnet-5',
    provider: 'claude',
    model: 'claude-sonnet-5',
    inputPrice: PRICING['claude-sonnet-5'].input,
    outputPrice: PRICING['claude-sonnet-5'].output,
  },
  { key: 'gpt-5.6-luna', provider: 'openai', model: 'gpt-5.6-luna', inputPrice: 0.2, outputPrice: 1.2 },
  /*
   * 성민이 준 'gemini-2.5-flash-lite'는 이 계정에서 404("no longer available to new users" —
   * Google이 gemini-3.5-flash-lite로 이전 안내)라서 그 대체 모델로 교체. 단가도 $0.10/$0.40이
   * 아니라 3.5-flash-lite 공식 단가($0.30/$2.50, ai.google.dev 확인)로 반영 — "최저가 후보" 취지는
   * 유지하되 실제 원가는 이 값이 맞다.
   */
  {
    key: 'gemini-3.5-flash-lite',
    provider: 'gemini',
    model: 'gemini-3.5-flash-lite',
    inputPrice: 0.3,
    outputPrice: 2.5,
  },
  { key: 'gpt-6-astra', provider: 'openai', model: 'gpt-6-astra', inputPrice: 10, outputPrice: 50, onlyFirstCase: true },
];

async function callModelConfig(
  config: ModelConfig,
  systemPrompt: string,
  userText: string,
  screenshots: CapturedScreenshots,
): Promise<RawVisualCallResult> {
  switch (config.provider) {
    case 'claude':
      return callClaudeVisual({
        systemPrompt,
        userText,
        desktopBase64: screenshots.desktopBase64,
        mobileBase64: screenshots.mobileBase64,
        model: config.model,
      });
    case 'openai':
      return callOpenAiVisual({
        systemPrompt,
        userText,
        desktopDataUrl: screenshots.desktopDataUrl,
        mobileDataUrl: screenshots.mobileDataUrl,
        model: config.model,
      });
    case 'gemini':
      return callGeminiVisual({
        systemPrompt,
        userText,
        desktopBase64: screenshots.desktopBase64,
        mobileBase64: screenshots.mobileBase64,
        model: config.model,
      });
  }
}

const FIXTURES_DIR = path.resolve('tests/fixtures/generated');
const FIXTURE_NAMES = ['bakery', 'portfolio', 'cafe'];

const RESULTS_DIR = path.resolve('tests/benchmark/results', new Date().toISOString().slice(0, 10), 'shadow-qa');
mkdirSync(RESULTS_DIR, { recursive: true });

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function isServerHealthy(): Promise<boolean> {
  try {
    const res = await fetch(BASE_URL, { signal: AbortSignal.timeout(5000) });
    return res.status === 200;
  } catch {
    return false;
  }
}

/** "오늘 생성한 골격 1 결과물" — 기존 벤치마크 A태스크 경로(baseline seed -> 후속 지시)를 그대로 재사용해 지금 새로 생성한다. */
async function generateSkeleton1Sample(): Promise<FixtureRecord | null> {
  if (!(await isServerHealthy())) {
    log(`dev 서버(${BASE_URL}) 응답 없음 — 골격1 신규 생성 건너뜀. 기존 픽스처 3건만 진행.`);
    return null;
  }

  const model = 'claude-sonnet-5';
  const files = baselineFileMap();
  const msg1 = userMessage(model, PROVIDER_NAME, SKELETON1_TASK);
  const msg2 = assistantMessage(getBaselineTemplate(33).assistantMessage);
  const msg3 = userMessage(model, PROVIDER_NAME, baselineUserFollowup());

  log(`골격1 신규 생성 시작 — "${SKELETON1_TASK}"`);

  const result = await callChat({
    baseUrl: BASE_URL,
    messages: [msg1, msg2, msg3],
    files,
    chatId: `shadow-qa-skeleton1-${Date.now()}`,
  });

  if (result.httpStatus !== 200 || result.errorText) {
    log(`골격1 신규 생성 실패 (httpStatus=${result.httpStatus}, ${result.errorText ?? ''}) — 이 케이스 건너뜀.`);
    return null;
  }

  const extracted = extractFilesFromAssistantText(result.text);

  if (extracted.length === 0) {
    log('골격1 신규 생성: 응답에서 파일을 못 뽑음 — 이 케이스 건너뜀.');
    return null;
  }

  const merged = { ...files, ...simpleFilesToFileMap(extracted) };
  log(`골격1 신규 생성 완료 — 파일 ${extracted.length}개`);

  return fileMapToFlatRecord(merged);
}

function loadFixture(name: string): FixtureRecord {
  return JSON.parse(readFileSync(path.join(FIXTURES_DIR, `${name}.json`), 'utf-8'));
}

interface CaseInput {
  caseId: string;
  label: string;
  files: FixtureRecord;
}

async function buildCase(input: CaseInput, isFirstCase: boolean): Promise<ShadowQaCase> {
  log(`케이스 시작: ${input.caseId}`);

  const checks = runChecks(input.files);
  const hints = formatMechanicalFindingsForPrompt(checks.findings);
  const fileList = Object.keys(input.files).sort();

  const mechanicalSummary =
    `판정 hue: ${checks.hue ?? 'n/a'}\n` +
    `기계 검사 발견: ${checks.findings.length}건 (자동수정 ${checks.findings.filter((f) => f.autoFixed).length}건)\n` +
    (hints || '(자동수정 후 남은 힌트 없음)');

  const screenshots = await captureScreenshots(input.caseId, input.files);

  const systemPrompt = buildVisualReviewSystemPrompt();
  const userText =
    `아래는 방금 생성된 앱의 미리보기 스크린샷 두 장입니다 — 첫 번째는 데스크톱(1280×800), ` +
    `두 번째는 모바일(390×844), 둘 다 첫 화면만(스크롤 아래는 안 보임).\n\n` +
    `[골격 판정값]\n${mechanicalSummary}\n\n` +
    `[소스 파일 목록]\n${fileList.join('\n')}`;

  const results: Record<string, NormalizedResult> = {};

  for (const config of MODEL_CONFIGS) {
    if (config.onlyFirstCase && !isFirstCase) {
      continue;
    }

    log(`케이스 ${input.caseId}: ${config.key} 호출`);

    const raw = await callModelConfig(config, systemPrompt, userText, screenshots);
    results[config.key] = normalizeVisualResult(config.key, raw, {
      input: config.inputPrice,
      output: config.outputPrice,
    });
  }

  log(
    `케이스 완료: ${input.caseId} — ` +
      Object.values(results)
        .map((r) => `${r.model} ${r.verdict}(${r.issues.length}건)`)
        .join(', '),
  );

  return {
    caseId: input.caseId,
    label: input.label,
    mechanicalSummary,
    fileList,
    desktopDataUrl: screenshots.desktopDataUrl,
    mobileDataUrl: screenshots.mobileDataUrl,
    results,
  };
}

async function main() {
  const inputs: CaseInput[] = [];

  const skeleton1Files = await generateSkeleton1Sample();

  if (skeleton1Files) {
    inputs.push({ caseId: 'skeleton1-fresh', label: `골격1 신규 생성 (${SKELETON1_TASK})`, files: skeleton1Files });
  }

  for (const name of FIXTURE_NAMES) {
    inputs.push({ caseId: name, label: `기존 픽스처 — ${name}`, files: loadFixture(name) });
  }

  const cases: ShadowQaCase[] = [];

  for (let i = 0; i < inputs.length; i++) {
    cases.push(await buildCase(inputs[i], i === 0));
  }

  writeFileSync(path.join(RESULTS_DIR, 'raw-results.json'), JSON.stringify(cases, null, 2));

  const htmlPath = path.join(RESULTS_DIR, 'report.html');
  writeHtmlReport(cases, htmlPath);

  printConsoleTable(cases);

  log(`완료 — ${cases.length}건. HTML: ${htmlPath}`);
  log(
    `모델 구성: ${MODEL_CONFIGS.map((c) => `${c.key}($${c.inputPrice}/$${c.outputPrice}/1M${c.onlyFirstCase ? ', 1건만' : ''})`).join(', ')}`,
  );
}

main().catch((error) => {
  console.error('치명적 오류:', error?.stack ?? error);
  process.exit(1);
});
