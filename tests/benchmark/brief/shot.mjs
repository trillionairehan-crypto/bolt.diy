// /brief 미리보기 라우트 스크린샷 — 챕터 몇 개를 실제로 답하며 찍는다.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] || 'tests/benchmark/brief-2026-09-12';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1500 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

await page.goto('http://127.0.0.1:5199/brief', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'domcontentloaded' });
await page.locator('h1').first().waitFor();
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/A1.png` });

const next = async () => {
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await page.waitForTimeout(150);
};

await page.getByRole('button', { name: '카페·음식점' }).click();
await next();
await page.getByRole('button', { name: '매일 새벽 네 시에 굽는 소금빵집' }).click();
await next();
await page.getByRole('button', { name: '새벽 어둠 속 오븐 불빛과 김이 오르는 빵' }).click();
await page.getByRole('button', { name: '오브젝트 클로즈업' }).click();
await page.screenshot({ path: `${out}/A3.png`, fullPage: true });
await next();
await page.getByRole('button', { name: /방문·길찾기/ }).click();
await next();

// B3 무드
for (const chip of ['따뜻한', '정직한', '장인']) {
  await page.locator(`button:has-text("${chip}")`).first().click();
}
await page.screenshot({ path: `${out}/B3.png`, fullPage: true });
await next();

// B1 세계관 카드
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/B1.png`, fullPage: true });
await page.locator('button[aria-pressed]').filter({ hasText: '실사 에디토리얼' }).first().click();
await next();

// B2 색
await page.locator('button[aria-label="#b45309"]').click();
await page.screenshot({ path: `${out}/B2.png`, fullPage: true });
await next();
await page.getByRole('button', { name: /건너뛰기/ }).click();
await page.screenshot({ path: `${out}/B5.png`, fullPage: true });
await page.getByRole('button', { name: /건너뛰기/ }).click();

// C1 업로드 화면
await page.screenshot({ path: `${out}/C1.png`, fullPage: true });
await next();
await page.getByRole('button', { name: /네, 만들어 주세요/ }).click();
await page.screenshot({ path: `${out}/C2.png`, fullPage: true });
await next();
await page.getByPlaceholder('상호 (한글)').fill('밀도');
await next();
await page.getByRole('button', { name: /건너뛰기/ }).click();
await page.getByRole('button', { name: /건너뛰기/ }).click();
await page
  .getByPlaceholder('내가 하는 말입니다. A2(남이 하는 말)와 다르게.')
  .fill('빵집 하나가 동네를 바꾸진 않습니다. 아침은 바꿉니다.');
await next();
await page.locator('#contact-address').fill('서울 마포구 연남동 223-14');
await page.locator('#contact-phone').fill('02-332-8841');
await page.screenshot({ path: `${out}/D3.png`, fullPage: true });
await next();
await page.getByRole('button', { name: /건너뛰기/ }).click();
await page.getByRole('button', { name: /보통/ }).click();
await page.screenshot({ path: `${out}/E1.png`, fullPage: true });
await next();
await page.getByRole('button', { name: /건너뛰기/ }).click();
await page.getByRole('button', { name: /건너뛰기/ }).click();
await page.getByRole('button', { name: /손님·고객도 써요/ }).click();
await next();
await page.getByRole('button', { name: /저장 없이 만들기/ }).click();
await next();
await page.getByRole('button', { name: /건너뛰기/ }).click();

// G
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/G.png`, fullPage: true });
await page.getByRole('button', { name: '만들기' }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/sheet.png`, fullPage: true });

// 새로고침 이어하기
await page.goto('http://127.0.0.1:5199/brief', { waitUntil: 'domcontentloaded' });
await page.locator('h1').first().waitFor();
await page.waitForTimeout(400);

const resumed = await page.locator('h1').first().textContent();
console.log('resumed at:', resumed);

// 모바일
const m = await browser.newPage({ viewport: { width: 390, height: 1400 } });
await m.goto('http://127.0.0.1:5199/brief', { waitUntil: 'domcontentloaded' });
await m.evaluate(() => localStorage.clear());
await m.reload({ waitUntil: 'domcontentloaded' });
await m.locator('h1').first().waitFor();
await m.waitForTimeout(600);
await m.screenshot({ path: `${out}/mobile-A1.png`, fullPage: true });

console.log('errors:', errors.length ? errors : 'none');
await browser.close();
