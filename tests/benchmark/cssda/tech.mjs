/**
 * 3차 패스 — 기술 스택 엄격 판정. 1차 crawl.mjs의 정규식이 본문 단어("three", "drive")까지 잡아 과대집계됐다.
 * 여기서는 <script src>·인라인 스크립트 본문·window 전역·네트워크 요청 URL만 본다.
 *
 *   node tests/benchmark/cssda/tech.mjs [--out tests/benchmark/cssda/2026-09-11] [--concurrency 4]
 * 출력: <out>/tech.json
 */
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const argValue = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const OUT = argValue('--out', join('tests', 'benchmark', 'cssda', '2026-09-11'));
const CONCURRENCY = Number(argValue('--concurrency', '4'));
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';

// [이름, 스크립트/요청 URL 패턴, 인라인 코드 패턴, window 전역]
const TECH = [
  ['three', /three(?:\.module|\.min|\.cjs)?\.js|\/three@|three\/build|three\/examples|@react-three|threejs/i, /from\s*["']three["']|require\(["']three["']\)|THREE\.(?:WebGLRenderer|Scene|PerspectiveCamera)/, ['THREE']],
  ['webgl-other', /\b(?:ogl|pixi|babylon|curtainsjs|regl|twgl|playcanvas)\b|pixi\.js|babylon\.js/i, /new\s+(?:Renderer|Application|Engine)\(|createProgram\(|WebGLRenderingContext|getContext\(["']webgl2?["']\)/, ['PIXI', 'BABYLON']],
  ['gsap', /gsap|greensock|scrolltrigger/i, /gsap\.(?:to|from|timeline|registerPlugin)|ScrollTrigger\.create/, ['gsap', 'ScrollTrigger']],
  ['lenis', /lenis/i, /new\s+Lenis\(/, ['Lenis']],
  ['locomotive', /locomotive-scroll|locomotive/i, /new\s+LocomotiveScroll\(/, ['LocomotiveScroll']],
  ['barba', /barba/i, /barba\.init\(/, ['barba']],
  ['swiper', /swiper/i, /new\s+Swiper\(/, ['Swiper']],
  ['lottie', /lottie|bodymovin/i, /lottie\.loadAnimation\(/, ['lottie', 'bodymovin']],
  ['rive', /rive(?:-app|\.js|\/rive|@rive-app|rive\.wasm)/i, /new\s+rive\.Rive\(|new\s+Rive\(/, ['rive']],
  ['spline', /@splinetool|spline\.design|splinetool/i, /new\s+Application\(.*spline/i, ['SPLINE']],
  ['framer-motion', /framer-motion|framerusercontent/i, /framer-motion/, []],
  ['webflow', /webflow\.js|webflow\.com|d3e54v103j8qbb\.cloudfront/i, /Webflow\.require|data-wf-page/, ['Webflow']],
  ['next', /\/_next\//i, /__NEXT_DATA__|self\.__next_f/, ['__NEXT_DATA__', 'next']],
  ['nuxt', /\/_nuxt\//i, /__NUXT__|window\.__nuxt/, ['__NUXT__', '$nuxt']],
  ['astro', /\/_astro\//i, /astro-island/, []],
  ['gatsby', /gatsby/i, /___gatsby/, ['___gatsby']],
  ['svelte', /svelte|_app\/immutable/i, /__sveltekit/, ['__sveltekit_dev']],
  ['vue', /vue(?:\.runtime)?(?:\.esm)?(?:-browser)?(?:\.prod)?(?:\.min)?\.js|\/vue@/i, /__vue_app__|createApp\(/, ['Vue']],
  ['react', /react-dom|\/react@|react\.production|react-dom\.production/i, /__reactContainer|_reactRootContainer|createRoot\(/, ['React', '__REACT_DEVTOOLS_GLOBAL_HOOK__']],
  ['wordpress', /wp-content|wp-includes/i, /wp-block|wp-json/, ['wp']],
  ['shopify', /cdn\.shopify\.com/i, /Shopify\./, ['Shopify']],
  ['wix', /wixstatic|parastorage/i, /wixBiSession/, ['wixBiSession']],
  ['squarespace', /squarespace/i, /Static\.SQUARESPACE_CONTEXT/, []],
  ['jquery', /jquery/i, /jQuery\(|\$\(document\)\.ready/, ['jQuery']],
  ['tailwind', /tailwind/i, /--tw-ring-offset|tailwindcss/, []],
  ['splitting', /splitting|split-type|splittext/i, /new\s+SplitType\(|Splitting\(/, ['SplitType', 'Splitting']],
  ['matter', /matter(?:\.min)?\.js|matter-js/i, /Matter\.Engine/, ['Matter']],
  ['unity', /unity|\.unityweb/i, /createUnityInstance/, ['createUnityInstance']],
  ['video-lib', /hls\.js|plyr|vimeo\.com\/api|player\.vimeo/i, /new\s+Hls\(|new\s+Plyr\(/, ['Hls', 'Plyr']],
];

async function probe(browser, entry, index) {
  const result = { id: entry.id, url: entry.url, ok: false };

  if (!entry.url) {
    result.error = 'no url';
    return result;
  }

  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, userAgent: UA });
  const page = await context.newPage();
  const urls = [];
  page.on('request', (req) => urls.push(req.url()));

  try {
    await page.goto(entry.url, { waitUntil: 'domcontentloaded', timeout: 40000 });
    await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
    await page.waitForTimeout(2500);

    const inline = await page.evaluate(() => [...document.querySelectorAll('script:not([src])')].map((s) => s.textContent || '').join('\n').slice(0, 600000));
    const attrs = await page.evaluate(() => [document.documentElement.outerHTML.slice(0, 20000), ...[...document.documentElement.attributes].map((a) => `${a.name}=${a.value}`)].join(' '));
    const globals = await page.evaluate((names) => names.filter((n) => n in window), [...new Set(TECH.flatMap(([, , , g]) => g))]);
    const scriptSrcs = urls.filter((u) => /\.(?:m?js)(?:\?|$)|\/_next\/|\/_nuxt\/|\/_astro\//i.test(u));
    const urlBlob = urls.join('\n');
    const detected = TECH.filter(([, urlRe, codeRe, g]) => urlRe.test(urlBlob) || codeRe.test(inline) || codeRe.test(attrs) || g.some((k) => globals.includes(k))).map(([n]) => n);

    result.tech = detected;
    result.scripts = scriptSrcs.length;
    result.requests = urls.length;
    result.hasWebGLCanvas = await page.evaluate(() => [...document.querySelectorAll('canvas')].some((c) => Boolean(c.getContext('webgl2') || c.getContext('webgl'))));
    result.ok = true;
  } catch (error) {
    result.error = String(error?.message || error).slice(0, 120);
  } finally {
    await context.close();
  }

  console.log(`[${index}] ${entry.title} → ${result.ok ? result.tech.join(',') || '(none)' : 'FAIL ' + result.error}`);

  return result;
}

async function main() {
  const entries = JSON.parse(readFileSync(join(OUT, 'entries.json'), 'utf8')).filter((e) => e.url);
  const outPath = join(OUT, 'tech.json');
  const done = existsSync(outPath) ? JSON.parse(readFileSync(outPath, 'utf8')).filter((r) => r.ok) : [];
  const doneIds = new Set(done.map((r) => r.id));
  const queue = entries.filter((e) => !doneIds.has(e.id));
  const results = [...done];
  const browser = await chromium.launch();
  let cursor = 0;

  const worker = async () => {
    while (cursor < queue.length) {
      const i = cursor++;
      results.push(await probe(browser, queue[i], i + 1));
      writeFileSync(outPath, JSON.stringify(results, null, 2));
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  await browser.close();
  console.log(`done ${results.filter((r) => r.ok).length}/${entries.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
