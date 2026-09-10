/* shadow-qa 결과 출력 — 콘솔 표(모델별 집계) + 두 모델 지적을 나란히 놓은 HTML 리포트 한 장. */
import { writeFileSync } from 'node:fs';
import type { NormalizedResult } from './normalize.ts';

export interface ShadowQaCase {
  caseId: string;
  label: string;
  mechanicalSummary: string;
  fileList: string[];
  desktopDataUrl: string;
  mobileDataUrl: string;
  claude: NormalizedResult;
  openai: NormalizedResult;
}

interface ModelSummary {
  model: string;
  cases: number;
  issueCount: number;
  critical: number;
  polish: number;
  unclassified: number;
  callFailed: number;
  parseError: number;
  totalCostUsd: number;
  avgLatencySec: number;
}

function summarize(model: string, results: NormalizedResult[]): ModelSummary {
  const issues = results.flatMap((r) => r.issues);

  return {
    model,
    cases: results.length,
    issueCount: issues.length,
    critical: issues.filter((i) => i.severity === 'critical').length,
    polish: issues.filter((i) => i.severity === 'polish').length,
    unclassified: issues.filter((i) => i.severity === 'unclassified').length,
    callFailed: results.filter((r) => r.verdict === 'call_failed').length,
    parseError: results.filter((r) => r.verdict === 'parse_error').length,
    totalCostUsd: Math.round(results.reduce((sum, r) => sum + r.estimatedCostUsd, 0) * 10000) / 10000,
    avgLatencySec: Math.round((results.reduce((sum, r) => sum + r.latencyMs, 0) / results.length / 100) * 10) / 10,
  };
}

export function printConsoleTable(cases: ShadowQaCase[]): void {
  const claudeSummary = summarize('claude-sonnet-5', cases.map((c) => c.claude));
  const openaiSummary = summarize(cases[0]?.openai.model ?? 'openai', cases.map((c) => c.openai));

  console.table([claudeSummary, openaiSummary]);

  console.log('\n케이스별 verdict:');
  console.table(
    cases.map((c) => ({
      case: c.caseId,
      'claude verdict': c.claude.verdict,
      'claude issues': c.claude.issues.length,
      'openai verdict': c.openai.verdict,
      'openai issues': c.openai.issues.length,
    })),
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderIssueList(result: NormalizedResult): string {
  if (result.verdict === 'call_failed') {
    return `<p class="err">호출 실패: ${escapeHtml(result.errorText ?? 'unknown')}</p>`;
  }

  if (result.verdict === 'parse_error') {
    return `<p class="err">JSON 파싱 실패</p><pre class="raw">${escapeHtml(result.rawText.slice(0, 1000))}</pre>`;
  }

  if (result.issues.length === 0) {
    return `<p class="clean">지적 없음 (clean)</p>`;
  }

  return result.issues
    .map(
      (issue) => `
      <div class="issue ${issue.severity}">
        <div class="issue-head">
          <span class="badge sev-${issue.severity}">${issue.severity}</span>
          <span class="badge conf-${issue.rawConfidence}">${issue.rawConfidence}</span>
          <span class="criterion">${escapeHtml(issue.criterion)}</span>
        </div>
        <p class="evidence">${escapeHtml(issue.evidence)}</p>
        <p class="repair">${escapeHtml(issue.repairIntent)}</p>
      </div>`,
    )
    .join('\n');
}

function renderModelMeta(result: NormalizedResult): string {
  return `<p class="meta">지연 ${result.latencyMs}ms · 입력 ${result.inputTokens}tok · 출력 ${result.outputTokens}tok · 원가 $${result.estimatedCostUsd.toFixed(4)}</p>`;
}

export function writeHtmlReport(cases: ShadowQaCase[], outPath: string): void {
  const claudeModel = cases[0]?.claude.model ?? 'claude-sonnet-5';
  const openaiModel = cases[0]?.openai.model ?? 'openai';

  const caseBlocks = cases
    .map(
      (c) => `
    <section class="case">
      <h2>${escapeHtml(c.label)} <span class="case-id">(${escapeHtml(c.caseId)})</span></h2>
      <details>
        <summary>골격 판정값 / 소스 파일 목록</summary>
        <pre class="raw">${escapeHtml(c.mechanicalSummary)}</pre>
        <p class="filelist">${c.fileList.map(escapeHtml).join(', ')}</p>
      </details>
      <div class="screenshots">
        <div><p class="shot-label">데스크톱 1280×800</p><img src="${c.desktopDataUrl}" alt="desktop" /></div>
        <div><p class="shot-label">모바일 390×844</p><img src="${c.mobileDataUrl}" alt="mobile" class="mobile" /></div>
      </div>
      <div class="side-by-side">
        <div class="col">
          <h3>${escapeHtml(claudeModel)}</h3>
          ${renderModelMeta(c.claude)}
          ${renderIssueList(c.claude)}
        </div>
        <div class="col">
          <h3>${escapeHtml(openaiModel)}</h3>
          ${renderModelMeta(c.openai)}
          ${renderIssueList(c.openai)}
        </div>
      </div>
    </section>`,
    )
    .join('\n');

  const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<title>Shadow Visual QA A/B</title>
<style>
  body { font-family: -apple-system, "Malgun Gothic", sans-serif; max-width: 1400px; margin: 0 auto; padding: 24px; background: #fafafa; color: #1a1a1a; }
  h1 { font-size: 20px; }
  .note { color: #666; font-size: 13px; margin-bottom: 24px; }
  section.case { background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 16px; margin-bottom: 24px; }
  .case-id { color: #999; font-weight: normal; font-size: 13px; }
  .screenshots { display: flex; gap: 16px; margin: 12px 0; align-items: flex-start; }
  .screenshots img { max-width: 500px; border: 1px solid #ccc; }
  .screenshots img.mobile { max-width: 200px; }
  .shot-label { font-size: 12px; color: #666; margin: 0 0 4px; }
  .side-by-side { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .col { border-left: 3px solid #eee; padding-left: 12px; }
  .meta { font-size: 12px; color: #666; }
  .issue { border: 1px solid #eee; border-radius: 6px; padding: 8px; margin-bottom: 8px; }
  .issue.critical { border-left: 4px solid #d33; }
  .issue.polish { border-left: 4px solid #e8a020; }
  .issue.unclassified { border-left: 4px solid #999; }
  .badge { display: inline-block; font-size: 11px; padding: 2px 6px; border-radius: 4px; margin-right: 4px; background: #eee; }
  .sev-critical { background: #fde; color: #a00; }
  .sev-polish { background: #ffe; color: #960; }
  .criterion { font-size: 12px; color: #444; font-weight: 600; }
  .evidence { margin: 6px 0 2px; font-size: 13px; }
  .repair { margin: 0; font-size: 12px; color: #777; }
  .clean { color: #2a7; font-size: 13px; }
  .err { color: #c22; font-size: 13px; }
  pre.raw { background: #f4f4f4; padding: 8px; font-size: 11px; overflow-x: auto; white-space: pre-wrap; }
  .filelist { font-size: 12px; color: #666; }
</style>
</head>
<body>
<h1>Shadow Visual QA A/B — claude-sonnet-5 vs ${escapeHtml(openaiModel)}</h1>
<p class="note">criterion/severity는 모델이 직접 말한 값이 아니라 issue.description을 체크리스트 키워드로 매칭해 추정한 값 — 매칭 실패 시 unclassified. 파이프라인에 배선되지 않은 측정 전용 결과이며 자동 수정 미적용.</p>
${caseBlocks}
</body>
</html>`;

  writeFileSync(outPath, html, 'utf-8');
}
