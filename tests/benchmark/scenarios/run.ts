/*
 * 사용자 시나리오 실측 러너 — "사용자가 이렇게 말했을 때 코랄레드가 어디까지 가는가".
 * Chat.client.tsx가 첫 생성에 보내는 것과 같은 메시지 3개(프롬프트+온보딩 지시문 / baseline 아티팩트 /
 * 후속 지시)를 /api/chat에 직접 보내고, 산출물을 실제로 npm install + vite build + Chromium 렌더까지 돌린다.
 * WebContainer·자동 검토·배포는 이 러너 밖(브라우저 실측으로 별도 기록).
 *
 *   node tests/skeleton7-dom/bundleAndRun.cjs tests/benchmark/scenarios/run.ts [--only=s01,s05] [--skip-followups]
 *   환경: 로컬 dev 서버 http://localhost:5173 (SCENARIO_BASE_URL로 변경)
 *
 * 결과: tests/benchmark/scenarios/results/<date>/{records/*.json, shots/*.png, summary.json}
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { chromium } from 'playwright';
import {
  baselineFileMap,
  extractFilesFromAssistantText,
  simpleFilesToFileMap,
  fileMapToFlatRecord,
  runChecks,
  calcCostKrw,
  type FileMap,
  type ModelId,
} from '../lib.ts';
import { callChat, userMessage, assistantMessage, type ChatMessage } from '../chatClient.ts';
import { getBaselineTemplate } from '../../../app/utils/selectStarterTemplate.ts';
import {
  buildSkeletonAndPerspectiveDirective,
  mapQ2ToDirectives,
  mergeDirectives,
} from '../../../app/lib/onboarding/answer-directives.ts';
// app/utils/constants.ts는 LLMManager(logger)를 끌고 와 노드 번들에서 죽는다 — 값 두 개만 복사(원본과 동일해야 함).
const ONBOARDING_ADDITIONS_MARKER = String.fromCharCode(10, 10) + '추가로 알려주신 내용:' + String.fromCharCode(10);
const WORK_DIR = '/home/project';
import { CINEMATIC_KIT_FILES, CINEMATIC_KIT_PROMPT } from '../../../app/lib/cinematic/kit-files.ts';
/*
 * skeleton7Images.ts의 looksLikeShowcasePrompt와 같은 정규식. 그 모듈은 logger(import.meta.env)를 끌고 와
 * 노드 번들에서 죽으므로 복사한다 — 원본이 바뀌면 여기도 맞출 것.
 */
const looksLikeShowcasePrompt = (prompt: string) =>
  /소개|홍보|랜딩|브랜드|포트폴리오|홈페이지|사이트|웹페이지|landing|portfolio|showcase/i.test(prompt);
import { SCENARIOS, type Scenario } from './scenarios.ts';

const BASE_URL = process.env.SCENARIO_BASE_URL ?? 'http://localhost:5173';
const MODEL: ModelId = 'claude-sonnet-5';
const PROVIDER = 'Anthropic';
const HUE = 33;
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) ?? '')
  .replace('--only=', '')
  .split(',')
  .filter(Boolean);
const SKIP_FOLLOWUPS = process.argv.includes('--skip-followups');

const HERE = path.resolve('tests/benchmark/scenarios');
const DATE = new Date().toISOString().slice(0, 10);
const OUT = path.join(HERE, 'results', DATE);
const RECORDS = path.join(OUT, 'records');
const SHOTS = path.join(OUT, 'shots');
const TMP = path.join(HERE, '.tmp');
const PROGRESS = path.join(HERE, 'progress.log');
const VITE_JS = path.resolve('node_modules/vite/bin/vite.js');

for (const d of [RECORDS, SHOTS, TMP]) mkdirSync(d, { recursive: true });

function log(msg: string) {
  const line = `[${new Date().toISOString().slice(11, 19)}] ${msg}`;
  console.log(line);
  try {
    writeFileSync(PROGRESS, line + '\n', { flag: 'a' });
  } catch {}
}

// --- 메시지 조립(Chat.client.tsx handleClarificationComplete + generateNewApp와 동일 순서) ---

function composeFirstPrompt(s: Scenario): { prompt: string; cinematic: boolean } {
  const lines = buildSkeletonAndPerspectiveDirective(s.q1, s.skeleton);
  const parts = [{ promptAdditions: lines }, mapQ2ToDirectives(s.q2)];

  if (s.industry && s.skeleton === null) {
    parts.push({ promptAdditions: [`업종: ${s.industry}`] });
  }

  parts.push({ skeleton: s.skeleton, industry: s.industry });

  const merged = mergeDirectives(parts);
  let prompt =
    merged.promptAdditions.length > 0
      ? `${s.prompt}${ONBOARDING_ADDITIONS_MARKER}${merged.promptAdditions.map((l) => `- ${l}`).join('\n')}`
      : s.prompt;
  const cinematic = s.skeleton === 7 || looksLikeShowcasePrompt(s.prompt);

  // 예약 사진(prepareSkeleton7Images)은 R2·Gemini가 필요하므로 이 러너에서는 생략 — 모델은 스톡/자리표시자 경로로 감(게이트가 잡는지 관찰).
  if (cinematic) {
    prompt = `${prompt}\n\n${CINEMATIC_KIT_PROMPT}`;
  }

  return { prompt, cinematic };
}

