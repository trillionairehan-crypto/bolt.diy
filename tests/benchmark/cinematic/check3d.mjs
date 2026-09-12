/*
 * 항목 1(히어로 WebGL)·4(3D 오브젝트) 실측 — 캔버스가 실제로 그리고 움직이는지 스크린샷 픽셀로 확인한다.
 * WebGL 캔버스는 preserveDrawingBuffer=false라 drawImage/readPixels로는 빈 버퍼가 나온다. 합성된 화면을
 * 캡처해야 하므로 page.screenshot({clip}) + sharp raw 비교를 쓴다.
 *
 *   (데모 서버 먼저) cd kits/cinematic && npm run dev
 *   node tests/benchmark/cinematic/check3d.mjs [url]
 */
import { chromium } from 'playwright';
import sharp from 'sharp';

const url = process.argv[2] || 'http://127.0.0.1:5190/';

/** 같은 영역을 gap ms 간격으로 두 번 찍어 픽셀 평균 변화량(0~255)을 낸다. */
async function motion(page, clip, gap = 900) {
  const a = await page.screenshot({ clip });
  await page.waitForTimeout(gap);
  const b = await page.screenshot({ clip });
  const [ra, rb] = await Promise.all([
    sharp(a).resize(160, 100, { fit: 'fill' }).greyscale().raw().toBuffer(),
    sharp(b).resize(160, 100, { fit: 'fill' }).greyscale().raw().toBuffer(),
  ]);

  let diff = 0;
  let ink = 0;

  for (let i = 0; i < ra.length; i += 1) {
    diff += Math.abs(ra[i] - rb[i]);
    ink += ra[i];
  }

  return { meanDelta: +(diff / ra.length).toFixed(3), meanLuma: +(ink / ra.length).toFixed(1) };
}


/** Lenis 스냅 스크롤 때문에 scrollIntoView 한 번으로는 자리를 못 잡는다 — 휠로 밀며 뷰포트 안에 들어올 때까지 확인한다. */
async function bringIntoView(page, selector, viewportHeight = 900) {
  for (let step = 0; step < 40; step += 1) {
    const box = await page.locator(selector).boundingBox();

    if (box && box.y >= 0 && box.y + box.height <= viewportHeight) {
      await page.waitForTimeout(500);

      return await page.locator(selector).boundingBox();
    }

    await page.mouse.wheel(0, box && box.y < 0 ? -500 : 500);
    await page.waitForTimeout(350);
  }

  return await page.locator(selector).boundingBox();
}

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (event) => errors.push(String(event)));
page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(4200);

const heroCanvas = await page.locator('[data-ck="hero"] canvas').count();
const hero = heroCanvas ? await motion(page, { x: 120, y: 120, width: 900, height: 520 }) : null;
const heroVideoTag = await page.locator('[data-ck="hero"] > video').count();

const box = await bringIntoView(page, '[data-ck-3d]');
await page.waitForSelector('[data-ck-3d] canvas', { timeout: 20000 }).catch(() => null);
await page
  .waitForFunction(() => document.querySelector('[data-ck-3d]')?.getAttribute('data-ck-3d') === 'live', { timeout: 20000 })
  .catch(() => null);
await page.waitForTimeout(1000);

const showcaseState = await page.getAttribute('[data-ck-3d]', 'data-ck-3d');
const live = await page.locator('[data-ck-3d]').boundingBox();
const clip = {
  x: Math.max(0, live.x + 10),
  y: Math.max(0, live.y + 10),
  width: Math.min(live.width - 20, 1400),
  height: Math.min(live.height - 20, 900 - Math.max(0, live.y + 10) - 10),
};
console.error('stage box', JSON.stringify({ box, live, clip }));
const idle = await motion(page, clip, 1200);

// 드래그 → 즉시 회전하는지
const before = await page.screenshot({ clip });
await page.mouse.move(clip.x + clip.width / 2, clip.y + clip.height / 2);
await page.mouse.down();
await page.mouse.move(clip.x + clip.width / 2 + 240, clip.y + clip.height / 2, { steps: 14 });
await page.mouse.up();
await page.waitForTimeout(150);

const after = await page.screenshot({ clip });
const [rb1, rb2] = await Promise.all([
  sharp(before).resize(160, 100, { fit: 'fill' }).greyscale().raw().toBuffer(),
  sharp(after).resize(160, 100, { fit: 'fill' }).greyscale().raw().toBuffer(),
]);

let dragDiff = 0;

for (let i = 0; i < rb1.length; i += 1) {
  dragDiff += Math.abs(rb1[i] - rb2[i]);
}

const threeChunk = await page.evaluate(() =>
  performance.getEntriesByType('resource').filter((entry) => /three|Showcase3DScene|HeroCanvas/i.test(entry.name)).length,
);

console.log(
  JSON.stringify(
    {
      heroCanvas,
      heroVideoTag,
      hero,
      showcaseState,
      idle,
      dragDelta: +(dragDiff / rb1.length).toFixed(3),
      threeRequests: threeChunk,
      errors,
    },
    null,
    2,
  ),
);

await browser.close();
