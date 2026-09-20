/*
 * 자동 시각 검토의 스크린샷 캡처(inspector-script.js → html-to-image toJpeg)를 킷 빌드에서 재현한다.
 * 2026-09-20 실생성: 캡처가 `data:,`(빈 값)로 와서 /api/llmcall이 500("media type: '' not supported").
 *   node tests/benchmark/cinematic/probeScreenshot.mjs
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { chromium } from 'playwright';

const DIST = join(process.cwd(), 'kits/cinematic/.render-tmp/dist');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png' };
const server = createServer((req, res) => {
  const p = decodeURIComponent((req.url ?? '/').split('?')[0]);
  let f = join(DIST, p === '/' ? 'index.html' : p);

  if (!existsSync(f)) {
    f = join(DIST, 'index.html');
  }

  res.writeHead(200, { 'Content-Type': MIME[extname(f)] ?? 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('console', (m) => m.type() === 'error' && console.log('[console.error]', m.text().slice(0, 200)));
await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
await page.addScriptTag({ url: 'https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.js' });

const result = await page.evaluate(async () => {
  const out = {};
  const body = document.body;
  out.bodyRect = { w: body.offsetWidth, h: body.offsetHeight, inner: [innerWidth, innerHeight] };
  out.bodyStyle = { height: getComputedStyle(body).height, overflow: getComputedStyle(body).overflow };

  try {
    const url = await htmlToImage.toJpeg(document.body, { width: innerWidth, height: innerHeight, quality: 0.7, backgroundColor: '#ffffff' });
    out.bodyJpeg = { len: url.length, head: url.slice(0, 30) };
  } catch (e) {
    out.bodyJpegError = String(e);
  }

  try {
    const url = await htmlToImage.toJpeg(document.documentElement, { width: innerWidth, height: innerHeight, quality: 0.7, backgroundColor: '#ffffff' });
    out.htmlJpeg = { len: url.length, head: url.slice(0, 30) };
  } catch (e) {
    out.htmlJpegError = String(e);
  }

  return out;
});

console.log(JSON.stringify(result, null, 1));
await browser.close();
server.close();
