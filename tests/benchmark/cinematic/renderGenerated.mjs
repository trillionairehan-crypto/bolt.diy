/*
 * 2단계 2차 실측 — 생성물을 진짜로 빌드해서 렌더하고 채점표 항목 1·2·4·5·7·8을 잰다.
 * sceneOrderCheck.ts는 소스만 본다("킷을 조립했나"). 이 스크립트는 화면을 본다("실제로 움직이나").
 *
 * 생성물(gen-2026-09-12-round2/screens.tsx)을 kits/cinematic/.render-tmp에 임시 vite 프로젝트로
 * 깔고 빌드한다 — 킷의 node_modules(three·gsap·lenis)를 상위 탐색으로 그대로 쓰기 위해 킷 아래에 둔다.
 *
 * 미디어는 R2 원본 대신 같은 오리진(public/media/)에서 준다. R2 버킷의 허용 오리진은
 * *.webcontainer-api.io뿐이라(2026-09-12 확인) localhost에서는 WebGL 텍스처가 CORS로 막혀
 * 히어로가 <video>/<img>로 내려간다 — 그건 킷 문제가 아니라 측정 환경 문제라서 배제한다.
 *
 *   node tests/benchmark/cinematic/renderGenerated.mjs [생성물 디렉터리 이름]
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync, copyFileSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';

const ROOT = process.cwd();
const KIT_SRC = join(ROOT, 'kits/cinematic/src');
const TMP = join(ROOT, 'kits/cinematic/.render-tmp');

/*
 * 어느 생성물을 잴지 — `node ... renderGenerated.mjs portfolio-claude-sonnet-5`.
 * `/`가 들어간 값은 tests/benchmark/cinematic 기준 경로로 본다(예: repro/textreveal-children).
 */
const CASE_DIR = process.argv[2] ?? 'bakery-claude-sonnet-5';
const CASE_ROOT = join(
  ROOT,
  'tests/benchmark/cinematic',
  CASE_DIR.includes('/') ? CASE_DIR : join('gen-2026-09-12-round2', CASE_DIR),
);
const GEN = join(CASE_ROOT, 'screens.tsx');
const STILL = join(ROOT, 'tests/benchmark/cinematic/.render-media/still.jpg');
const VITE = join(ROOT, 'kits/cinematic/node_modules/vite/bin/vite.js');
const SHOTS = join(ROOT, 'tests/benchmark/cinematic/render-2026-09-12', CASE_DIR.replace('/', '-'));

/*
 * AUDIT=1 — 채점이 아니라 품질 감사용. 1440×900에서 장면마다 뷰포트 스크린샷과 타이포·배경 수치를
 * 뽑는다(2026-09-18: 구조 검사는 다 통과하는데 디자인은 기준(얇은 90~150px 헤딩, 앰비언트 모션, 장면당
 * 한 화면)에 못 미친다는 지적 → 눈으로 볼 자료). 드래그·모바일 측정은 건너뛴다.
 */
const AUDIT = process.env.AUDIT === '1';
const DESKTOP = AUDIT ? { width: 1440, height: 900 } : { width: 1280, height: 800 };
const MOBILE = { width: 400, height: 860 };

const INDEX_HTML = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>생성물 렌더 측정</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Familjen+Grotesk:wght@400;500;600&family=Instrument+Serif&family=Noto+Serif+KR:wght@400;500&family=JetBrains+Mono:wght@400&display=swap" />
    <style>body { margin: 0; --hue: 33; }</style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

const MAIN_TSX = `import { createRoot } from 'react-dom/client';
import './kit/tokens.css';
import App from './App';

createRoot(document.getElementById('root')!).render(<App />);
`;

