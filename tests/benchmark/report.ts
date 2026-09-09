/**
 * tests/benchmark/results/<날짜>/all-records.json을 읽어
 *   - tests/benchmark/results/<날짜>.md (행=작업종류×모델, 열=평균원가·평균초·검사건수·자동수정률)
 *   - tests/benchmark/results/<날짜>/gallery.html (모델별 결과물 나란히 — 스크린샷 대신 코드/기계검사 요약)
 * 을 만든다. 스크린샷은 이 환경에 브라우저 자동화가 없어서 못 찍는다 — HTML은 대신 각 실행의
 * 파일 목록·기계검사 결과·응답 텍스트 요약을 모델별로 나란히 보여준다.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const DATE_STR = process.argv[2] ?? new Date().toISOString().slice(0, 10);
const RUN_DIR = path.resolve('tests/benchmark/results', DATE_STR);
const RECORDS_DIR = path.join(RUN_DIR, 'records');

interface RunRecord {
  category: 'first_gen' | 'normal_edit' | 'light_edit' | 'blocked_autofix';
  caseId: string;
  model: string;
  task: string;
  promptTokens: number;
  completionTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costKrw: number;
  elapsedSec: number;
  mechanicalFindingsCount: number;
  autoFixedCount: number;
  httpStatus: number;
  errorText: string | null;
  fileCount: number;
  recordFile: string;
}

const records: RunRecord[] = JSON.parse(readFileSync(path.join(RUN_DIR, 'all-records.json'), 'utf-8'));

const CATEGORY_LABEL: Record<RunRecord['category'], string> = {
  first_gen: '첫 생성',
  normal_edit: '일반 수정',
  light_edit: '가벼운 수정',
  blocked_autofix: '막힌 자동수정',
};

const CATEGORY_ORDER: RunRecord['category'][] = ['first_gen', 'normal_edit', 'light_edit', 'blocked_autofix'];
const MODELS = Array.from(new Set(records.map((r) => r.model))).sort();

function avg(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

function fmtKrw(n: number): string {
  return Math.round(n).toLocaleString('ko-KR') + '원';
}

// --- 마크다운 표 ---

const mdLines: string[] = [];
mdLines.push(`# 모델 벤치마크 결과 — ${DATE_STR}`, '');
mdLines.push(
  '작업종류당 모델별 평균. 표본이 케이스당 1건씩이라 "평균"은 사실상 해당 1건의 값(재실행 시 변동 가능) — 참고용.',
  '',
);
mdLines.push('| 작업종류 | 모델 | 평균원가 | 평균초 | 검사건수 | 자동수정률 | 실패 |');
mdLines.push('|---|---|---|---|---|---|---|');

for (const category of CATEGORY_ORDER) {
  for (const model of MODELS) {
    const subset = records.filter((r) => r.category === category && r.model === model);

    if (subset.length === 0) {
      continue;
    }

    const avgCost = avg(subset.map((r) => r.costKrw));
    const avgSec = avg(subset.map((r) => r.elapsedSec));
    const avgFindings = avg(subset.map((r) => r.mechanicalFindingsCount));
    const autoFixRate =
      subset.reduce((a, r) => a + r.autoFixedCount, 0) /
      Math.max(
        subset.reduce((a, r) => a + r.mechanicalFindingsCount, 0),
        1,
      );
    const failures = subset.filter((r) => r.httpStatus !== 200 || r.errorText).length;

    mdLines.push(
      `| ${CATEGORY_LABEL[category]} | ${model} | ${fmtKrw(avgCost)} | ${avgSec.toFixed(1)}초 | ${avgFindings.toFixed(1)}건 | ${(autoFixRate * 100).toFixed(0)}% | ${failures > 0 ? `${failures}/${subset.length}` : '-'} |`,
    );
  }
}

mdLines.push('', '## 전체 합계', '');
mdLines.push('| 모델 | 총원가 | 총소요시간 | 총 케이스 | 실패 |');
mdLines.push('|---|---|---|---|---|');

for (const model of MODELS) {
  const subset = records.filter((r) => r.model === model);
  const totalCost = subset.reduce((a, r) => a + r.costKrw, 0);
  const totalSec = subset.reduce((a, r) => a + r.elapsedSec, 0);
  const failures = subset.filter((r) => r.httpStatus !== 200 || r.errorText).length;
  mdLines.push(
    `| ${model} | ${fmtKrw(totalCost)} | ${(totalSec / 60).toFixed(1)}분 | ${subset.length} | ${failures > 0 ? failures : '-'} |`,
  );
}

mdLines.push(
  '',
  '## 참고',
  '',
  '- 캐시 write/read 단가: Fable 5.1은 문서에 명시된 값($12.5 / $0.25 per MTok), Opus 5·Sonnet 5는 Anthropic 일반 공식(1.25배/0.1배)을 가정 — 실제와 다를 수 있음.',
  '- Opus 5/Sonnet 5는 이 코드베이스가 `thinking: disabled`를 강제하고 있어(NO_THINKING_MODELS, app/lib/.server/llm/constants.ts) 두 모델 다 익스텐디드 씽킹 없이 응답한 결과다 — Fable 5.1은 강제 대상이 아니라 API 기본값(effort=high, adaptive thinking)대로 돌았다. 세 모델이 "생각 유무" 자체가 다른 조건에서 비교된다는 뜻 — 판정 시 감안 필요.',
  '- 스크린샷은 이 환경에 브라우저 자동화가 없어서 못 찍었다 — gallery.html은 대신 응답 텍스트/파일 목록/기계검사 결과를 모델별로 나란히 보여준다.',
  '',
);

writeFileSync(path.resolve('tests/benchmark/results', `${DATE_STR}.md`), mdLines.join('\n'));

// --- HTML 갤러리 (스크린샷 대체) ---

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function loadFull(recordFile: string): any {
  return JSON.parse(readFileSync(path.join(RECORDS_DIR, recordFile), 'utf-8'));
}

const caseIds = Array.from(new Set(records.map((r) => `${r.category}:${r.caseId}`)));

const htmlParts: string[] = [];
htmlParts.push(`<!doctype html><html lang="ko"><head><meta charset="utf-8">
<title>벤치마크 갤러리 ${DATE_STR}</title>
<style>
  body { font-family: -apple-system, sans-serif; background: #fbf5ee; color: #1a1a1a; margin: 0; padding: 24px; }
  h1 { font-size: 20px; }
  .case { margin-bottom: 40px; border-top: 2px solid #1a1a1a; padding-top: 12px; }
  .case h2 { font-size: 15px; margin: 0 0 12px; }
  .row { display: grid; grid-template-columns: repeat(${MODELS.length}, 1fr); gap: 12px; }
  .col { border: 1px solid #efe4d6; border-radius: 10px; padding: 12px; background: #fff; min-width: 0; }
  .col h3 { font-size: 13px; margin: 0 0 8px; color: #ff5330; }
  .meta { font-size: 11px; color: #6e645b; margin-bottom: 8px; }
  .files { font-size: 11px; margin-bottom: 8px; }
  .text { font-size: 11px; white-space: pre-wrap; max-height: 220px; overflow: auto; background: #fbf5ee; padding: 8px; border-radius: 6px; }
  .err { color: #b8391e; font-weight: 600; }
</style></head><body>
<h1>모델 벤치마크 갤러리 — ${DATE_STR}</h1>
<p style="font-size:12px;color:#6e645b">스크린샷 없음(브라우저 자동화 미설치) — 응답 텍스트/파일/기계검사 결과로 대신 비교.</p>
`);

for (const caseKey of caseIds) {
  const [category, caseId] = caseKey.split(':');
  const sample = records.find((r) => r.category === category && r.caseId === caseId);

  if (!sample) {
    continue;
  }

  htmlParts.push(
    `<div class="case"><h2>${CATEGORY_LABEL[category as RunRecord['category']]} — ${escapeHtml(sample.task)}</h2><div class="row">`,
  );

  for (const model of MODELS) {
    const rec = records.find((r) => r.category === category && r.caseId === caseId && r.model === model);

    if (!rec) {
      htmlParts.push(`<div class="col"><h3>${model}</h3><p>결과 없음</p></div>`);
      continue;
    }

    const full = loadFull(rec.recordFile);
    const fileList = Object.keys(full.files ?? {}).slice(0, 15);

    htmlParts.push(`<div class="col">
      <h3>${model}</h3>
      <div class="meta">${rec.elapsedSec}초 · ${fmtKrw(rec.costKrw)} · 기계검사 ${rec.mechanicalFindingsCount}건(자동수정 ${rec.autoFixedCount})</div>
      ${rec.errorText ? `<div class="err">에러: ${escapeHtml(rec.errorText.slice(0, 300))}</div>` : ''}
      <div class="files">파일 ${rec.fileCount}개${fileList.length ? ': ' + fileList.map((f) => escapeHtml(f.replace('/home/project/', ''))).join(', ') : ''}</div>
      <div class="text">${escapeHtml((rec.errorText ? '' : full.responseText || '').slice(0, 1500))}</div>
    </div>`);
  }

  htmlParts.push(`</div></div>`);
}

htmlParts.push(`</body></html>`);

const galleryPath = path.join(RUN_DIR, 'gallery.html');
writeFileSync(galleryPath, htmlParts.join('\n'));

console.log('마크다운 표:', path.resolve('tests/benchmark/results', `${DATE_STR}.md`));
console.log('HTML 갤러리:', galleryPath);
