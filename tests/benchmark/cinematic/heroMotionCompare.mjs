/*
 * 히어로 3종 대조 — ?(기본, 영상→셰이더) vs ?hero=video(셰이더 없이 <video>) vs ?hero=image(정지 사진).
 * CSSDA motion.mjs와 같은 임계(합 72/765)로 세고, 그 임계 밑 변화도 보이게 soft(24) 값을 같이 낸다.
 *
 *   (데모 서버 먼저) cd kits/cinematic && npm run dev
 *   node tests/benchmark/cinematic/heroMotionCompare.mjs
 */
import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
async function thresholded(url) {
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const lab = await b.newPage(); await lab.setContent('<html><body></body></html>');
  await p.goto(url, { waitUntil: 'networkidle' }); await p.waitForTimeout(4000);
  const shots = [];
  for (let i = 0; i < 3; i += 1) { shots.push(await p.screenshot({ type: 'jpeg', quality: 50 })); await p.waitForTimeout(700); }
  const info = await p.evaluate(() => ({ canvases: document.querySelectorAll('canvas').length, videos: [...document.querySelectorAll('video')].filter((v) => !v.paused).length }));
  const diff = async (a, c) => lab.evaluate(async ([x, y]) => {
    const load = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = `data:image/jpeg;base64,${s}`; });
    const [ia, ib] = await Promise.all([load(x), load(y)]);
    const cv = document.createElement('canvas'); cv.width = 160; cv.height = 100; const ctx = cv.getContext('2d');
    ctx.drawImage(ia, 0, 0, 160, 100); const da = ctx.getImageData(0, 0, 160, 100).data;
    ctx.drawImage(ib, 0, 0, 160, 100); const db = ctx.getImageData(0, 0, 160, 100).data;
    let n = 0; let soft = 0;
    for (let i = 0; i < da.length; i += 4) { const d = Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]); if (d > 72) n++; if (d > 24) soft++; }
    return { hard: +(n / 16000).toFixed(4), soft: +(soft / 16000).toFixed(4) };
  }, [a.toString('base64'), c.toString('base64')]);
  const d1 = await diff(shots[0], shots[1]); const d2 = await diff(shots[1], shots[2]);
  await p.close(); await lab.close();
  return { url, ...info, hard: Math.max(d1.hard, d2.hard), soft: Math.max(d1.soft, d2.soft) };
}
for (const mode of ['', '?hero=video', '?hero=image']) console.log(await thresholded('http://127.0.0.1:5190/' + mode));
await b.close();
