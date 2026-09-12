/*
 * 2단계 2차 실생성 게이트 — 시네마틱 트랙 1건을 진짜로 생성해 장면 순서를 측정한다.
 *
 * Chat.client.tsx의 시네마틱 분기가 만드는 프롬프트를 그대로 재현한다:
 *   finalPrompt + ONBOARDING_ADDITIONS_MARKER + 사진 지시줄(buildSkeleton7PromptLines) + CINEMATIC_KIT_PROMPT
 * 사진 URL은 실제 예약(/api/media-images) 대신 R2의 기존 쇼룸 파일을 쓴다 — 이 게이트가 보는 건
 * "모델이 킷 장면 순서를 따랐나"이지 이미지 생성 파이프라인이 아니다.
 *
 * 실행: node tests/skeleton7-dom/bundleAndRun.cjs tests/benchmark/cinematic/sceneOrderCheck.ts
 *   (레포 루트에서 실행한다. dev 서버가 localhost:5173에 떠 있어야 한다. BASE_URL로 바꿀 수 있다.)
 *   --case=<이름> 하나만, --model=<모델 id>로 모델 지정.
 *   --recheck는 생성 없이 저장된 결과물만 다시 판정한다 — 판정 로직을 고쳤을 때 쓴다.
 */
import { writeFileSync, mkdirSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { callChat, userMessage } from '../chatClient.ts';
import { extractFilesFromAssistantText, type FileMap, type ModelId, type SimpleFile } from '../lib.ts';
import { CINEMATIC_KIT_PROMPT } from '../../../app/lib/cinematic/kit-prompt.ts';
import { checkCinematicSceneOrder } from '../../../app/lib/cinematic/sceneOrder.ts';
import { buildSkeleton7PromptLines } from '../../../app/lib/media/skeleton7PromptLines.ts';

/*
 * bundleAndRun.cjs가 번들을 tests/skeleton7-dom/ 밑에 떨궈서 실행하므로 import.meta.url은 소스 위치가
 * 아니다. 결과는 레포 루트 기준 경로에 쓴다 — 그래서 이 스크립트는 레포 루트에서 실행해야 한다.
 */
const OUT_DIR = join(process.cwd(), 'tests/benchmark/cinematic/gen-2026-09-12-round2');

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173';
const DEFAULT_MODEL: ModelId = 'claude-sonnet-5';
const PROVIDER = 'Anthropic';
const ONBOARDING_ADDITIONS_MARKER = '\n\n추가로 알려주신 내용:\n';

const SHOWROOM = 'https://pub-b08f99b5ccf040e4b6b0293f2d95f744.r2.dev/media/showroom/photo-editorial';
const URLS = {
  hero: `${SHOWROOM}/still-mtwykpyk-1.jpg`,
  ch1: `${SHOWROOM}/still-mtwykpyk-1.jpg`,
  ch2: `${SHOWROOM}/still-mtwykpyk-1.jpg`,
  ch3: `${SHOWROOM}/still-mtwykpyk-1.jpg`,
};

/** 업종을 바꿔가며 장면 순서가 유지되는지 본다 — 골격 7로 분류되는 요청만 넣는다. */
const CASES: Record<string, string> = {
  bakery: '동네 빵집 소개 사이트 만들어줘. 매일 아침 굽는 빵, 가게 이야기, 찾아오는 길이 보이면 좋겠어.',
  portfolio: '개인 포트폴리오 사이트 만들어줘. 사진 찍는 사람이고, 작업물 3개랑 소개, 연락처가 있으면 좋겠어.',
  yoga: '요가원 홍보 페이지 만들어줘. 수업 분위기랑 강사 소개, 시간표 문의하는 곳이 있으면 좋겠어.',
};

/*
 * 서버는 파일맵에 src/kit/이 있는지로 시네마틱 트랙을 판정한다(isCinematicProject) — 그 판정에 따라
 * 골격 7 체크리스트가 킷 지시로 바뀐다. 실제 UI에서는 seedCinematicKit()이 먼저 킷을 써두므로,
 * 하네스도 같은 증거를 보내야 UI와 같은 시스템 프롬프트를 받는다.
 */
const SEEDED_KIT: FileMap = {
  '/home/project/src/kit/tokens.css': { type: 'file', content: ':root { --ck-accent: #ff5722; }', isBinary: false },
};

/** 킷 파일은 이 규칙의 대상이 아니다 — 생성물이 직접 쓴 화면 소스만 본다. */
function screenSourceOf(files: SimpleFile[]): string {
  return files
    .filter((file) => !file.path.includes('src/kit/'))
    .filter((file) => /\.(tsx|jsx)$/.test(file.path))
    .map((file) => `/* ${file.path} */\n${file.content}`)
    .join('\n\n');
}

/** 한 건 생성해서 장면 순서를 판정한다. */
async function runCase(name: string, model: ModelId) {
  const promptLines = buildSkeleton7PromptLines(URLS, { url: `${SHOWROOM}/hero-loop.mp4` });
  const prompt = `${CASES[name]}${ONBOARDING_ADDITIONS_MARKER}${promptLines
    .map((line) => `- ${line}`)
    .join('\n')}\n\n${CINEMATIC_KIT_PROMPT}`;

  console.log(`\n=== ${name} / ${model} — 실생성 요청 중...`);

  const result = await callChat({
    baseUrl: BASE_URL,
    messages: [userMessage(model, PROVIDER, prompt)],
    files: SEEDED_KIT,
    chatId: `cinematic-scene-order-${Date.now()}`,
  });

  if (result.httpStatus !== 200 || result.errorText) {
    console.log(`FAIL — 생성 실패: httpStatus=${result.httpStatus}, error=${result.errorText}`);
    return { name, model, pass: false, problems: [`생성 실패 ${result.httpStatus}`], elapsedSec: result.elapsedSec };
  }

  const files = extractFilesFromAssistantText(result.text);
  const source = screenSourceOf(files);

  const outDir = join(OUT_DIR, `${name}-${model}`);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'assistant.txt'), result.text, 'utf-8');
  writeFileSync(join(outDir, 'screens.tsx'), source, 'utf-8');

  const check = checkCinematicSceneOrder(source);

  console.log(`파일 ${files.length}개, ${source.length}자, ${result.elapsedSec.toFixed(1)}초`);
  console.log(`장면 순서: ${check.order.join(' → ') || '(없음)'} / 챕터 ${check.chapterCount}개`);

  if (!check.pass) {
    for (const problem of check.problems) {
      console.log(`  - ${problem}`);
    }
  }

  return { name, model, pass: check.pass, problems: check.problems, elapsedSec: result.elapsedSec };
}