function kitFileMap(): FileMap {
  const out: FileMap = {};

  for (const [rel, content] of Object.entries(CINEMATIC_KIT_FILES)) {
    out[`${WORK_DIR}/${rel}`] = { type: 'file', content, isBinary: false };
  }

  return out;
}

// --- 빌드·렌더 ---

function run(cmd: string, args: string[], cwd: string, timeoutMs: number): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, shell: process.platform === 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    const timer = setTimeout(() => {
      child.kill();
      resolve({ code: -1, out: out + '\n[timeout]' });
    }, timeoutMs);
    child.stdout.on('data', (d) => (out += String(d)));
    child.stderr.on('data', (d) => (out += String(d)));
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? -1, out });
    });
  });
}

function writeProject(dir: string, flat: Record<string, string>) {
  rmSync(dir, { recursive: true, force: true });

  for (const [abs, content] of Object.entries(flat)) {
    const rel = abs.startsWith(WORK_DIR + '/') ? abs.slice(WORK_DIR.length + 1) : abs;
    const target = path.join(dir, rel);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};
let nextPort = 47100;

function serve(root: string): Promise<{ url: string; close: () => void }> {
  const server = createServer((req, res) => {
    let p = decodeURIComponent((req.url ?? '/').split('?')[0]);
    if (p === '/') p = '/index.html';
    let abs = path.join(root, p);
    if (!existsSync(abs)) abs = path.join(root, 'index.html');
    if (!existsSync(abs)) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(abs)] ?? 'application/octet-stream' });
    res.end(readFileSync(abs));
  });
  const port = nextPort++;

  return new Promise((resolve) =>
    server.listen(port, () => resolve({ url: `http://localhost:${port}/`, close: () => server.close() })),
  );
}

interface RenderResult {
  ok: boolean;
  consoleErrors: string[];
  pageErrors: string[];
  textLength: number;
  headings: string[];
  interactive: number;
  images: { total: number; broken: number };
  desktopShot: string;
  mobileShot: string;
  overflowX: boolean;
}

async function render(id: string, distDir: string): Promise<RenderResult> {
  const srv = await serve(distDir);
  const browser = await chromium.launch();
  const result: RenderResult = {
    ok: false,
    consoleErrors: [],
    pageErrors: [],
    textLength: 0,
    headings: [],
    interactive: 0,
    images: { total: 0, broken: 0 },
    desktopShot: '',
    mobileShot: '',
    overflowX: false,
  };

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', (e) => result.pageErrors.push(String(e.message).slice(0, 200)));
    page.on('console', (m) => {
      if (m.type() === 'error') result.consoleErrors.push(m.text().slice(0, 200));
    });
    await page.goto(srv.url, { waitUntil: 'networkidle', timeout: 40_000 }).catch(() => null);
    await page.waitForTimeout(2500);

    const info = await page.evaluate(() => {
      const imgs = Array.from(document.images);

      return {
        textLength: (document.body.innerText || '').trim().length,
        headings: Array.from(document.querySelectorAll('h1,h2'))
          .slice(0, 6)
          .map((h) => (h.textContent || '').trim().slice(0, 60)),
        interactive: document.querySelectorAll('button, a[href], input, select, textarea').length,
        images: { total: imgs.length, broken: imgs.filter((i) => i.complete && i.naturalWidth === 0).length },
        overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
      };
    });
    Object.assign(result, info);
    result.desktopShot = path.join(SHOTS, `${id}-desktop.png`);
    await page.screenshot({ path: result.desktopShot, fullPage: false });
    await page.close();

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await mobile.goto(srv.url, { waitUntil: 'networkidle', timeout: 40_000 }).catch(() => null);
    await mobile.waitForTimeout(1500);
    result.mobileShot = path.join(SHOTS, `${id}-mobile.png`);
    await mobile.screenshot({ path: result.mobileShot, fullPage: false });
    result.overflowX =
      result.overflowX ||
      (await mobile.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2));
    await mobile.close();
    result.ok = result.pageErrors.length === 0 && result.textLength > 30;
  } finally {
    await browser.close();
    srv.close();
  }

  return result;
}

// --- 한 턴 ---

