import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { chromium } from 'playwright';
const DIST = join(process.cwd(), 'kits/cinematic/.render-tmp/dist');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png' };
const server = createServer((req, res) => { const p = decodeURIComponent((req.url ?? '/').split('?')[0]); let f = join(DIST, p === '/' ? 'index.html' : p); if (!existsSync(f)) f = join(DIST, 'index.html'); res.writeHead(200, { 'Content-Type': MIME[extname(f)] ?? 'application/octet-stream' }); res.end(readFileSync(f)); });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
const sample = async (label) => console.log(label, await page.evaluate(() => { const h = document.querySelector('[data-ck="contact"] h2'); const r = h.getBoundingClientRect(); return { scrollY: Math.round(scrollY), h2Top: Math.round(r.top), opacity: getComputedStyle(h).opacity, contactTop: Math.round(document.querySelector('[data-ck="contact"]').getBoundingClientRect().top + scrollY) }; }));
for (let i = 0; i < 18; i++) { await page.mouse.wheel(0, 400); await page.waitForTimeout(450); }
await page.waitForTimeout(1500); await sample('after 18 wheels');
console.log('statement/chapter opacity', await page.evaluate(() => [...document.querySelectorAll('[data-reveal]')].slice(0, 12).map((el) => (el.textContent || '').trim().slice(0, 10) + ':' + getComputedStyle(el).opacity)));
// 실제 사용자처럼 휠로 한 번 더
await page.mouse.wheel(0, 100); await page.waitForTimeout(1500); await sample('after wheel');
await browser.close(); server.close();
