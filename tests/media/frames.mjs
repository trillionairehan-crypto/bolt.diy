/**
 * 영상 → 프레임 N장 추출(ffmpeg 없이 Playwright로 <video>를 시크하며 캡처) → R2 업로드. ScrollSequence 입력.
 *   node tests/media/frames.mjs --video <mp4 url> --key media/showroom/<world>/seq --n 60 [--width 1600]
 * 출력: 콘솔에 프레임 URL 목록 JSON, tests/media/.frames-<ts>.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { AwsClient } from 'aws4fetch';

const args = process.argv.slice(2);
const arg = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const VIDEO = arg('--video'); const KEY = arg('--key'); const N = Number(arg('--n', '60')); const WIDTH = Number(arg('--width', '1600'));
if (!VIDEO || !KEY) { console.error('--video, --key required'); process.exit(1); }

const env = { ...process.env };
for (const file of ['.env.local', '.env']) { try { for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); } } catch {} }
const aws = new AwsClient({ accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY, service: 's3', region: 'auto' });
const endpoint = `https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET_NAME}`;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: WIDTH, height: Math.round(WIDTH * 9 / 16) } });
await p.setContent(`<body style="margin:0;background:#000"><video id="v" src="${VIDEO}" muted playsinline crossorigin="anonymous" style="width:${WIDTH}px;height:${Math.round(WIDTH * 9 / 16)}px;object-fit:cover"></video></body>`);
await p.waitForFunction(() => document.getElementById('v').readyState >= 2, null, { timeout: 60000 });
const dur = await p.evaluate(() => document.getElementById('v').duration);
const urls = [];
for (let i = 0; i < N; i++) {
  const t = Math.min(dur - 0.04, (dur * i) / (N - 1));
  await p.evaluate((t) => { document.getElementById('v').currentTime = t; }, t);
  await p.waitForFunction(() => document.getElementById('v').seeking === false);
  await p.waitForTimeout(60);
  const buf = await p.screenshot({ type: 'jpeg', quality: 78 });
  const key = `${KEY}/${String(i).padStart(3, '0')}.jpg`;
  const res = await aws.fetch(`${endpoint}/${key}`, { method: 'PUT', body: buf, headers: { 'content-type': 'image/jpeg' } });
  if (!res.ok) { console.error('put failed', res.status, await res.text()); process.exit(1); }
  urls.push(`${env.R2_PUBLIC_BASE_URL.replace(/\/$/, '')}/${key}`);
  if (i % 10 === 0) console.error(`frame ${i}/${N}`);
}
await b.close();
const out = `tests/media/.frames-${Date.now().toString(36)}.json`;
writeFileSync(out, JSON.stringify({ video: VIDEO, key: KEY, frames: urls }, null, 1));
console.log(JSON.stringify({ n: urls.length, first: urls[0], last: urls[urls.length - 1], file: out }));
