/*
 * 품질 감사 보조 — 빌드된 .render-tmp/dist에서 특정 장면의 박스 수치를 찍는다.
 *   node tests/benchmark/cinematic/probeSection.mjs '[data-ck="contact"]'
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { chromium } from 'playwright';

const DIST = join(process.cwd(), 'kits/cinematic/.render-tmp/dist');
const SELECTOR = process.argv[2] ?? '[data-ck="contact"]';

const server = createServer((req, res) => {
  const p = decodeURIComponent((req.url ?? '/').split('?')[0]);
  let f = join(DIST, p === '/' ? 'index.html' : p);

  if (!existsSync(f)) {
    f = join(DIST, 'index.html');
  }

  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp4': 'video/mp4' }[extname(f)] ?? 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': mime });
  res.end(readFileSync(f));
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

const result = await page.evaluate((selector) => {
  const el = document.querySelector(selector);

  if (!el) {
    return { missing: selector, ck: [...document.querySelectorAll('[data-ck]')].map((n) => n.getAttribute('data-ck')) };
  }

  const cs = getComputedStyle(el);

  return {
    h: el.offsetHeight,
    top: Math.round(el.getBoundingClientRect().top + window.scrollY),
    box: cs.boxSizing,
    minH: cs.minHeight,
    pt: cs.paddingTop,
    pb: cs.paddingBottom,
    rows: cs.gridTemplateRows,
    kids: [...el.children].map((k) => ({ h: k.offsetHeight, tag: k.tagName, cls: k.className })),
    scrollHeight: document.documentElement.scrollHeight,
  };
}, SELECTOR);

console.log(JSON.stringify(result, null, 1));
await browser.close();
server.close();