const VITE_CONFIG = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({ plugins: [react()], build: { rollupOptions: { output: { manualChunks: { three: ['three', '@react-three/fiber'] } } } } });
`;

/** 생성물이 쓴 R2 URL을 같은 오리진 경로로 바꾼다. 없는 영상 URL은 image만 남기고 지운다. */
function localizeMedia(source) {
  return source
    .replace(/^\/\* [^\n]*\*\/\n/, '')
    .replace(/'https:\/\/pub-[^']*\.mp4'/g, "''")
    .replace(/'https:\/\/pub-[^']*'/g, "'/media/still.jpg'")
    .replace(/export default App;?/, 'export default App;');
}

function copyDir(from, to) {
  mkdirSync(to, { recursive: true });

  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const src = join(from, entry.name);
    const dst = join(to, entry.name);

    if (entry.isDirectory()) {
      copyDir(src, dst);
    } else {
      copyFileSync(src, dst);
    }
  }
}

function writeProject() {
  if (existsSync(TMP)) {
    rmSync(TMP, { recursive: true, force: true });
  }

  mkdirSync(join(TMP, 'src'), { recursive: true });
  mkdirSync(join(TMP, 'public/media'), { recursive: true });
  copyDir(KIT_SRC, join(TMP, 'src/kit'));
  copyFileSync(STILL, join(TMP, 'public/media/still.jpg'));
  writeFileSync(join(TMP, 'index.html'), INDEX_HTML, 'utf8');
  writeFileSync(join(TMP, 'vite.config.ts'), VITE_CONFIG, 'utf8');
  writeFileSync(join(TMP, 'src/main.tsx'), MAIN_TSX, 'utf8');

  const app = localizeMedia(readFileSync(GEN, 'utf8'));
  writeFileSync(join(TMP, 'src/App.tsx'), app, 'utf8');

  // `export default App;`도 `export default function App()`도 이미 있으면 덧붙이지 않는다(중복 default export = 빌드 실패).
  if (!/export\s+default/.test(app)) {
    writeFileSync(join(TMP, 'src/App.tsx'), `${app}\nexport default App;\n`, 'utf8');
  }
}

function build() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [VITE, 'build'], { cwd: TMP, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(out))));
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function serve(dir) {
  const server = createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]);
    const file = join(dir, rel === '/' ? 'index.html' : rel);

    if (!existsSync(file)) {
      res.writeHead(404).end();
      return;
    }

    res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  });

  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port })),
  );
}

/*
 * 스크린샷은 측정이 아니라 증거다. Lenis가 관성으로 계속 움직이면 Playwright가 안정될 때까지 기다리다
 * 타임아웃나므로, 실패해도 측정을 죽이지 않는다.
 */
async function safeShot(page, options) {
  try {
    await page.screenshot({ timeout: 8000, ...options });
    return true;
  } catch {
    return false;
  }
}

/*
 * clip은 뷰포트 안이어야 한다 — 밖으로 걸치면 Playwright가 스크롤을 맞추려다 Lenis의 관성 때문에
 * 영영 안정되지 않고 screenshot이 타임아웃난다. 뷰포트와의 교집합으로 잘라서 넘긴다.
 */
function clampClip(box, viewport) {
  const x = Math.max(0, box.x);
  const y = Math.max(0, box.y);
  const width = Math.min(box.x + box.width, viewport.width) - x;
  const height = Math.min(box.y + box.height, viewport.height) - y;

  return width > 8 && height > 8 ? { x, y, width, height } : null;
}

/*
 * Lenis 관성·스냅 때문에 scrollIntoViewIfNeeded 한 번으로는 요소가 뷰포트 한가운데 서지 않는다.
 * 요소 중앙이 뷰포트 중앙에 오도록 몇 번 다시 맞춘다.
 */
async function centerInViewport(page, locator, viewport, tries = 4) {
  for (let i = 0; i < tries; i++) {
    const box = await locator.boundingBox();

    if (!box) {
      return null;
    }

    const offset = box.y + box.height / 2 - viewport.height / 2;

    if (Math.abs(offset) < 40) {
      return box;
    }

    await page.evaluate((delta) => window.scrollTo(0, window.scrollY + delta), Math.round(offset));
    await page.waitForTimeout(900);
  }

  return locator.boundingBox();
}

/** 같은 영역을 gap ms 간격으로 두 번 찍어 픽셀 평균 변화량(0~255)을 낸다. check3d.mjs와 같은 방식. */
async function motion(page, clip, gap = 900) {
  const a = await page.screenshot({ clip });
  await page.waitForTimeout(gap);

  const b = await page.screenshot({ clip });
  const [ra, rb] = await Promise.all([
    sharp(a).resize(160, 100, { fit: 'fill' }).greyscale().raw().toBuffer(),
    sharp(b).resize(160, 100, { fit: 'fill' }).greyscale().raw().toBuffer(),
  ]);

  let diff = 0;

  for (let i = 0; i < ra.length; i++) {
    diff += Math.abs(ra[i] - rb[i]);
  }

  return diff / ra.length;
}

/*
 * 스크롤이 멎을 때까지 기다린다. 뷰포트를 바꾸면 ScrollTrigger가 핀 구간을 다시 계산하면서 스크롤을
 * 얼마간 더 움직인다 — 그걸 드래그 중 이동으로 오인하면 잠금이 실패한 것처럼 보인다(2026-09-18).
 */
async function waitForScrollIdle(page, quietMs = 600, timeoutMs = 6000) {
  const started = Date.now();
  let last = await page.evaluate(() => Math.round(window.scrollY));
  let stableSince = Date.now();

  while (Date.now() - started < timeoutMs) {
    await page.waitForTimeout(100);

    const now = await page.evaluate(() => Math.round(window.scrollY));

    if (now !== last) {
      last = now;
      stableSince = Date.now();
    } else if (Date.now() - stableSince >= quietMs) {
      return true;
    }
  }

  return false;
}

async function measure(url) {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl'] });
  const results = {};

  // --- 데스크톱 ---
  const page = await browser.newPage({ viewport: DESKTOP, deviceScaleFactor: 1 });
  const started = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  // 항목 5 프리로더 — 로드 직후에만 보인다.
  results.preloaderAtLoad = await page
    .locator('[class*="ck-preloader"], [data-ck="preloader"]')
    .first()
    .isVisible()
    .catch(() => false);

  await page.waitForLoadState('networkidle');
  results.loadMs = Date.now() - started;

  results.paint = await page.evaluate(() => {
    const fcp = performance.getEntriesByName('first-contentful-paint')[0];
    return { fcpMs: fcp ? Math.round(fcp.startTime) : null, domMs: Math.round(performance.now()) };
  });

  await page.waitForTimeout(2500);
  mkdirSync(SHOTS, { recursive: true });
  await safeShot(page, { path: join(SHOTS, 'desktop-top.png'), clip: { x: 0, y: 0, ...DESKTOP } });

  if (AUDIT) {
    results.audit = await auditScenes(page);
    await page.close();
    await browser.close();

    return results;
  }

  // 항목 1 WebGL 히어로 — 히어로 안에 캔버스가 있고, 그 픽셀이 실제로 움직이는가.
  const heroCanvas = page.locator('canvas').first();
  results.heroCanvas = await heroCanvas.count().then((n) => n > 0);
  results.heroVideoFallback = (await page.locator('video').count()) > 0;

  if (results.heroCanvas) {
    const box = await heroCanvas.boundingBox();
    const clip = box ? clampClip(box, DESKTOP) : null;
    results.heroMotion = clip ? Number((await motion(page, clip)).toFixed(2)) : null;
  }

  // 항목 5 커서 — 킷의 커스텀 커서 요소.
  results.cursor = (await page.locator('[data-ck="cursor"], [data-ck="cursor-ring"]').count()) > 0;

  // 항목 2 핀·스크럽 — 챕터 컨테이너가 sticky로 붙고, 스크롤에 따라 활성 챕터가 바뀌는가.
  const chapter = page.locator('[data-ck="chapter"]').first();
  results.chapterFound = (await chapter.count()) > 0;

  if (results.chapterFound) {
    /*
     * 핀은 "섹션 안에 있는 동안 sticky 자식의 top이 0에 붙어 있는가"로 본다. 섹션은 챕터 수 × 100vh라
     * 그 범위를 4등분해 훑는다 — 섹션을 지나친 뒤의 top은 핀 해제가 아니라 그냥 스크롤 밖이므로 안 센다.
     * 스크럽은 같은 구간에서 활성 챕터 인덱스가 실제로 바뀌는가로 본다.
     */
    const section = await chapter.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return { top: Math.round(rect.top + window.scrollY), height: Math.round(rect.height) };
    });

    const samples = [];

    /*
     * sticky는 섹션 바닥에서 자기 높이(100vh)만큼 앞에서 자연히 풀린다 — 그 뒤 top이 음수인 건 CSS 정상
     * 동작이지 핀 실패가 아니다. 게다가 useSmoothScroll({ snap: true })이 걸려 있어 scrollTo가 목표
     * 위치에 그대로 서 있지 않는다. 그래서 잰 뒤에 실제 scrollY를 다시 읽어 핀 유효 구간
     * [섹션 top, 섹션 top + 높이 - 뷰포트] 안이었던 표본만 핀 판정에 쓴다.
     */
    const pinEnd = section.top + section.height - DESKTOP.height;

    for (const ratio of [0.05, 0.3, 0.55, 0.8]) {
      await page.evaluate((y) => window.scrollTo(0, y), section.top + Math.round(section.height * ratio));
      await page.waitForTimeout(700);

      const sample = await page.evaluate(() => {
        const el = document.querySelector('[data-ck="chapter"] > *');
        const active = Array.from(document.querySelectorAll('.ck-pin-media')).findIndex(
          (node) => node.getAttribute('data-active') === 'true',
        );

        return {
          scrollY: Math.round(window.scrollY),
          top: el ? Math.round(el.getBoundingClientRect().top) : null,
          position: el ? getComputedStyle(el).position : null,
          active,
        };
      });

      const inPinWindow = sample.scrollY >= section.top && sample.scrollY <= pinEnd;
      samples.push({ ...sample, inPinWindow });
      results.pinPosition = sample.position;

      // 핀이 걸려 있는 동안의 화면을 남긴다 — 구간 밖(전환 중) 샷은 챕터 상태를 안 보여준다.
      if (inPinWindow && ratio === 0.55) {
        await safeShot(page, { path: join(SHOTS, 'desktop-chapters.png'), clip: { x: 0, y: 0, ...DESKTOP } });
      }
    }

    const inWindow = samples.filter((s) => s.inPinWindow);
    const tops = samples.map((s) => s.top);
    const actives = samples.map((s) => s.active);

    await safeShot(page, { path: join(SHOTS, 'desktop-chapters.png'), clip: { x: 0, y: 0, ...DESKTOP } });

    results.pin = {
      position: results.pinPosition,
      section,
      samples,
      topsInPinWindow: inWindow.map((s) => s.top),
      pinned: inWindow.length > 1 && inWindow.every((s) => s.top !== null && Math.abs(s.top) <= 2),
      actives,
      scrubbed: new Set(actives).size > 1,
    };
  }

  // 항목 4 3D — Showcase3D 캔버스를 드래그하면 픽셀이 바뀌는가.
  const canvases = page.locator('canvas');
  const canvasCount = await canvases.count();
  results.canvasCount = canvasCount;

  if (canvasCount > 1) {
    /*
     * useSmoothScroll({ snap: true })의 스냅이 섹션 시작점으로 되끌어서, 800px 뷰포트로는 Showcase3D
     * 캔버스가 화면 밖에 걸리는 생성물이 있다(claude-fable-5-1 실측: 보이는 높이 159px → 드래그 측정이
     * 무의미해졌다). 이 단계에서만 뷰포트를 세로로 키워 섹션 전체가 들어오게 한다 — 데스크톱 판정은
     * 가로 기준(min-width: 768px)이라 바뀌지 않는다.
     */
    const TALL = { width: DESKTOP.width, height: 1400 };
    await page.setViewportSize(TALL);
    await page.waitForTimeout(600);

    const showcase = canvases.nth(canvasCount - 1);
    await showcase.scrollIntoViewIfNeeded();
    await page.waitForTimeout(900);

    const box = await centerInViewport(page, showcase, TALL);
    const clip = box ? clampClip(box, TALL) : null;
    results.showcaseClip = clip;

    if (clip) {
      const before = await page.screenshot({ clip });

      /*
       * 드래그하는 동안 페이지가 움직이면 안 된다 — 2026-09-17 프로덕션 프리뷰에서 3D를 끌었더니
       * 직전 스크롤의 스냅 트윈이 착지해 다음 장면으로 넘어갔다. 드래그 전후 scrollY를 같이 잰다.
       */
      results.scrollIdleBeforeDrag = await waitForScrollIdle(page);
      await page.mouse.move(clip.x + clip.width / 2, clip.y + clip.height / 2);
      await page.mouse.down();

      /*
       * 기준점은 pointerdown 이후에 잡는다. 그 전에는 직전 스크롤의 스냅이 아직 착지하는 중이라,
       * 드래그와 무관한 이동까지 같이 재게 된다(2026-09-18: 그래서 56~190px으로 들쭉날쭉했다).
       */
      const scrollBefore = await page.evaluate(() => Math.round(window.scrollY));

      /*
       * 3D가 아직 'still'이면(뷰포트 감지 전) 캔버스가 없어 드래그가 히어로로 가고, 잠금도 안 걸린다.
       * 그 경우의 이동량은 스냅 잔여이지 잠금 실패가 아니므로 같이 기록해 구분한다.
       */
      results.ck3dAtDrag = await page.evaluate(
        () => document.querySelector('[data-ck-3d]')?.getAttribute('data-ck-3d') ?? null,
      );
      results.dragOnShowcaseCanvas = await page.evaluate(() => !!document.querySelector('[data-ck-3d] canvas'));
      await page.mouse.move(clip.x + clip.width / 2 + 180, clip.y + clip.height / 2, { steps: 12 });

      const scrollDuringDrag = await page.evaluate(() => Math.round(window.scrollY));
      await page.mouse.up();
      await page.waitForTimeout(900);
      results.dragScrollDelta = Math.abs(scrollDuringDrag - scrollBefore);

      // 놓은 뒤에는 스크롤이 다시 살아야 한다 — 잠금이 안 풀리면 페이지가 굳는다.
      const beforeWheel = await page.evaluate(() => Math.round(window.scrollY));
      await page.mouse.wheel(0, 600);
      await page.waitForTimeout(900);
      results.scrollAliveAfterDrag = (await page.evaluate(() => Math.round(window.scrollY))) !== beforeWheel;

      /*
       * 회전 자체는 픽셀 변화로 재기 어렵다 — jar·bowl은 LatheGeometry라 Y축 회전이 이미지를 거의
       * 안 바꾼다(실측 2.78). 그래서 드래그 성공 판정은 "페이지가 안 밀렸고 잠금이 걸렸다 풀렸다"로 본다.
       */

      const after = await page.screenshot({ clip });
      const [ra, rb] = await Promise.all([
        sharp(before).resize(160, 100, { fit: 'fill' }).greyscale().raw().toBuffer(),
        sharp(after).resize(160, 100, { fit: 'fill' }).greyscale().raw().toBuffer(),
      ]);

      let diff = 0;

      for (let i = 0; i < ra.length; i++) {
        diff += Math.abs(ra[i] - rb[i]);
      }

      results.dragDelta = Number((diff / ra.length).toFixed(2));
      await safeShot(page, { path: join(SHOTS, 'desktop-showcase3d.png'), clip });
    }
  }

  await page.close();

  // --- 모바일 400px ---
  const mobile = await browser.newPage({ viewport: MOBILE, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await mobile.goto(url, { waitUntil: 'networkidle' });
  await mobile.waitForTimeout(1500);
  results.mobile = await mobile.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    canvases: document.querySelectorAll('canvas').length,
  }));
  await safeShot(mobile, { path: join(SHOTS, 'mobile-top.png'), clip: { x: 0, y: 0, ...MOBILE } });
  await mobile.close();

  await browser.close();

  return results;
}

/** 뷰포트 안에서 가장 큰 글자 요소의 타이포 수치 — 기준표(얇은 90~150px, weight 300~400, line-height 1.1)와 대조용. */
const SCENE_METRICS_SCRIPT = () => {
  const vh = window.innerHeight;
  const inView = (el) => {
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < vh && r.width > 0 && r.height > 0;
  };
  const texts = Array.from(document.querySelectorAll('h1,h2,h3,p,span,a,div'))
    .filter((el) => el.childElementCount === 0 && (el.textContent || '').trim().length > 0 && inView(el))
    .map((el) => {
      const cs = getComputedStyle(el);
      return {
        tag: el.tagName.toLowerCase(),
        text: (el.textContent || '').trim().slice(0, 40),
        px: parseFloat(cs.fontSize),
        weight: cs.fontWeight,
        lh: cs.lineHeight,
        ls: cs.letterSpacing,
        family: cs.fontFamily.split(',')[0].replace(/"/g, ''),
        color: cs.color,
      };
    })
    .sort((a, b) => b.px - a.px);
  const sceneEl = document.elementFromPoint(Math.round(window.innerWidth / 2), Math.round(vh / 2));
  let bg = null;
  let node = sceneEl;
  while (node && node !== document.documentElement) {
    const c = getComputedStyle(node).backgroundColor;
    if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') {
      bg = c;
      break;
    }
    node = node.parentElement;
  }
  return {
    scrollY: Math.round(window.scrollY),
    bg,
    canvases: Array.from(document.querySelectorAll('canvas')).filter(inView).length,
    videos: Array.from(document.querySelectorAll('video')).filter(inView).length,
    images: Array.from(document.querySelectorAll('img')).filter(inView).length,
    largest: texts.slice(0, 4),
  };
};

async function auditScenes(page) {
  const dir = join(SHOTS, 'audit');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  const scenes = await page.evaluate(() => {
    const vh = window.innerHeight;
    return Array.from(document.querySelectorAll('[data-ck]'))
      .map((el) => ({ kind: el.getAttribute('data-ck'), top: Math.round(el.getBoundingClientRect().top + window.scrollY), h: Math.round(el.getBoundingClientRect().height) }))
      .filter((s) => s.h >= vh * 0.5 && !['cursor', 'cursor-ring', 'scene-nav', 'preloader'].includes(s.kind))
      .sort((a, b) => a.top - b.top);
  });

  const out = [];
  let index = 0;

  for (const scene of scenes) {
    const stops = scene.kind === 'chapter' ? [0.12, 0.5, 0.88] : [0];

    for (const ratio of stops) {
      const y = scene.top + Math.round(Math.max(0, scene.h - DESKTOP.height) * ratio);
      await page.evaluate((target) => window.scrollTo(0, target), y);
      await waitForScrollIdle(page, 500, 4000);
      await page.waitForTimeout(700);

      const name = `${String(index).padStart(2, '0')}-${scene.kind}${stops.length > 1 ? `-${Math.round(ratio * 100)}` : ''}`;
      await safeShot(page, { path: join(dir, `${name}.png`), clip: { x: 0, y: 0, ...DESKTOP } });

      const metrics = await page.evaluate(SCENE_METRICS_SCRIPT);
      out.push({ name, kind: scene.kind, sectionTop: scene.top, sectionHeight: scene.h, viewportHeight: DESKTOP.height, ...metrics });
      index++;
    }
  }

  writeFileSync(join(dir, 'metrics.json'), JSON.stringify(out, null, 2), 'utf8');

  return { scenes: out.length, dir };
}

function bundleSizes() {
  const dir = join(TMP, 'dist/assets');
  const files = existsSync(dir) ? readdirSync(dir) : [];
  const sizes = {};

  for (const file of files) {
    const bytes = readFileSync(join(dir, file)).length;
    sizes[file] = Math.round(bytes / 1024);
  }

  return sizes;
}

async function main() {
  console.log('임시 프로젝트 작성...');
  writeProject();

  console.log('vite build...');

  const buildLog = await build();
  console.log(
    buildLog
      .split('\n')
      .filter((l) => /dist\/|built in/.test(l))
      .join('\n'),
  );

  const { server, port } = await serve(join(TMP, 'dist'));
  const url = `http://127.0.0.1:${port}/`;
  console.log(`측정 시작 ${url}`);

  try {
    const results = await measure(url);
    results.bundleKb = bundleSizes();
    console.log(`\n${JSON.stringify(results, null, 2)}`);
    writeFileSync(join(SHOTS, 'results.json'), JSON.stringify(results, null, 2), 'utf8');
    console.log(`\n스크린샷·결과: ${SHOTS}`);
  } finally {
    server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
