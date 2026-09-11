/**
 * Awwwards 태그 목록 크롤 — 3D 몰입 원형 연구용. 목록 페이지에서 /sites/<slug> 를 모으고 상세에서 실제 사이트 URL·스튜디오·국가·태그·점수를 뽑아
 * CSSDA 크롤과 같은 entries.json 형식으로 저장한다 → tech.mjs / motion.mjs / gate.mjs 를 그대로 돌릴 수 있다.
 *
 *   node tests/benchmark/cssda/awwwards.mjs [--tag 3d] [--pages 2] [--out tests/benchmark/awwwards-3d/2026-09-11]
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const argValue = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const TAG = argValue('--tag', '3d');
const PAGES = Number(argValue('--pages', '2'));
const OUT = argValue('--out', join('tests', 'benchmark', 'awwwards-3d', '2026-09-11'));
mkdirSync(OUT, { recursive: true });
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, userAgent: UA });
  const slugs = [];

  for (let p = 1; p <= PAGES; p++) {
    await page.goto(`https://www.awwwards.com/websites/${TAG}/?page=${p}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2500);
    const found = await page.evaluate(() => [...new Set([...document.querySelectorAll('a[href*="/sites/"]')].map((a) => a.getAttribute('href')).filter((h) => /^\/sites\/[^/?#]+$/.test(h || '')))]);
    console.log(`page ${p}: ${found.length}`);
    slugs.push(...found);
  }

  const unique = [...new Set(slugs)];
  const outPath = join(OUT, 'entries.json');
  const done = existsSync(outPath) ? JSON.parse(readFileSync(outPath, 'utf8')) : [];
  const doneIds = new Set(done.map((e) => e.id));
  const entries = [...done];

  for (const [i, slug] of unique.entries()) {
    const id = slug.replace('/sites/', '');

    if (doneIds.has(id)) continue;

    try {
      await page.goto(`https://www.awwwards.com${slug}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(2000);
      const e = await page.evaluate((id) => {
        const text = document.body.innerText.replace(/\s+/g, ' ');
        const title = (document.title || '').replace(/ - Awwwards.*$/, '').trim();
        // 실제 사이트 URL: 외부 링크 중 가장 많이 나오는 origin
        const counts = {};

        for (const a of document.querySelectorAll('a[href^="http"]')) {
          const h = a.href;

          if (/awwwards\.com|twitter|x\.com|facebook|instagram|linkedin|pinterest|youtube|vimeo|behance|dribbble|google\.|apple\.com\/app|play\.google/.test(h)) continue;

          try {
            const o = new URL(h).origin;
            counts[o] = (counts[o] || 0) + 1;
          } catch {
            /* ignore */
          }
        }

        const url = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
        const by = text.match(new RegExp(`${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} by ([^\\n]{2,60}?) (?:from|Nominee|Site of|Honorable|Developer|Mobile|Best)`, 'i'))?.[1];
        const country = text.match(/ from ([A-Z][A-Za-z ]{2,30}?)(?: |$)(?:Nominee|Site of|Honorable|Developer|Best|Vote|Save|Share|[A-Z][a-z]+ \d{1,2},)/)?.[1];
        const award = text.match(/(Site of the Day|Site of the Month|Site of the Year|Honorable Mention|Developer Award|Mobile Excellence|Nominee)/)?.[1];
        const scores = {};

        // "Design 40 Usability 30 …" 는 가중치(%), 점수는 소수점 있는 값만 ("Design 8.32")
        for (const m of text.matchAll(/\b(Design|Usability|Creativity|Content|Developer|Mobile)\s+(\d{1,2}\.\d{1,2})\b/g)) scores[m[1].toLowerCase()] = Number(m[2]);

        const overall = text.match(/\b(\d\.\d{1,2})\s*(?:\/\s*10)?\s*(?:Overall|Score)/i)?.[1] || text.match(/Overall\s*(\d\.\d{1,2})/i)?.[1];
        const tags = [...document.querySelectorAll('a[href*="/websites/"]')].map((a) => (a.textContent || '').trim().toLowerCase()).filter((t) => t && t.length < 24 && !/see all|more|websites/.test(t));

        return { id, title, url, agency: by || null, country: country || null, award: award || null, scores, finalScore: overall ? Number(overall) : null, tags: [...new Set(tags)].slice(0, 12), about: text.slice(0, 0) };
      }, id);
      e.source = `https://www.awwwards.com${slug}`;
      e.tags = e.tags.length ? e.tags : [TAG];
      entries.push(e);
      console.log(`[${i + 1}/${unique.length}] ${e.title} → ${e.url} | ${e.award} | ${JSON.stringify(e.scores)}`);
    } catch (error) {
      console.log(`[${i + 1}] ${slug} FAIL ${String(error?.message || error).slice(0, 80)}`);
    }

    writeFileSync(outPath, JSON.stringify(entries, null, 2));
  }

  await browser.close();
  console.log(`done ${entries.length} → ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
