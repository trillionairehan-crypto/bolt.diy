/*
 * 디테일 검증 — 빌드된 .render-tmp/dist를 1440×900(2x)에서 장면마다 스크롤해 (1) 텍스트 블록의 좌측 정렬·세로
 * 간격·서체 수치를 JSON으로, (2) 세부 영역 크롭(내비·히어로 좌하단·챕터 인덱스·스펙 표·컨택트 행·마퀴)을 2배
 * 해상도로 남긴다. 사람이 볼 것: 크롭. 기계가 볼 것: metrics.json의 leftEdges(같은 장면 안 좌측 x 편차)와 gaps.
 *
 *   node tests/benchmark/cinematic/detailProbe.mjs <outDir>
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const DIST = join(ROOT, 'kits/cinematic/.render-tmp/dist');
const OUT = join(ROOT, process.argv[2] ?? 'tests/benchmark/cinematic/render-2026-09-12/detail');
const VIEW = { width: 1440, height: 900 };
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp4': 'video/mp4', '.svg': 'image/svg+xml' };

function serve(dir) {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const p = decodeURIComponent((req.url ?? '/').split('?')[0]);
      let f = join(dir, p === '/' ? 'index.html' : p);

      if (!existsSync(f)) {
        f = join(dir, 'index.html');
      }

      res.writeHead(200, { 'Content-Type': MIME[extname(f)] ?? 'application/octet-stream' });
      res.end(readFileSync(f));
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

/** 뷰포트 안 주요 텍스트 블록의 rect·서체. 같은 장면에서 좌측 x가 흩어지면 정렬 결함. */
const SCENE_DETAIL = () => {
  const vh = window.innerHeight;
  const pick = (sel) =>
    Array.from(document.querySelectorAll(sel)).filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < vh && getComputedStyle(el).opacity !== '0';
    });
  const info = (el, role) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      role,
      text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30),
      x: Math.round(r.left),
      y: Math.round(r.top),
      w: Math.round(r.width),
      h: Math.round(r.height),
      px: parseFloat(cs.fontSize),
      weight: cs.fontWeight,
      lh: Math.round(parseFloat(cs.lineHeight)) || null,
      ls: cs.letterSpacing,
      color: cs.color,
    };
  };
  const blocks = [
    ...pick('[data-ck="nav"] > a').map((el) => info(el, 'nav-brand')),
    ...pick('[data-ck="nav"] nav a').map((el) => info(el, 'nav-link')),
    ...pick('.ck-eyebrow').map((el) => info(el, 'eyebrow')),
    ...pick('h1.ck-display, h2.ck-display, h3.ck-display').map((el) => info(el, 'display')),
    ...pick('p').map((el) => info(el, 'p')),
    ...pick('.ck-btn').map((el) => info(el, 'btn')),
    ...pick('ol li').map((el) => info(el, 'index')),
    ...pick('dl dt').map((el) => info(el, 'dt')),
    ...pick('dl dd').map((el) => info(el, 'dd')),
    ...pick('.ck-marquee__item').slice(0, 3).map((el) => info(el, 'marquee')),
    ...pick('[data-ck="scene-nav"] button').map((el) => info(el, 'scene-nav')),
    ...pick('[data-ck="cursor-ring"]').map((el) => info(el, 'cursor')),
  ];
  const gutter = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ck-gutter')) || null;
  const leftEdges = [...new Set(blocks.filter((b) => !['nav-link', 'scene-nav', 'cursor', 'dd', 'marquee'].includes(b.role)).map((b) => b.x))].sort((a, b) => a - b);

  return { scrollY: Math.round(window.scrollY), gutter, leftEdges, blocks };
};

const { server, port } = await serve(DIST);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl'] });
const page = await browser.newPage({ viewport: VIEW, deviceScaleFactor: 2 });
mkdirSync(OUT, { recursive: true });
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

const scenes = await page.evaluate(() =>
  Array.from(document.querySelectorAll('[data-ck="hero"], [data-ck="chapter"], [data-ck="scene"], [data-ck="marquee"], [data-ck="contact"], h2.ck-display--statement'))
    .map((el) => ({ kind: el.getAttribute('data-ck') || 'statement', top: Math.round(el.getBoundingClientRect().top + window.scrollY), h: Math.round(el.getBoundingClientRect().height) }))
    .sort((a, b) => a.top - b.top),
);

/** 장면별로 볼 크롭(뷰포트 좌표). 없는 장면은 건너뛴다. */
const CROPS = {
  hero: [
    ['nav', { x: 0, y: 0, width: 1440, height: 80 }],
    ['hero-bottom-left', { x: 40, y: 560, width: 720, height: 320 }],
    ['hero-caption', { x: 1000, y: 700, width: 440, height: 200 }],
  ],
  statement: [['statement', { x: 0, y: 0, width: 1440, height: 900 }]],
  chapter: [
    ['chapter-index', { x: 40, y: 80, width: 560, height: 200 }],
    ['chapter-title', { x: 40, y: 280, width: 560, height: 420 }],
    ['chapter-progress', { x: 40, y: 800, width: 560, height: 80 }],
  ],
  scene: [
    ['showcase-specs', { x: 40, y: 560, width: 560, height: 320 }],
    ['showcase-label', { x: 600, y: 800, width: 400, height: 100 }],
  ],
  marquee: [['marquee', { x: 0, y: 0, width: 1440, height: 260 }]],
  contact: [
    ['contact-title', { x: 40, y: 60, width: 900, height: 420 }],
    ['contact-rows', { x: 40, y: 700, width: 1400, height: 200 }],
  ],
};

const results = [];

for (const scene of scenes) {
  const y = scene.kind === 'chapter' ? scene.top + Math.round((scene.h - VIEW.height) * 0.5) : scene.kind === 'marquee' ? scene.top - 120 : scene.top;
  await page.evaluate((target) => window.scrollTo(0, target), Math.max(0, y));
  await page.waitForTimeout(1400);

  const detail = await page.evaluate(SCENE_DETAIL);
  results.push({ kind: scene.kind, ...detail });

  for (const [name, clip] of CROPS[scene.kind] ?? []) {
    await page.screenshot({ path: join(OUT, `${name}.png`), clip, timeout: 15000 }).catch((e) => console.log('crop failed', name, e.message.split('\n')[0]));
  }
}

writeFileSync(join(OUT, 'metrics.json'), JSON.stringify(results, null, 2), 'utf8');

for (const r of results) {
  console.log(`== ${r.kind} y=${r.scrollY} gutter=${r.gutter} leftEdges=${JSON.stringify(r.leftEdges)}`);

  for (const b of r.blocks) {
    console.log(`   ${b.role.padEnd(10)} x=${String(b.x).padStart(4)} y=${String(b.y).padStart(4)} ${String(b.w).padStart(4)}×${String(b.h).padStart(3)} ${b.px}px/${b.weight} lh=${b.lh} ls=${b.ls} | ${b.text}`);
  }
}

await browser.close();
server.close();
