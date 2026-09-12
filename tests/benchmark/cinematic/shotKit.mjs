/*
 * 킷 데모 채점용 스크린샷 — 데스크톱 1440×900 · 모바일 400×780, 각 8지점 + 콘택트시트.
 * WebGL 히어로와 3D 오브젝트가 켜진 상태를 찍어야 하므로 swiftshader를 켜고, Lenis 스냅 때문에 휠로 내린다.
 *
 *   (데모 서버 먼저) cd kits/cinematic && npm run dev
 *   node tests/benchmark/cinematic/shotKit.mjs [out-dir] [url]
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';

const OUT = process.argv[2] || join('tests', 'benchmark', 'cinematic', `kit-v0.3-${new Date().toISOString().slice(0, 10)}`);
const URL_ = process.argv[3] || 'http://127.0.0.1:5190/';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });

for (const [label, viewport, isMobile] of [
  ['desktop', { width: 1440, height: 900 }, false],
  ['mobile', { width: 400, height: 780 }, true],
]) {
  const page = await browser.newPage({ viewport, isMobile, deviceScaleFactor: isMobile ? 2 : 1 });
  const errors = [];
  page.on('pageerror', (event) => errors.push(String(event)));
  page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));

  await page.goto(URL_, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3800);

  const shots = [];
  const height = await page.evaluate(() => document.documentElement.scrollHeight);

  for (let i = 0; i < 8; i += 1) {
    const path = join(OUT, `${label}-${i}.jpg`);
    await page.screenshot({ path, type: 'jpeg', quality: 82 });
    shots.push(path);

    // 8지점을 고르게 — 휠로 내려야 Lenis 스냅과 핀 챕터가 제대로 걸린다.
    for (let step = 0; step < 4; step += 1) {
      await page.mouse.wheel(0, Math.round((height - viewport.height) / 22));
      await page.waitForTimeout(220);
    }

    await page.waitForTimeout(700);
  }

  const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  const thumbs = await Promise.all(shots.map((path) => sharp(path).resize(320, null).toBuffer()));
  const meta = await sharp(thumbs[0]).metadata();
  await sharp({ create: { width: 320 * 4, height: meta.height * 2, channels: 3, background: '#111' } })
    .composite(thumbs.map((input, i) => ({ input, left: (i % 4) * 320, top: Math.floor(i / 4) * meta.height })))
    .jpeg({ quality: 80 })
    .toFile(join(OUT, `sheet-${label}.jpg`));

  console.log(`${label}: height ${height}px, overflowX ${overflowX}, errors ${errors.length}`, errors.slice(0, 3));
  await page.close();
}

await browser.close();
console.log('out:', OUT);
