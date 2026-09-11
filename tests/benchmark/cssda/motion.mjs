/**
 * 2차 패스 — 움직임 측정. 정지 스크린샷으로는 스크롤 연출·앰비언트 모션·스무스 스크롤을 못 잡아서
 * (사용자 지적 2026-09-11) 프레임 차이·DOM 위치 추적·엔진 훅으로 수치화하고, 사람이 볼 12초 스크롤 영상을 남긴다.
 *
 *   node tests/benchmark/cssda/motion.mjs [--out tests/benchmark/cssda/2026-09-11] [--concurrency 3] [--only <id,id>]
 * 입력: <out>/entries.json  출력: <out>/motion.json, <out>/video/<id>.webm, <out>/frames/<id>-{0..7}.jpg
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const argValue = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const OUT = argValue('--out', join('tests', 'benchmark', 'cssda', '2026-09-11'));
const CONCURRENCY = Number(argValue('--concurrency', '3'));
const ONLY = (argValue('--only', '') || '').split(',').filter(Boolean);
const VIDEO = join(OUT, 'video');
const FRAMES = join(OUT, 'frames');
mkdirSync(VIDEO, { recursive: true });
mkdirSync(FRAMES, { recursive: true });

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';
const W = 1280;
const H = 800;

/** 두 JPEG 버퍼의 차이 — 페이지 안에서 canvas로 비교(라이브러리 없이). 0~1 (다른 픽셀 비율, 임계 24/255). */
async function frameDiff(page, a, b) {
  return page.evaluate(
    async ([ba, bb]) => {
      const load = (b64) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.src = `data:image/jpeg;base64,${b64}`;
        });
      const [ia, ib] = await Promise.all([load(ba), load(bb)]);
      const w = 160;
      const h = 100;
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      ctx.drawImage(ia, 0, 0, w, h);
      const da = ctx.getImageData(0, 0, w, h).data;
      ctx.drawImage(ib, 0, 0, w, h);
      const db = ctx.getImageData(0, 0, w, h).data;
      let diff = 0;

      for (let i = 0; i < da.length; i += 4) {
        const d = Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]);

        if (d > 72) diff++;
      }

      return diff / (w * h);
    },
    [a.toString('base64'), b.toString('base64')],
  );
}

