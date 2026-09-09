/*
 * 골격 7 DOM 검증 실행기. tests/fixtures/generated/*.json 픽스처를 각각 vite build로 실제
 * 렌더한 뒤 Playwright로 열어 (1) 폴백 챕터 헤드라인 실측 font-size, (2) 안내 문구 DOM 중복
 * 개수를 측정한다. 유닛 테스트가 아니라 수동 실행 스크립트 — 결과를 콘솔에 표로 찍는다.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { buildAndServeFixture } from './renderFixture.ts';
import { measureFallbackHeadlines, countCaptionTextNodes } from './measure.ts';
import { runMechanicalChecks, resolveHueFromFiles } from '../../app/lib/review/mechanical-checks.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, '..', 'fixtures', 'generated');

async function main() {
  const files = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.json'));
  const browser = await chromium.launch();

  for (const file of files) {
    const name = basename(file, '.json');
    const rawRecord = JSON.parse(readFileSync(join(FIXTURES_DIR, file), 'utf8')) as Record<string, string>;

    const hue = resolveHueFromFiles(rawRecord);
    const { findings, updatedFiles } = runMechanicalChecks(rawRecord, hue);
    const record = { ...rawRecord, ...updatedFiles };

    console.log(
      `\n=== ${name} (mechanical-checks 적용 후 렌더, 자동수정 ${Object.keys(updatedFiles).length}개 파일) ===`,
    );

    for (const f of findings.filter((f) => f.autoFixed)) {
      console.log(`  [autofix] ${f.rule}: ${f.message}`);
    }

    let server: { url: string; close: () => Promise<void> } | null = null;

    try {
      server = await buildAndServeFixture(name, record);

      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      await page.goto(server.url, { waitUntil: 'networkidle' });

      const headlines = await measureFallbackHeadlines(page);

      for (const h of headlines) {
        if (!h.isFallback) {
          console.log(`  [${h.slot}] 사진 있음 — 폴백 아님, 검사 대상 아님`);
          continue;
        }

        const status = h.computedFontSizePx !== null && h.computedFontSizePx >= 56 ? 'PASS' : 'FAIL';
        console.log(
          `  [${h.slot}] 폴백 챕터 — 헤드라인 태그: ${h.headlineTagFound ? 'O' : 'X(최대 텍스트로 대체)'}, ` +
            `실측 font-size: ${h.computedFontSizePx}px — ${status} (텍스트: "${h.headlineText}")`,
        );
      }

      const captionCount = await countCaptionTextNodes(page);
      console.log(`  안내 문구 DOM 텍스트 노드 개수: ${captionCount}${captionCount >= 2 ? ' — FAIL(중복)' : ' — OK'}`);

      await page.close();
    } catch (err) {
      console.log(`  ERROR: ${(err as Error).message}`);
    } finally {
      if (server) {
        await server.close();
      }
    }
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
