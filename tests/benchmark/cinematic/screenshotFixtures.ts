/**
 * 시네마틱 킷 0단계 기준선 — 현재 골격 7 생성물(tests/fixtures/generated/*.json)을 실제 vite build로
 * 렌더해 데스크톱 1280×800 스크린샷을 3지점(상단 · 50% · 하단)에서 찍는다. 채점표(rubric.md)로 사람이
 * 점수를 매기기 위한 입력. 유닛 테스트가 아니라 수동 실행 스크립트.
 *
 * 사용법:
 *   node tests/skeleton7-dom/bundleAndRun.cjs tests/benchmark/cinematic/screenshotFixtures.ts
 * 출력: tests/benchmark/cinematic/baseline-<YYYY-MM-DD>/<fixture>-{top,mid,bottom}.png
 */
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { chromium } from 'playwright';
import { buildAndServeFixture } from '../../skeleton7-dom/renderFixture';
import { resolveHueFromFiles, runMechanicalChecks } from '~/lib/review/mechanical-checks';

// 번들 실행이라 import.meta.url이 tests/skeleton7-dom을 가리킨다 — 저장소 루트(cwd) 기준으로 잡는다.
const ROOT = process.cwd();
const FIXTURES_DIR = join(ROOT, 'tests', 'fixtures', 'generated');
const OUT_DIR = join(ROOT, 'tests', 'benchmark', 'cinematic', `baseline-${new Date().toISOString().slice(0, 10)}`);

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  for (const file of readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.json'))) {
    const name = basename(file, '.json');
    const raw = JSON.parse(readFileSync(join(FIXTURES_DIR, file), 'utf8')) as Record<string, string>;
    const { updatedFiles } = runMechanicalChecks(raw, resolveHueFromFiles(raw));
    const server = await buildAndServeFixture(name, { ...raw, ...updatedFiles });

    try {
      await page.goto(server.url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(800);

      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      const stops: Array<[string, number]> = [
        ['top', 0],
        ['mid', Math.max(0, Math.round(height / 2 - 400))],
        ['bottom', Math.max(0, height - 800)],
      ];

      for (const [label, y] of stops) {
        await page.evaluate((top) => window.scrollTo(0, top), y);
        await page.waitForTimeout(900);
        await page.screenshot({ path: join(OUT_DIR, `${name}-${label}.png`) });
      }

      console.log(`${name}: height ${height}px, 3 shots`);
    } finally {
      await server.close();
    }
  }

  await browser.close();
  console.log('out:', OUT_DIR);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