interface TurnRecord {
  turn: string;
  prompt: string;
  http: number;
  elapsedSec: number;
  costKrw: number;
  tokens: { prompt: number; completion: number };
  filesWritten: string[];
  filesTotal: number;
  replyText: string;
  findings: Array<{ rule: string; file: string; message: string; autoFixed: boolean }>;
  install: { ok: boolean; sec: number; tail: string };
  build: { ok: boolean; sec: number; tail: string };
  render: RenderResult | null;
  expect: Array<{ label: string; found: boolean }>;
  stage: string;
}

function stageOf(t: TurnRecord): string {
  if (t.http !== 200) return '0-요청실패';
  if (t.filesWritten.length === 0) return '1-답변만(파일 없음)';
  if (!t.install.ok) return '2-install 실패';
  if (!t.build.ok) return '3-build 실패';
  if (!t.render || !t.render.ok) return '4-렌더 실패(런타임 에러/빈 화면)';
  const missing = t.expect.filter((e) => !e.found).length;
  if (missing > 0) return `5-렌더 OK, 기대 ${t.expect.length - missing}/${t.expect.length}`;
  return '6-렌더 OK, 기대 전부 충족';
}

async function runTurn(
  id: string,
  turn: string,
  messages: ChatMessage[],
  files: FileMap,
  expect: Scenario['expect'],
  chatId: string,
): Promise<{ record: TurnRecord; files: FileMap; text: string }> {
  log(`${id}/${turn} → /api/chat`);
  const res = await callChat({ baseUrl: BASE_URL, messages, files, chatId });
  // message-parser.ts cleanEscapedTags와 동일 — 모델이 &lt; &gt;로 쓴 태그를 실제 파서처럼 되돌린다.
  const written = extractFilesFromAssistantText(res.text).map((f) => ({ ...f, content: f.content.replace(/&lt;/g, '<').replace(/&gt;/g, '>') }));
  const merged: FileMap = { ...files, ...simpleFilesToFileMap(written) };
  const flat = fileMapToFlatRecord(merged);
  const checks = res.text ? runChecks(flat) : { findings: [], updatedFiles: {} };
  // 자동 수정본을 반영(실제 파이프라인도 updatedFiles를 쓴다)
  const finalFlat = { ...flat, ...checks.updatedFiles };
  const replyText = res.text.replace(/<boltArtifact[\s\S]*?<\/boltArtifact>/g, '[artifact]').slice(0, 1200);

  const record: TurnRecord = {
    turn,
    prompt: messages[messages.length - 1]?.parts?.[0]?.text?.slice(0, 300) ?? '',
    http: res.httpStatus ?? 200,
    elapsedSec: Math.round(res.elapsedSec),
    costKrw: Math.round(calcCostKrw(MODEL, { promptTokens: res.usage.promptTokens, completionTokens: res.usage.completionTokens, cacheReadTokens: (res.usage as any).cacheReadTokens ?? 0, cacheWriteTokens: (res.usage as any).cacheWriteTokens ?? 0 })),
    tokens: { prompt: res.usage.promptTokens, completion: res.usage.completionTokens },
    filesWritten: written.map((f) => f.path.replace(WORK_DIR + '/', '')),
    filesTotal: Object.keys(finalFlat).length,
    replyText,
    findings: checks.findings.map((f) => ({ rule: f.rule, file: f.file.replace(WORK_DIR + '/', ''), message: f.message.slice(0, 160), autoFixed: f.autoFixed })),
    install: { ok: false, sec: 0, tail: '' },
    build: { ok: false, sec: 0, tail: '' },
    render: null,
    expect: [],
    stage: '',
  };

  if (res.errorText) record.replyText = `[HTTP ${res.httpStatus}] ${res.errorText.slice(0, 500)}`;

  const source = Object.entries(finalFlat)
    .filter(([p]) => !p.includes('/src/kit/') && !p.endsWith('package-lock.json'))
    .map(([, c]) => c)
    .join('\n');
  record.expect = expect.map((e) => ({ label: e.label, found: e.pattern.test(source) || e.pattern.test(res.text) }));

  if (written.length > 0) {
    const dir = path.join(TMP, id);
    writeProject(dir, finalFlat);
    let t = Date.now();
    const inst = await run('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error'], dir, 240_000);
    record.install = { ok: inst.code === 0, sec: Math.round((Date.now() - t) / 1000), tail: inst.out.slice(-600) };

    if (record.install.ok) {
      t = Date.now();
      const b = await run('node', [`"${VITE_JS}"`, 'build'], dir, 180_000);
      record.build = { ok: b.code === 0, sec: Math.round((Date.now() - t) / 1000), tail: b.out.slice(-800) };

      if (record.build.ok) {
        try {
          record.render = await render(`${id}-${turn}`, path.join(dir, 'dist'));
        } catch (e) {
          record.render = null;
          record.build.tail += `\n[render exception] ${String(e).slice(0, 300)}`;
        }
      }
    }
  }

  record.stage = stageOf(record);
  log(`${id}/${turn} ${record.stage} (${record.elapsedSec}s, ₩${record.costKrw}, files+${record.filesWritten.length}, findings ${record.findings.length})`);

  const newFiles: FileMap = {};
  for (const [p, c] of Object.entries(finalFlat)) newFiles[p] = { type: 'file', content: c, isBinary: false };

  return { record, files: newFiles, text: res.text };
}

