/*
 * 품질 감사 보조 — renderGenerated.mjs(AUDIT=1)가 이미 빌드해 둔 kits/cinematic/.render-tmp/dist를 띄우고,
 * 지정한 스크롤 위치(뷰포트 단위)마다 1440×900 스크린샷을 찍는다. safeShot이 타임아웃으로 삼킨 장면
 * (Showcase3D·Contact·TextReveal·Marquee)을 다시 보기 위한 것.
 *
 *   node tests/benchmark/cinematic/shotScenes.mjs <outDir> [0,0.9,1.8,...]
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, extname } from 'node:path';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const DIST = join(ROOT, 'kits/cinematic/.render-tmp/dist');
const OUT = join(ROOT, process.argv[2] ?? 'tests/benchmark/cinematic/render-2026-09-12/audit-scenes');
const STOPS = (process.argv[3] ?? '0,1,2,3,4,5,6,7,8,9,10').split(',').map(Number);
/* MOBILE=1 — 400×860, 터치·모바일 UA. 킷의 데스크톱 분기(핀 챕터·WebGL·3D)가 꺼진 폴백을 본다. */
const MOBILE = process.env.MOBILE === '1';
const VIEW = MOBILE ? { width: 400, height: 860 } : { width: 1440, height: 900 };
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp4': 'video/mp4', '.svg': 'image/svg+xml' };

function serve(dir) {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const path = decodeURIComponent((req.url ?? '/').split('?')[0]);
      let file = join(dir, path === '/' ? 'index.html' : path);

      if (!existsSync(file)) {
        file = join(dir, 'index.html');
      }

      res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
      res.end(readFileSync(file));
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

const { server, port } = await serve(DIST);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl'] });
const page = await browser.newPage({ viewport: VIEW, deviceScaleFactor: 1, isMobile: MOBILE, hasTouch: MOBILE });
mkdirSync(OUT, { recursive: true });

await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

const total = await page.evaluate(() => document.documentElement.scrollHeight);
const overflow = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
console.log(`scrollHeight ${total}px = ${(total / VIEW.height).toFixed(1)} viewports; width ${overflow.scrollWidth}/${overflow.clientWidth}${overflow.scrollWidth > overflow.clientWidth ? '  ← 가로 넘침' : ''}`);

for (const stop of STOPS) {
  const y = Math.min(Math.round(stop * VIEW.height), total - VIEW.height);
  await page.evaluate((target) => window.scrollTo(0, target), y);
  await page.waitForTimeout(1200);

  const actual = await page.evaluate(() => Math.round(window.scrollY));
  const name = `vh-${String(stop).replace('.', '_')}-y${actual}.png`;
  await page.screenshot({ path: join(OUT, name), clip: { x: 0, y: 0, ...VIEW }, timeout: 15000 }).catch((e) => console.log('shot failed', name, e.message));
  console.log(name);
}

await browser.close();
server.close();