async function measure(browser, entry, index) {
  const result = { id: entry.id, title: entry.title, url: entry.url, ok: false };

  if (!entry.url) {
    result.error = 'no url';
    return result;
  }

  const context = await browser.newContext({
    viewport: { width: W, height: H },
    userAgent: UA,
    recordVideo: { dir: VIDEO, size: { width: W, height: H } },
  });
  const page = await context.newPage();
  // 측정용 캔버스 비교는 사이트 페이지가 아니라 빈 페이지에서 한다(CSP 회피).
  const lab = await context.newPage();
  await lab.setContent('<html><body></body></html>');
  await page.bringToFront();

  try {
    await page.goto(entry.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(3500);
    await page.mouse.move(W - 40, H - 40);

    // rAF 초당 횟수 + 엔진 훅
    const engine = await page.evaluate(
      () =>
        new Promise((resolve) => {
          let n = 0;
          const t0 = performance.now();
          const tick = () => {
            n++;

            if (performance.now() - t0 < 1000) requestAnimationFrame(tick);
            else
              resolve({
                rafPerSec: n,
                scrollTriggers: typeof window.ScrollTrigger?.getAll === 'function' ? window.ScrollTrigger.getAll().length : null,
                gsap: typeof window.gsap !== 'undefined',
                lenis: Boolean(window.Lenis || document.documentElement.classList.contains('lenis')),
                locomotive: Boolean(document.querySelector('[data-scroll-container], .has-scroll-smooth')),
                canvases: document.querySelectorAll('canvas').length,
                videosPlaying: [...document.querySelectorAll('video')].filter((v) => !v.paused).length,
              });
          };
          requestAnimationFrame(tick);
        }),
    );
    Object.assign(result, engine);

    // 1) 앰비언트 모션: 같은 위치 3프레임
    const idle = [];

    for (let i = 0; i < 3; i++) {
      idle.push(await page.screenshot({ type: 'jpeg', quality: 50 }));
      await page.waitForTimeout(700);
    }

    result.idleMotion = Math.round(((await frameDiff(lab, idle[0], idle[1])) + (await frameDiff(lab, idle[1], idle[2]))) * 500) / 1000;

    // 2) 호버 반응: 첫 눈에 띄는 링크/버튼
    const target = await page.evaluate(() => {
      const els = [...document.querySelectorAll('a, button')].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 40 && r.height > 16 && r.top > 0 && r.bottom < innerHeight && (el.textContent || '').trim();
      });
      const el = els[0];

      if (!el) return null;

      const r = el.getBoundingClientRect();

      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });

    if (target) {
      const before = await page.screenshot({ type: 'jpeg', quality: 50 });
      await page.mouse.move(target.x, target.y);
      await page.waitForTimeout(600);
      const after = await page.screenshot({ type: 'jpeg', quality: 50 });
      result.hoverDiff = Math.round((await frameDiff(lab, before, after)) * 1000) / 1000;
      await page.mouse.move(W - 40, H - 40);
    }

    // 3) 스크롤: 큰 요소 위치 추적(패럴랙스·핀) + 관성
    const track = () =>
      page.evaluate(() => {
        const els = [...document.querySelectorAll('body *')]
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 200 && r.height > 120 && el.children.length < 40;
          })
          .slice(0, 60);

        return { y: window.scrollY, rects: els.map((el) => ({ tag: el.tagName, top: el.getBoundingClientRect().top, fixed: getComputedStyle(el).position === 'fixed' || getComputedStyle(el).position === 'sticky' })) };
      });
    const before = await track();
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(120);
    const quick = await page.screenshot({ type: 'jpeg', quality: 50 });
    await page.waitForTimeout(1200);
    const settled = await page.screenshot({ type: 'jpeg', quality: 50 });
    result.inertia = Math.round((await frameDiff(lab, quick, settled)) * 1000) / 1000;
    const after = await track();
    const moved = after.y - before.y;
    result.scrollDelta = moved;

    if (moved > 50) {
      let normal = 0;
      let parallax = 0;
      let pinned = 0;

      for (const [i, r] of before.rects.entries()) {
        const a = after.rects[i];

        if (!a || a.tag !== r.tag || r.fixed) continue;

        const shift = r.top - a.top;

        if (Math.abs(shift) < moved * 0.15) pinned++;
        else if (shift < moved * 0.8 || shift > moved * 1.2) parallax++;
        else normal++;
      }

      result.elements = { normal, parallax, pinned, fixed: before.rects.filter((r) => r.fixed).length };
    } else {
      result.elements = { note: 'scroll did not move (snap/hijack/short page)', delta: moved };
    }

    // 4) 스크롤 여정 8프레임 (콘택트시트용) — 페이지 전체를 8등분해 천천히 이동
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(800);
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    result.docHeight = height;
    const step = Math.max(0, (height - H) / 7);
    const frames = [];

    for (let i = 0; i < 8; i++) {
      const y = Math.round(step * i);
      await page.mouse.wheel(0, i === 0 ? 0 : Math.round(step));
      await page.waitForTimeout(900);
      const buf = await page.screenshot({ type: 'jpeg', quality: 45 });
      frames.push(buf);
      writeFileSync(join(FRAMES, `${entry.id}-${i}.jpg`), buf);
      void y;
    }

    // 연속 프레임 차이 평균 = 스크롤 여정에서 화면이 얼마나 바뀌는지(0이면 죽은 페이지, 높으면 장면 전환형)
    let sum = 0;

    for (let i = 1; i < frames.length; i++) sum += await frameDiff(lab, frames[i - 1], frames[i]);

    result.journeyChange = Math.round((sum / 7) * 1000) / 1000;
    result.ok = true;
  } catch (error) {
    result.error = String(error?.message || error).slice(0, 160);
  } finally {
    const video = page.video();
    await context.close();

    try {
      const path = await video?.path();

      if (path) renameSync(path, join(VIDEO, `${entry.id}.webm`));
    } catch {
      /* ignore */
    }
  }

  console.log(`[${index}] ${entry.title} → ${result.ok ? `idle ${result.idleMotion} hover ${result.hoverDiff} inertia ${result.inertia} journey ${result.journeyChange} el ${JSON.stringify(result.elements)} raf ${result.rafPerSec} st ${result.scrollTriggers}` : 'FAIL ' + result.error}`);

  return result;
}

async function main() {
  const entries = JSON.parse(readFileSync(join(OUT, 'entries.json'), 'utf8')).filter((e) => e.url && (ONLY.length === 0 || ONLY.includes(e.id)));
  const outPath = join(OUT, 'motion.json');
  const done = existsSync(outPath) ? JSON.parse(readFileSync(outPath, 'utf8')).filter((r) => r.ok) : [];
  const doneIds = new Set(done.map((r) => r.id));
  const queue = entries.filter((e) => !doneIds.has(e.id));
  const results = [...done];
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
  let cursor = 0;

  const worker = async () => {
    while (cursor < queue.length) {
      const i = cursor++;
      results.push(await measure(browser, queue[i], i + 1));
      writeFileSync(outPath, JSON.stringify(results, null, 2));
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  await browser.close();

  // playwright가 남긴 임시 webm(이름 못 바꾼 것) 정리
  for (const f of readdirSync(VIDEO)) {
    if (!/^\d+\.webm$/.test(f)) rmSync(join(VIDEO, f), { force: true });
  }

  console.log(`done ${results.filter((r) => r.ok).length}/${entries.length} → ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