// --- 시나리오 ---

async function runScenario(s: Scenario) {
  const recordPath = path.join(RECORDS, `${s.id}.json`);

  if (existsSync(recordPath) && !ONLY.length) {
    log(`SKIP ${s.id} (기록 있음)`);
    return JSON.parse(readFileSync(recordPath, 'utf-8'));
  }

  const { prompt, cinematic } = composeFirstPrompt(s);
  const baseline = getBaselineTemplate(HUE, { cinematic, darkTheme: false });
  let files: FileMap = { ...baselineFileMap(), ...(cinematic ? kitFileMap() : {}) };

  // baselineFileMap()은 hue 33 비시네마틱 기준 — 시네마틱이면 baseline 아티팩트 파일을 다시 뽑는다.
  if (cinematic) {
    files = { ...simpleFilesToFileMap(extractFilesFromAssistantText(baseline.assistantMessage)), ...kitFileMap() };
  }

  const msg1 = userMessage(MODEL, PROVIDER, prompt);
  const msg2 = assistantMessage(baseline.assistantMessage);
  const msg3 = userMessage(MODEL, PROVIDER, baseline.userMessage);
  let messages: ChatMessage[] = [msg1, msg2, msg3];
  const chatId = `scn-${s.id}-${Date.now().toString(36)}`;

  const first = await runTurn(s.id, 'gen', messages, files, s.expect, chatId);
  const turns: TurnRecord[] = [first.record];
  files = first.files;
  messages = [...messages, assistantMessage(first.text)];

  /*
   * 프로덕션 자동 수정 경로 재현(Chat.client.tsx runAutoFix): 프리뷰 런타임 에러 → buildFixPrompt(true, stack)
   * 를 같은 채팅에 보내 무과금 재시도 최대 2회. 여기서는 Chromium pageerror 메시지(+콘솔 스택 첫 줄)를 stack으로 쓴다.
   */
  let last = first.record;

  for (let i = 1; i <= 2 && last.render && last.render.pageErrors.length > 0; i++) {
    const stack = [...last.render.pageErrors, ...last.render.consoleErrors].slice(0, 3).join(String.fromCharCode(10));
    const fixPrompt = '*이 미리보기 오류를 고쳐줘* ' + String.fromCharCode(10) + '```js' + String.fromCharCode(10) + stack + String.fromCharCode(10) + '```' + String.fromCharCode(10);
    const msg = userMessage(MODEL, PROVIDER, fixPrompt);
    const r = await runTurn(s.id, `autofix${i}`, [...messages, msg], files, s.expect, chatId);
    turns.push(r.record);
    files = r.files;
    messages = [...messages, msg, assistantMessage(r.text)];
    last = r.record;
  }

  if (!SKIP_FOLLOWUPS && first.record.http === 200) {
    for (const f of s.followups ?? []) {
      const msg = userMessage(MODEL, PROVIDER, f.prompt);
      const r = await runTurn(s.id, f.id, [...messages, msg], files, f.expect, chatId);
      turns.push(r.record);
      files = r.files;
      messages = [...messages, msg, assistantMessage(r.text)];
    }
  }

  const out = { id: s.id, title: s.title, prompt: s.prompt, q: { q1: s.q1, q2: s.q2, skeleton: s.skeleton, industry: s.industry }, cinematic, outOfScope: s.outOfScope ?? null, turns };
  writeFileSync(recordPath, JSON.stringify(out, null, 2));

  return out;
}

async function main() {
  writeFileSync(PROGRESS, `=== scenarios ${new Date().toISOString()} base=${BASE_URL}\n`);
  const list = ONLY.length ? SCENARIOS.filter((s) => ONLY.some((o) => s.id.startsWith(o))) : SCENARIOS;
  const all: any[] = [];

  for (const s of list) {
    try {
      all.push(await runScenario(s));
    } catch (e) {
      log(`ERROR ${s.id}: ${String(e).slice(0, 300)}`);
      all.push({ id: s.id, title: s.title, error: String(e).slice(0, 500), turns: [] });
    }
  }

  writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(all, null, 2));
  log(`done: ${all.length} scenarios → ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
