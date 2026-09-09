/*
 * 골격 7 미달 2건 수정 검증 게이트 — "포트폴리오 1건 실생성 → 4항목 실측" (사용자 지시).
 * 실제 /api/chat을 호출해 진짜 생성물을 받고, mechanical-checks를 적용한 뒤 vite build +
 * Playwright로 실제 렌더해 헤드라인 56px 4개 챕터 + 캡션 중복 여부를 측정한다.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { callChat, userMessage } from '../benchmark/chatClient.ts';
import { extractFilesFromAssistantText, runChecks } from '../benchmark/lib.ts';
import { buildAndServeFixture } from './renderFixture.ts';
import { measureFallbackHeadlines, countCaptionTextNodes } from './measure.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

const BASE_URL = 'http://localhost:5173';
const MODEL = 'claude-sonnet-5';
const PROVIDER = 'Anthropic';

async function main() {
  const prompt = '개인 포트폴리오 사이트 만들어줘. 디자이너 소개, 작업물 3개 보여주는 페이지로.';
  console.log('실생성 요청 중... (portfolio 타입, 골격 7 유도 프롬프트)');

  const messages = [userMessage(MODEL, PROVIDER, prompt)];
  const result = await callChat({ baseUrl: BASE_URL, messages, files: {}, chatId: `skeleton7-verify-${Date.now()}` });

  if (result.httpStatus !== 200 || result.errorText) {
    console.log(`FAIL — 생성 자체 실패: httpStatus=${result.httpStatus}, error=${result.errorText}`);
    process.exit(1);
  }

  const extracted = extractFilesFromAssistantText(result.text);
  const fileCount = Object.keys(extracted).length;
  console.log(`생성 완료 — 파일 ${fileCount}개, ${result.elapsedSec.toFixed(1)}초`);

  if (fileCount === 0) {
    console.log('FAIL — 파일이 추출되지 않음(응답에 boltAction file 블록 없음)');
    console.log('--- 응답 앞부분 ---');
    console.log(result.text.slice(0, 1000));
    process.exit(1);
  }

  const flatRecord: Record<string, string> = {};

  for (const { path, content } of extracted) {
    flatRecord[`/home/project/${path}`] = content;
  }

  const { findings, updatedFiles } = runChecks(flatRecord);
  const merged = { ...flatRecord, ...updatedFiles };

  console.log(`기계 검사 findings ${findings.length}건(자동수정 ${Object.values(updatedFiles).length}개 파일)`);

  const appTsxPath = Object.keys(merged).find((p) => /App\.(tsx|jsx)$/.test(p));

  if (!appTsxPath || !merged[appTsxPath].includes('data-slot="hero"')) {
    console.log('FAIL — 골격 7(data-slot 챕터 구조)로 생성되지 않음 — 이 검증은 골격 7 전용이라 여기서 멈춤.');
    console.log('생성된 파일 목록:', Object.keys(merged));
    process.exit(1);
  }

  // 필요한 정적 자산(package.json/vite.config.ts/index.html)이 없으면 fixture와 같은 값으로 보강.
  const need = [
    '/home/project/package.json',
    '/home/project/vite.config.ts',
    '/home/project/index.html',
    '/home/project/src/main.tsx',
  ];
  const fallback = JSON.parse(
    readFileSync(join(__dirname, '..', 'fixtures', 'generated', 'portfolio.json'), 'utf8'),
  ) as Record<string, string>;

  for (const key of need) {
    if (!merged[key] && fallback[key]) {
      merged[key] = fallback[key];
    }
  }

  const browser = await chromium.launch();
  let server: { url: string; close: () => Promise<void> } | null = null;

  try {
    server = await buildAndServeFixture('realgen-portfolio', merged);

    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(server.url, { waitUntil: 'networkidle' });

    const headlines = await measureFallbackHeadlines(page);
    let allPass = true;

    for (const h of headlines) {
      if (!h.isFallback) {
        console.log(`  [${h.slot}] 사진 있음 — 검사 대상 아님`);
        continue;
      }

      const pass = h.computedFontSizePx !== null && h.computedFontSizePx >= 56;
      allPass = allPass && pass;
      console.log(
        `  [${h.slot}] 실측 font-size: ${h.computedFontSizePx}px — ${pass ? 'PASS' : 'FAIL'} (텍스트: "${h.headlineText}")`,
      );
    }

    const captionCount = await countCaptionTextNodes(page);
    const captionPass = captionCount <= 1;
    allPass = allPass && captionPass;
    console.log(`  안내 문구 DOM 텍스트 노드 개수: ${captionCount} — ${captionPass ? 'PASS' : 'FAIL'}`);

    console.log(allPass ? '\n=== 게이트 통과 ===' : '\n=== 게이트 실패 ===');
    process.exit(allPass ? 0 : 1);
  } finally {
    if (server) {
      await server.close();
    }

    await browser.close();
  }
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
