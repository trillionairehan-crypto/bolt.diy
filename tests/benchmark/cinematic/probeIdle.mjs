/*
 * 특정 스크롤 위치의 앰비언트 모션 — cssda/motion.mjs의 idleMotion과 같은 방법(700ms 간격 3프레임, 160×100
 * 다운샘플, 픽셀 차이 합 > 72 비율)을 임의 장면에 적용한다. 수상작 중앙값 0.036 / p75 0.173.
 *   node tests/benchmark/cinematic/probeIdle.mjs '[data-ck="chapter"]' 0.5
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { chromium } from 'playwright';

const DIST = join(process.cwd(), 'kits/cinematic/.render-tmp/dist');
const SELECTOR = process.argv[2] ?? '[data-ck="chapter"]';
const RATIO = Number(process.argv[3] ?? 0.5);
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

async function frameDiff(page, a, b) {
  return page.evaluate(
    async ([ba, bb]) => {
      const load = (b64) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.src = `data:image/jpeg;base64,${b64}`;
        });
      const [ia, ib] = await Promise.all([load(ba), load(bb)]);
      const w = 160;
      const h = 100;
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      ctx.drawImage(ia, 0, 0, w, h);
      const da = ctx.getImageData(0, 0, w, h).data;
      ctx.drawImage(ib, 0, 0, w, h);
      const db = ctx.getImageData(0, 0, w, h).data;
      let diff = 0;

      for (let i = 0; i < da.length; i += 4) {
        const d = Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]);

        if (d > 72) diff++;
      }

      return diff / (w * h);
    },
    [a.toString('base64'), b.toString('base64')],
  );
}

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

const y = await page.evaluate(
  ([selector, ratio]) => {
    const el = document.querySelector(selector);
    const r = el.getBoundingClientRect();
    return Math.round(r.top + window.scrollY + Math.max(0, r.height - window.innerHeight) * ratio);
  },
  [SELECTOR, RATIO],
);
await page.evaluate((target) => window.scrollTo(0, target), y);
await page.waitForTimeout(2500);

const frames = [];

for (let i = 0; i < 3; i++) {
  frames.push(await page.screenshot({ type: 'jpeg', quality: 50 }));
  await page.waitForTimeout(700);
}

const idle = ((await frameDiff(page, frames[0], frames[1])) + (await frameDiff(page, frames[1], frames[2]))) / 2;
console.log(JSON.stringify({ selector: SELECTOR, ratio: RATIO, scrollY: await page.evaluate(() => Math.round(window.scrollY)), idleMotion: Number(idle.toFixed(3)) }));

await browser.close();
server.close();
