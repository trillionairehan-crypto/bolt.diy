/**
 * CSS Design Awards WOTD 수상작 크롤러 — 목록(/wotd-award-winners?page=1..N) → 상세(점수·심사위원·태그·외부 URL)
 * → 실제 사이트 방문(스크린샷 3장 + 기술 신호 + 타이포·색·구조 측정). 사람이 리포트를 쓰기 위한 원자료.
 *
 *   node tests/benchmark/cssda/crawl.mjs [--pages 5] [--concurrency 4] [--out tests/benchmark/cssda/<date>]
 * 출력: <out>/entries.json (목록+상세), <out>/sites.json (방문 결과), <out>/shots/<id>-{0,1,2}.jpg
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const BASE = 'https://www.cssdesignawards.com';
const args = process.argv.slice(2);
const argValue = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const PAGES = Number(argValue('--pages', '5'));
const CONCURRENCY = Number(argValue('--concurrency', '4'));
const OUT = argValue('--out', join('tests', 'benchmark', 'cssda', new Date().toISOString().slice(0, 10)));
const SHOTS = join(OUT, 'shots');
mkdirSync(SHOTS, { recursive: true });

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';

async function crawlList(page, pageNo) {
  await page.goto(`${BASE}/wotd-award-winners?page=${pageNo}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1500);

  return page.evaluate(() => {
    const seen = new Map();

    for (const a of document.querySelectorAll('a[href*="/sites/"]')) {
      const href = a.getAttribute('href') || '';
      const m = href.match(/\/sites\/([^/]+)\/(\d+)\/?/);

      if (!m) continue;

      const id = m[2];
      const card = a.closest('article, li, .card, div') || a;
      const text = (card.textContent || '').replace(/\s+/g, ' ').trim();
      const score = text.match(/\b(\d\.\d{1,2})\b/);
      const award = text.match(/WOTD|WOTM|WOTY|S\.?KUDOS|SPECIAL KUDOS|NOMINEE|JUDGE/i);
      const prev = seen.get(id) || {};

      seen.set(id, {
        id,
        slug: m[1],
        detail: `/sites/${m[1]}/${id}/`,
        title: prev.title || (a.getAttribute('title') || a.textContent || '').replace(/\s+/g, ' ').trim() || m[1],
        award: prev.award || (award ? award[0].toUpperCase() : ''),
        listScore: prev.listScore || (score ? Number(score[1]) : null),
      });
    }

    return [...seen.values()];
  });
}

async function crawlDetail(page, entry) {
  await page.goto(`${BASE}${entry.detail}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1200);

  // 실측 DOM(2026-09-11): 외부 링크 = a.single-website__thumbnail, 작가 = .single-website__author__name,
  // 본문 텍스트 = "WEBSITE OF THE DAY 2026 SEP 11 <제목> <작가> <국가> ABOUT: … TAGS: a, b CATEGORY: x PUBLIC AWARDS
  // UI DESIGN 8.59 … FINAL JUDGE'S SCORE 8.87 <심사위원> <직함> UI 8.9 UX 8.9 INN 8.8 <다음 평균> <심사위원> …"
  const data = await page.evaluate(() => {
    const text = document.body.innerText.replace(/\s+/g, ' ');
    const num = (re) => {
      const m = text.match(re);
      return m ? Number(m[1]) : null;
    };
    const thumb = document.querySelector('a.single-website__thumbnail, a[class*="thumbnail"][href^="http"]');
    const author = document.querySelector('.single-website__author__name');
    const head = text.match(/(WEBSITE OF THE DAY|SPECIAL KUDOS|WEBSITE OF THE MONTH|WEBSITE OF THE YEAR)\s+(\d{4} \w{3} \d{1,2})\s+(.+?)\s+ABOUT:/i);
    const about = (text.match(/ABOUT:\s*(.+?)\s+TAGS:/i) || [])[1] || '';
    const tags = ((text.match(/TAGS:\s*(.+?)\s+CATEGORY:/i) || [])[1] || '').split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
    const category = (text.match(/CATEGORY:\s*([a-z /&-]+?)\s+(?:PUBLIC|UI DESIGN)/i) || [])[1] || null;
    const judges = [];
    const judgeRe = /(?:^|\d\.\d{1,2}\s)?([A-Z][A-Za-z.'&-]+(?:\s[A-Z][A-Za-z.'&-]+){0,3})\s(.{2,50}?)\sUI\s(\d(?:\.\d{1,2})?)\sUX\s(\d(?:\.\d{1,2})?)\sINN\s(\d(?:\.\d{1,2})?)/g;
    const judgeText = text.slice(text.search(/FINAL JUDGE/i));
    let m;

    while ((m = judgeRe.exec(judgeText)) && judges.length < 12) {
      const ui = Number(m[3]);
      const ux = Number(m[4]);
      const inn = Number(m[5]);
      judges.push({ name: m[1], role: m[2], ui, ux, inn, avg: Math.round(((ui + ux + inn) / 3) * 100) / 100 });
    }

    let title = head ? head[3] : null;
    const agency = author ? (author.textContent || '').trim() : null;

    if (title && agency && title.endsWith(agency)) {
      title = title.slice(0, -agency.length).trim();
    }

    const countryMatch = head ? head[3].match(/\s([A-Z][A-Z .]{2,30})$/) : null;

    return {
      url: thumb?.href || null,
      award: head ? `${head[1].toUpperCase()} ${head[2].toUpperCase()}` : null,
      title: title ? title.replace(/\s[A-Z][A-Z .]{2,30}$/, '').replace(new RegExp(`\\s*${(agency || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`), '').trim() : null,
      agency,
      country: countryMatch ? countryMatch[1].trim() : null,
      about: about.slice(0, 400),
      tags,
      category,
      publicAvg: num(/(\d\.\d{2})\s+FINAL JUDGE/i),
      finalScore: num(/FINAL JUDGE'?S SCORE\s+(\d\.\d{1,2})/i),
      ui: num(/UI DESIGN\s+(\d\.\d{1,2})/i),
      ux: num(/UX DESIGN\s+(\d\.\d{1,2})/i),
      innovation: num(/INNOVATION\s+(\d\.\d{1,2})/i),
      judges,
    };
  });

  return { ...entry, ...data };
}

const TECH = [
  ['three', /three(?:\.module)?(?:\.min)?\.js|\/three@|three\.js|@react-three|\bTHREE\b/i],
  ['r3f', /@react-three|react-three-fiber/i],
  ['gsap', /gsap|TweenMax|ScrollTrigger/i],
  ['lenis', /lenis/i],
  ['locomotive', /locomotive/i],
  ['barba', /barba/i],
  ['swiper', /swiper/i],
  ['splide', /splide/i],
  ['lottie', /lottie|bodymovin/i],
  ['rive', /rive/i],
  ['spline', /spline/i],
  ['pixi', /pixi/i],
  ['ogl', /\bogl\b/i],
  ['curtains', /curtains/i],
  ['framer-motion', /framer-motion|framer\.com/i],
  ['webflow', /webflow/i],
  ['next', /_next\/|__NEXT_DATA__/i],
  ['nuxt', /_nuxt\/|__nuxt/i],
  ['astro', /astro-island|\/_astro\//i],
  ['gatsby', /gatsby/i],
  ['wordpress', /wp-content|wp-includes/i],
  ['shopify', /cdn\.shopify/i],
  ['wix', /wixstatic|wix\.com/i],
  ['squarespace', /squarespace/i],
  ['react', /react-dom|__reactContainer|data-reactroot|\/react\./i],
  ['vue', /vue(?:\.runtime)?(?:\.esm)?(?:\.min)?\.js|__vue/i],
  ['svelte', /svelte/i],
  ['jquery', /jquery/i],
  ['tailwind', /tailwind/i],
];

async function visitSite(browser, entry, index) {
  const result = { id: entry.id, url: entry.url, ok: false };

  if (!entry.url) {
    result.error = 'no url';
    return result;
  }

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, userAgent: UA, locale: 'ko-KR' });
  const page = await context.newPage();
  const resources = [];
  page.on('response', (res) => {
    try {
      const ct = res.headers()['content-type'] || '';
      resources.push({ url: res.url(), type: ct.split(';')[0], size: Number(res.headers()['content-length'] || 0) });
    } catch {
      /* ignore */
    }
  });

  const started = Date.now();

  try {
    const response = await page.goto(entry.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    result.status = response?.status() ?? null;
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(4000); // 프리로더·인트로
    result.loadMs = Date.now() - started;
    result.finalUrl = page.url();

    await page.screenshot({ path: join(SHOTS, `${entry.id}-0.jpg`), type: 'jpeg', quality: 55 });
    await page.mouse.move(720, 450);

    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    result.docHeight = height;

    for (const [i, frac] of [[1, 0.3], [2, 0.65]]) {
      const y = Math.max(0, Math.round((height - 900) * frac));
      await page.mouse.wheel(0, y);
      await page.waitForTimeout(1800);
      await page.screenshot({ path: join(SHOTS, `${entry.id}-${i}.jpg`), type: 'jpeg', quality: 55 });
    }

    const html = await page.content();
    const evalData = await page.evaluate(() => {
      const cs = (el) => (el ? getComputedStyle(el) : null);
      const heads = [...document.querySelectorAll('h1, h2, [class*="title"], [class*="heading"]')].filter((el) => (el.textContent || '').trim().length > 0);
      const largest = heads
        .map((el) => ({ el, size: parseFloat(cs(el).fontSize) }))
        .sort((a, b) => b.size - a.size)[0];
      const body = cs(document.body);
      const html = cs(document.documentElement);
      const classText = [...document.querySelectorAll('[class]')].map((el) => el.className).filter((c) => typeof c === 'string').join(' ').toLowerCase();
      const allEls = [...document.querySelectorAll('body *')];
      const blend = allEls.some((el) => cs(el).mixBlendMode !== 'normal');
      const fixedCount = allEls.filter((el) => cs(el).position === 'fixed').length;
      const uppercaseCount = allEls.filter((el) => cs(el).textTransform === 'uppercase' && (el.textContent || '').trim()).length;
      const fonts = new Set();

      for (const el of [document.body, ...heads.slice(0, 20), ...document.querySelectorAll('p, a, button')].slice(0, 200)) {
        if (el) fonts.add(cs(el).fontFamily.split(',')[0].replace(/["']/g, '').trim());
      }

      return {
        title: document.title,
        generator: document.querySelector('meta[name="generator"]')?.getAttribute('content') || null,
        lang: document.documentElement.lang || null,
        bodyBg: body.backgroundColor,
        htmlBg: html.backgroundColor,
        bodyColor: body.color,
        bodyFont: body.fontFamily.split(',')[0].replace(/["']/g, '').trim(),
        bodyFontSize: body.fontSize,
        fonts: [...fonts].slice(0, 8),
        largestHeading: largest ? { text: (largest.el.textContent || '').trim().slice(0, 80), size: largest.size, weight: cs(largest.el).fontWeight, family: cs(largest.el).fontFamily.split(',')[0].replace(/["']/g, '').trim(), transform: cs(largest.el).textTransform, letterSpacing: cs(largest.el).letterSpacing } : null,
        canvas: document.querySelectorAll('canvas').length,
        video: document.querySelectorAll('video').length,
        svg: document.querySelectorAll('svg').length,
        img: document.querySelectorAll('img').length,
        sections: document.querySelectorAll('section').length,
        scrollSnap: html.scrollSnapType !== 'none' || body.scrollSnapType !== 'none',
        cursorEl: /cursor/.test(classText),
        preloaderEl: /preload|loader|intro/.test(classText),
        marquee: /marquee|ticker/.test(classText),
        blend,
        fixedCount,
        uppercaseCount,
        viewportsTall: Math.round((document.documentElement.scrollHeight / 900) * 10) / 10,
        globals: ['THREE', 'gsap', 'ScrollTrigger', 'Lenis', 'PIXI', 'Webflow', 'jQuery', 'barba', 'Swiper', 'lottie', 'rive', 'SPLINE'].filter((k) => k in window),
        webfontLinks: [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.href).filter((h) => /fonts\.googleapis|typekit|fonts\.bunny|use\.typekit/i.test(h)).slice(0, 5),
      };
    });

    const scripts = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/g)].map((m) => m[1]);
    const haystack = [html.slice(0, 400000), ...scripts, ...evalData.globals].join('\n');
    result.tech = TECH.filter(([, re]) => re.test(haystack)).map(([name]) => name);
    result.scripts = scripts.length;
    result.jsBytes = resources.filter((r) => /javascript/.test(r.type)).reduce((a, r) => a + r.size, 0);
    result.imgBytes = resources.filter((r) => /^image\//.test(r.type)).reduce((a, r) => a + r.size, 0);
    result.videoBytes = resources.filter((r) => /^video\//.test(r.type)).reduce((a, r) => a + r.size, 0);
    result.fontBytes = resources.filter((r) => /font/.test(r.type) || /\.(woff2?|otf|ttf)(\?|$)/.test(r.url)).reduce((a, r) => a + r.size, 0);
    result.requests = resources.length;
    Object.assign(result, evalData);
    result.ok = true;
  } catch (error) {
    result.error = String(error?.message || error).slice(0, 200);
  } finally {
    await context.close();
  }

  console.log(`[${index}] ${entry.title} → ${result.ok ? 'ok' : 'FAIL ' + result.error} ${result.tech ? result.tech.join(',') : ''}`);

  return result;
}

async function main() {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
  const entriesPath = join(OUT, 'entries.json');
  let entries;

  if (existsSync(entriesPath)) {
    entries = JSON.parse(readFileSync(entriesPath, 'utf8'));
    console.log(`entries.json 재사용: ${entries.length}건`);
  } else {
    const page = await (await browser.newContext({ userAgent: UA })).newPage();
    const listed = [];

    for (let p = 1; p <= PAGES; p++) {
      const rows = await crawlList(page, p);
      console.log(`list page ${p}: ${rows.length}`);
      listed.push(...rows.map((r) => ({ ...r, page: p })));
    }

    const unique = [...new Map(listed.map((e) => [e.id, e])).values()];
    entries = [];

    for (const [i, e] of unique.entries()) {
      try {
        entries.push(await crawlDetail(page, e));
        console.log(`detail ${i + 1}/${unique.length}: ${e.title} ${entries.at(-1).finalScore ?? '-'} → ${entries.at(-1).url}`);
      } catch (error) {
        entries.push({ ...e, error: String(error.message).slice(0, 120) });
      }
    }

    await page.context().close();
    writeFileSync(entriesPath, JSON.stringify(entries, null, 2));
  }

  const sitesPath = join(OUT, 'sites.json');
  const done = existsSync(sitesPath) ? JSON.parse(readFileSync(sitesPath, 'utf8')) : [];
  const doneIds = new Set(done.filter((s) => s.ok).map((s) => s.id));
  const queue = entries.filter((e) => !doneIds.has(e.id));
  const results = [...done.filter((s) => s.ok)];
  let cursor = 0;

  const worker = async () => {
    while (cursor < queue.length) {
      const index = cursor++;
      const r = await visitSite(browser, queue[index], index + 1);
      results.push(r);
      writeFileSync(sitesPath, JSON.stringify(results, null, 2));
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  await browser.close();
  console.log(`done: ${results.filter((r) => r.ok).length}/${entries.length} ok → ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
