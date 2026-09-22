/*
 * 주요 사용자 흐름 스모크 — 빌드된 앱을 `wrangler pages dev`로 띄우고 실제 브라우저로 훑는다. LLM·DB·외부 API 없이
 * 도달 가능한 것만: 랜딩 → 프롬프트 입력 → 만들기 → 온보딩 1문항, 요금제, 가이드/약관/로그인 SSR, /api/health,
 * 정적 에셋(_routes.json). 실패 = 종료 코드 1 + 이유 출력. 새 dep 없음(playwright 라이브러리는 하네스가 이미 쓴다).
 *
 *   pnpm run build && node tests/e2e/smoke.mjs        (또는 pnpm run test:e2e)
 *   SMOKE_BASE_URL=https://coralred.kr node tests/e2e/smoke.mjs   ← 서버 안 띄우고 배포본 검사
 */
import { spawn, spawnSync } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = Number(process.env.SMOKE_PORT ?? 8890);
const BASE = process.env.SMOKE_BASE_URL ?? `http://127.0.0.1:${PORT}`;
const TIMEOUT = 25_000;

const failures = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);

  if (!ok) failures.push(name);
};

async function waitFor(url, ms) {
  const started = Date.now();

  while (Date.now() - started < ms) {
    try {
      const res = await fetch(url);

      if (res.status < 500) return true;
    } catch {}

    await new Promise((r) => setTimeout(r, 700));
  }

  return false;
}

let server = null;

// Windows에서 npx 셸만 죽이면 workerd가 남아 다음 실행이 포트를 못 잡는다 — 프로세스 트리를 끊는다.
function stopServer() {
  if (!server) return;

  if (process.platform === 'win32') {
    // wrangler → workerd 트리. taskkill /T가 workerd를 놓치는 경우가 있어 이미지 이름으로도 한 번 더 정리한다.
    spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
    spawnSync('taskkill', ['/IM', 'workerd.exe', '/F'], { stdio: 'ignore' });
  } else {
    server.kill('SIGTERM');
  }
}

if (!process.env.SMOKE_BASE_URL) {
  server = spawn(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['wrangler', 'pages', 'dev', './build/client', '--port', String(PORT), '--ip', '127.0.0.1', '--log-level', 'error'],
    { stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' },
  );
  const serverLog = [];
  server.stdout.on('data', (d) => {
    serverLog.push(String(d));
    if (process.env.SMOKE_VERBOSE) process.stdout.write(d);
  });
  server.stderr.on('data', (d) => {
    serverLog.push(String(d));
    if (process.env.SMOKE_VERBOSE) process.stderr.write(d);
  });

  const up = await waitFor(`${BASE}/api/health`, 150_000);

  if (!up) {
    console.error(
      'FAIL wrangler pages dev did not come up on',
      BASE,
      '(포트 점유? Windows: taskkill /IM workerd.exe /F)',
    );
    console.error(serverLog.join('').slice(-1500));
    stopServer();
    process.exit(1);
  }
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const consoleErrors = [];
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text());
});

