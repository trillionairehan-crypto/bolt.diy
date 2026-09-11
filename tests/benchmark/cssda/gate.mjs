/**
 * 4차 패스 — 게이트(Enter) 뒤 경험 녹화. 헤드리스+SwiftShader로는 못 본 9점대 사이트(Icare·100 Lost Species·Santioni)를
 * 실제 GPU(headless:false)로 열어 Enter/시작 버튼을 누르고 키·휠·마우스로 60초 진행하며 webm + 프레임을 남긴다.
 * 창이 화면에 뜬다(헤드리스 아님). 사운드는 녹음 안 됨.
 *
 *   node tests/benchmark/cssda/gate.mjs [--out tests/benchmark/cssda/2026-09-11] [--only <id,id>] [--seconds 60]
 * 입력: <out>/entries.json (없는 id는 --url <id>=<url> 로 추가 가능)  출력: <out>/gate/<id>.webm, <out>/gate/<id>-{n}.jpg, <out>/gate.json
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const argValue = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const OUT = argValue('--out', join('tests', 'benchmark', 'cssda', '2026-09-11'));
const ONLY = (argValue('--only', '') || '').split(',').filter(Boolean);
const SECONDS = Number(argValue('--seconds', '60'));
const EXTRA = args.filter((a, i) => args[i - 1] === '--url').map((s) => ({ id: s.split('=')[0], url: s.slice(s.indexOf('=') + 1), title: s.split('=')[0] }));
const DIR = join(OUT, 'gate');
mkdirSync(DIR, { recursive: true });

const W = 1440;
const H = 900;
const GATE_RE = /^(enter|start|begin|play|explore|press any key|start now|enter with(out)? (audio|sound)|입장|시작)/i;

async function pressGate(page) {
  // 1) 텍스트가 게이트 문구인 버튼/링크 클릭
  const clicked = await page.evaluate((reSrc) => {
    const re = new RegExp(reSrc, 'i');
    const els = [...document.querySelectorAll('button, a, [role="button"], div, span')].filter((el) => {
      const t = (el.textContent || '').trim();
      const r = el.getBoundingClientRect();
      return t.length < 40 && re.test(t) && r.width > 20 && r.height > 12 && r.top >= 0 && r.bottom <= innerHeight;
    });
    const el = els.sort((a, b) => (a.textContent || '').length - (b.textContent || '').length)[0];

    if (!el) return null;

    el.click();

    return (el.textContent || '').trim();
  }, GATE_RE.source);

  if (clicked) return `click:${clicked}`;

  // 2) 아무 키/클릭 안내면 키 + 중앙 클릭
  await page.keyboard.press('Enter');
  await page.mouse.click(W / 2, H / 2);

  return 'key+click';
}

async function run(browser, entry) {
  const context = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: DIR, size: { width: W, height: H } } });
  const page = await context.newPage();
  const result = { id: entry.id, title: entry.title, url: entry.url, ok: false, frames: [] };
  const t0 = Date.now();

  try {
    await page.goto(entry.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(6000);
    result.loadMs = Date.now() - t0;
    result.gate = await pressGate(page);
    await page.waitForTimeout(4000);
    result.gate2 = await pressGate(page);

    const shots = Math.max(6, Math.floor(SECONDS / 4));
    const canvases = await page.evaluate(() => document.querySelectorAll('canvas').length);
    result.canvases = canvases;

    for (let i = 0; i < shots; i++) {
      // 진행: 휠 + 오른쪽 키 + 마우스 드리프트(경험형은 셋 중 하나에 반응)
      await page.mouse.move(W / 2 + Math.sin(i) * 300, H / 2 + Math.cos(i) * 150, { steps: 12 });
      await page.mouse.wheel(0, 700);
      await page.keyboard.press(i % 3 === 0 ? 'ArrowRight' : i % 3 === 1 ? 'ArrowDown' : 'Space');
      await page.waitForTimeout(4000);
      const file = join(DIR, `${entry.id}-${i}.jpg`);
      await page.screenshot({ path: file, type: 'jpeg', quality: 55, timeout: 20000 }).catch(() => {});
      result.frames.push(file);
    }

    result.ok = true;
  } catch (error) {
    result.error = String(error?.message || error).slice(0, 200);
  } finally {
    const video = page.video();
    await context.close();

    try {
      const p = await video?.path();

      if (p) renameSync(p, join(DIR, `${entry.id}.webm`));
    } catch {
      /* ignore */
    }
  }

  console.log(`${entry.title} → ${result.ok ? `gate ${result.gate}/${result.gate2} canvases ${result.canvases} load ${result.loadMs}ms` : 'FAIL ' + result.error}`);

  return result;
}

async function main() {
  const entries = [...JSON.parse(readFileSync(join(OUT, 'entries.json'), 'utf8')).filter((e) => e.url), ...EXTRA].filter((e) => ONLY.length === 0 || ONLY.includes(e.id));
  const outPath = join(OUT, 'gate.json');
  const done = existsSync(outPath) ? JSON.parse(readFileSync(outPath, 'utf8')) : [];
  const browser = await chromium.launch({ headless: false, args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
  const results = [...done.filter((r) => !entries.some((e) => e.id === r.id))];

  for (const entry of entries) {
    results.push(await run(browser, entry));
    writeFileSync(outPath, JSON.stringify(results, null, 2));
  }

  await browser.close();
  console.log(`done ${results.length} → ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
