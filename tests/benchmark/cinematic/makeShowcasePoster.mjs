/*
 * 모바일·WebGL 불가 폴백용 스틸 만들기 — 데스크톱에서 돌아가는 3D 오브젝트를 그대로 찍어 저장한다.
 * (다른 사진을 쓰면 3D와 다른 물건이 보이므로 반드시 같은 장면에서 뽑는다.)
 *
 *   (데모 서버 먼저) cd kits/cinematic && npm run dev
 *   node tests/benchmark/cinematic/makeShowcasePoster.mjs
 */
import { chromium } from 'playwright';
import sharp from 'sharp';

const url = process.argv[2] || 'http://127.0.0.1:5190/';
const out = process.argv[3] || 'kits/cinematic/demo/public/showcase-jar.jpg';

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 2 });
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(3800);

for (let step = 0; step < 40; step += 1) {
  const box = await page.locator('[data-ck-3d]').boundingBox();

  if (box && box.y >= 0 && box.y + box.height <= 1100) {
    break;
  }

  await page.mouse.wheel(0, box && box.y < 0 ? -500 : 500);
  await page.waitForTimeout(350);
}

await page.waitForFunction(() => document.querySelector('[data-ck-3d]')?.getAttribute('data-ck-3d') === 'live', { timeout: 20000 });
await page.waitForTimeout(1500);

const box = await page.locator('[data-ck-3d]').boundingBox();
const shot = await page.screenshot({ clip: box });
await sharp(shot).resize(880, 1100, { fit: 'cover' }).jpeg({ quality: 84 }).toFile(out);

console.log('poster:', out, await sharp(out).metadata().then((meta) => `${meta.width}×${meta.height}`));
await browser.close();
