/*
 * 2단계 2차 실생성 게이트 — 시네마틱 트랙 1건을 진짜로 생성해 장면 순서를 측정한다.
 *
 * Chat.client.tsx의 시네마틱 분기가 만드는 프롬프트를 그대로 재현한다:
 *   finalPrompt + ONBOARDING_ADDITIONS_MARKER + 사진 지시줄(buildSkeleton7PromptLines) + CINEMATIC_KIT_PROMPT
 * 사진 URL은 실제 예약(/api/media-images) 대신 R2의 기존 쇼룸 파일을 쓴다 — 이 게이트가 보는 건
 * "모델이 킷 장면 순서를 따랐나"이지 이미지 생성 파이프라인이 아니다.
 *
 * 실행: node tests/skeleton7-dom/bundleAndRun.cjs tests/benchmark/cinematic/sceneOrderCheck.ts
 *   (레포 루트에서 실행한다. dev 서버가 localhost:5173에 떠 있어야 한다.)
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { callChat, userMessage } from '../chatClient.ts';
import { extractFilesFromAssistantText, type SimpleFile } from '../lib.ts';
import { CINEMATIC_KIT_PROMPT } from '../../../app/lib/cinematic/kit-prompt.ts';
import { checkCinematicSceneOrder } from '../../../app/lib/cinematic/sceneOrder.ts';
import { buildSkeleton7PromptLines } from '../../../app/lib/media/skeleton7PromptLines.ts';

/*
 * bundleAndRun.cjs가 번들을 tests/skeleton7-dom/ 밑에 떨궈서 실행하므로 import.meta.url은 소스 위치가
 * 아니다. 결과는 레포 루트 기준 경로에 쓴다 — 그래서 이 스크립트는 레포 루트에서 실행해야 한다.
 */
const OUT_DIR = join(process.cwd(), 'tests/benchmark/cinematic/gen-2026-09-12-round2');

const BASE_URL = 'http://localhost:5173';
const MODEL = 'claude-sonnet-5';
const PROVIDER = 'Anthropic';
const ONBOARDING_ADDITIONS_MARKER = '\n\n추가로 알려주신 내용:\n';

const SHOWROOM = 'https://pub-b08f99b5ccf040e4b6b0293f2d95f744.r2.dev/media/showroom/photo-editorial';
const URLS = {
  hero: `${SHOWROOM}/still-mtwykpyk-1.jpg`,
  ch1: `${SHOWROOM}/still-mtwykpyk-1.jpg`,
  ch2: `${SHOWROOM}/still-mtwykpyk-1.jpg`,
  ch3: `${SHOWROOM}/still-mtwykpyk-1.jpg`,
};

const BASE_PROMPT = '동네 빵집 소개 사이트 만들어줘. 매일 아침 굽는 빵, 가게 이야기, 찾아오는 길이 보이면 좋겠어.';

/** 킷 파일은 이 규칙의 대상이 아니다 — 생성물이 직접 쓴 화면 소스만 본다. */
function screenSourceOf(files: SimpleFile[]): string {
  return files
    .filter((file) => !file.path.includes('src/kit/'))
    .filter((file) => /\.(tsx|jsx)$/.test(file.path))
    .map((file) => `/* ${file.path} */\n${file.content}`)
    .join('\n\n');
}

async function main() {
  const promptLines = buildSkeleton7PromptLines(URLS, { url: `${SHOWROOM}/hero-loop.mp4` });
  const prompt = `${BASE_PROMPT}${ONBOARDING_ADDITIONS_MARKER}${promptLines
    .map((line) => `- ${line}`)
    .join('\n')}\n\n${CINEMATIC_KIT_PROMPT}`;

  console.log('실생성 요청 중... (시네마틱 트랙, 빵집 소개)');

  const result = await callChat({
    baseUrl: BASE_URL,
    messages: [userMessage(MODEL, PROVIDER, prompt)],
    files: {},
    chatId: `cinematic-scene-order-${Date.now()}`,
  });

  if (result.httpStatus !== 200 || result.errorText) {
    console.log(`FAIL — 생성 실패: httpStatus=${result.httpStatus}, error=${result.errorText}`);
    process.exit(1);
  }

  const files = extractFilesFromAssistantText(result.text);
  const source = screenSourceOf(files);

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, 'assistant.txt'), result.text, 'utf-8');
  writeFileSync(join(OUT_DIR, 'screens.tsx'), source, 'utf-8');

  const check = checkCinematicSceneOrder(source);

  console.log(`\n파일 ${files.length}개, 화면 소스 ${source.length}자, ${result.elapsedSec.toFixed(1)}초`);
  console.log(`장면 순서: ${check.order.join(' → ') || '(없음)'}`);
  console.log(`챕터 수: ${check.chapterCount}`);

  if (check.pass) {
    console.log('\nPASS — 장면 순서 규칙 위반 없음');
    return;
  }

  console.log(`\nFAIL — ${check.problems.length}건`);

  for (const problem of check.problems) {
    console.log(`  - ${problem}`);
  }

  process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
