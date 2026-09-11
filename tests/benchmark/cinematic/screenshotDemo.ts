/**
 * 시네마틱 킷 데모(kits/cinematic/demo, 127.0.0.1:5190) 스크린샷 — 데스크톱 1440×900 + 모바일 400×780, 각 4지점.
 * Chrome 확장 캡처는 영상+Lenis 페이지에서 멈춰서 Playwright로 찍는다. 채점표 입력용.
 *
 *   (데모 서버 먼저) cd kits/cinematic && npm run dev
 *   node tests/skeleton7-dom/bundleAndRun.cjs tests/benchmark/cinematic/screenshotDemo.ts [--url http://127.0.0.1:5190]
 * 출력: tests/benchmark/cinematic/kit-<YYYY-MM-DD>/{desktop,mobile}-{0,1,2,3}.png
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const OUT_DIR = join(ROOT, 'tests', 'benchmark', 'cinematic', `kit-${new Date().toISOString().slice(0, 10)}`);

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);

  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const url = argValue('--url') || 'http://127.0.0.1:5190/';
  mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });

  for (const [label, viewport, isMobile] of [
    ['desktop', { width: 1440, height: 900 }, false],
    ['mobile', { width: 400, height: 780 }, true],
  ] as const) {
    const page = await browser.newPage({ viewport, isMobile, deviceScaleFactor: isMobile ? 2 : 1 });
    await page.goto(url, { waitUntil: 'networkidle' });
    // 프리로더(1.1s + 0.9s) + 히어로 등장
    await page.waitForTimeout(3200);

    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    const stops = [0, 1, 2, 3].map((i) => Math.round((height - viewport.height) * (i / 3)));

    for (const [i, y] of stops.entries()) {
      await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' as ScrollBehavior }), y);
      await page.waitForTimeout(1400);
      await page.screenshot({ path: join(OUT_DIR, `${label}-${i}.png`) });
    }

    const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    console.log(`${label}: height ${height}px, overflowX ${overflowX}, 4 shots`);
    await page.close();
  }

  await browser.close();
  console.log('out:', OUT_DIR);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