try {
  // 1) API health
  const health = await fetch(`${BASE}/api/health`)
    .then((r) => r.json())
    .catch(() => null);
  check('GET /api/health → status healthy', health?.status === 'healthy', JSON.stringify(health)?.slice(0, 120));

  // 2) 랜딩 SSR — 비로그인은 마케팅 랜딩("시작하기"), 로그인은 채팅 홈(textarea). 둘 중 하나여야 한다.
  const res = await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
  check('GET / → 200', res?.status() === 200, String(res?.status()));
  check('문서 title에 코랄레드', /코랄레드|Coralred/i.test(await page.title()), await page.title());
  await page
    .waitForFunction(() => document.querySelector('textarea') || /시작하기/.test(document.body.innerText), null, {
      timeout: TIMEOUT,
    })
    .catch(() => null);
  const hasTextarea = (await page.locator('textarea').count()) > 0;
  const hasStart = (await page.getByRole('button', { name: /시작하기/ }).count()) > 0;
  check('랜딩에 "시작하기"(비로그인) 또는 textarea(로그인)', hasTextarea || hasStart);

  // 3) 정적 에셋이 Function을 우회해 200으로 온다 (_routes.json)
  const cssHref = await page
    .locator('link[rel="stylesheet"][href*="/assets/"]')
    .first()
    .getAttribute('href')
    .catch(() => null);
  if (cssHref) {
    const css = await fetch(new URL(cssHref, BASE));
    check(
      '정적 /assets/*.css → 200 text/css',
      css.status === 200 && /text\/css/.test(css.headers.get('content-type') ?? ''),
      `${css.status} ${css.headers.get('content-type')}`,
    );
  } else {
    check('정적 /assets/*.css 링크 존재', false, 'stylesheet link not found');
  }

  // 4) 핵심 흐름 시작: (시작하기 →) 프롬프트 입력 → 만들기 → 온보딩 1문항 (LLM 호출 전 단계)
  if (!hasTextarea && hasStart) {
    await page
      .getByRole('button', { name: /시작하기/ })
      .first()
      .click();
  }
  const gotTextarea = await page
    .waitForSelector('textarea', { timeout: TIMEOUT })
    .then(() => true)
    .catch(() => false);
  check('프롬프트 textarea 도달', gotTextarea, page.url());

  if (gotTextarea) {
    check('"만들기" 버튼', (await page.locator('button[aria-label="만들기"]').count()) > 0);
    await page.locator('textarea').first().pressSequentially('도예 공방 브랜드 소개 페이지', { delay: 5 });
    const createBtn = page.locator('button[aria-label="만들기"]').first();
    await createBtn.waitFor({ state: 'visible', timeout: TIMEOUT });
    check('"만들기" 버튼 활성화', await createBtn.isEnabled());
    await createBtn.click({ timeout: TIMEOUT, force: true });
    const onboarding = await page
      .waitForFunction(() => /누가 쓰나요/.test(document.body.innerText), null, { timeout: TIMEOUT })
      .then(() => true)
      .catch(() => false);
    check('만들기 → 온보딩 1문항 "누가 쓰나요"', onboarding);

    if (onboarding) {
      await page.getByRole('button', { name: /손님·고객도 써요/ }).click();
      const q2 = await page
        .waitForFunction(() => /데이터를 저장할까요/.test(document.body.innerText), null, { timeout: TIMEOUT })
        .then(() => true)
        .catch(() => false);
      check('온보딩 1 → 2문항 "데이터를 저장할까요"', q2);
    }
  }

  // 5) 요금제·가이드·약관·로그인 SSR
  for (const [path, must] of [
    ['/pricing', /Free[\s\S]*Light[\s\S]*Pro[\s\S]*Max/],
    ['/guide', /가이드|안내/],
    ['/terms', /이용약관|약관/],
    ['/privacy', /개인정보/],
    ['/login', /Google|카카오|Kakao|GitHub/],
  ]) {
    const r = await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    // 클라이언트 렌더 페이지(remix-island)는 domcontentloaded 시점에 body가 비어 있다 — 문구가 나타날 때까지 기다린다.
    const found = await page
      .waitForFunction((src) => new RegExp(src).test(document.body.innerText), must.source, { timeout: TIMEOUT })
      .then(() => true)
      .catch(() => false);
    const text = await page
      .locator('body')
      .innerText()
      .catch(() => '');
    check(
      `GET ${path} → 200 + 핵심 문구`,
      r?.status() === 200 && found,
      `${r?.status()} ${text.replace(/\s+/g, ' ').slice(0, 60)}`,
    );
  }

  // 6) 잔재 API가 실수로 500을 뿜지 않는지(열려 있는 건 감사 문서에 기록됨)
  const models = await fetch(`${BASE}/api/models`);
  check('GET /api/models → 200', models.status === 200, String(models.status));

  // 7) 치명적 콘솔 에러 없음(알려진 무해 경고 제외)
  const fatal = consoleErrors.filter(
    (e) => !/favicon|Sentry|sentryHandleError|ResizeObserver|hydrat|Invalid Sentry Dsn/i.test(e),
  );
  check('페이지 콘솔에 치명 에러 없음', fatal.length === 0, fatal.slice(0, 3).join(' | ').slice(0, 200));
} catch (error) {
  const first = String(error?.message ?? error)
    .split(String.fromCharCode(10))[0]
    .slice(0, 200);
  check('스모크 스크립트 자체 오류 없음', false, first);
} finally {
  await browser.close();
  stopServer();
}

if (failures.length) {
  console.error(`\n${failures.length} smoke check(s) failed: ${failures.join('; ')}`);
  process.exit(1);
}

console.log('\nsmoke: all passed');