/** 저장된 생성물을 다시 판정한다 — 판정 로직을 고쳤을 때 생성을 또 돌리지 않기 위해. */
function recheckSaved() {
  if (!existsSync(OUT_DIR)) {
    console.log(`저장된 결과물이 없다: ${OUT_DIR}`);
    return true;
  }

  let allPass = true;

  for (const entry of readdirSync(OUT_DIR, { withFileTypes: true })) {
    const file = join(OUT_DIR, entry.name, 'screens.tsx');

    if (!entry.isDirectory() || !existsSync(file)) {
      continue;
    }

    const check = checkCinematicSceneOrder(readFileSync(file, 'utf-8'));
    console.log(
      `${check.pass ? 'PASS' : 'FAIL'}  ${entry.name}  챕터 ${check.chapterCount}개  ${check.problems.join('; ')}`,
    );
    allPass = allPass && check.pass;
  }

  return allPass;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--recheck')) {
    process.exit(recheckSaved() ? 0 : 1);
  }

  const model = (args.find((a) => a.startsWith('--model='))?.slice('--model='.length) ?? DEFAULT_MODEL) as ModelId;
  const only = args.find((a) => a.startsWith('--case='))?.slice('--case='.length);
  const names = only ? [only] : Object.keys(CASES);

  const results = [];

  // 레이트 리밋을 피하려고 순차 실행한다.
  for (const name of names) {
    results.push(await runCase(name, model));
  }

  console.log('\n=== 요약');

  for (const r of results) {
    console.log(
      `${r.pass ? 'PASS' : 'FAIL'}  ${r.name} / ${r.model}  ${r.elapsedSec.toFixed(1)}초  ${r.problems.join('; ')}`,
    );
  }

  writeFileSync(join(OUT_DIR, `summary-${model}.json`), JSON.stringify(results, null, 2), 'utf-8');

  if (results.some((r) => !r.pass)) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
