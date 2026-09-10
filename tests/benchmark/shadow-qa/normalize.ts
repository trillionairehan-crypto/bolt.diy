/*
 * 두 모델의 원시 응답을 동일 스키마로 정규화한다. 체크리스트 시스템 프롬프트(review-checklist.ts의
 * buildVisualReviewSystemPrompt)는 그대로 두고 모델에게 { issues:[{description,element,confidence}],
 * files } 형태로 응답받는다 — 모델이 criterion(어느 체크리스트 항목인지)·severity를 직접 말하지
 * 않으므로, 이 두 필드는 issue.description을 체크리스트 항목 키워드와 매칭해 "추정"한 값이다(모델이
 * 준 값이 아님 — 리포트에 반드시 이 사실을 표시한다).
 */
import { REVIEW_CHECKLIST } from '../../../app/lib/common/prompts/review-checklist.ts';
import type { RawVisualCallResult } from './models.ts';

export interface NormalizedIssue {
  /** REVIEW_CHECKLIST에서 추정 — 모델이 직접 말한 값 아님. 매칭 실패 시 'unclassified'. */
  severity: 'critical' | 'polish' | 'unclassified';

  /** REVIEW_CHECKLIST id로 추정 — 매칭 실패 시 'unclassified'. */
  criterion: string;

  evidence: string;
  targetFiles: string[];
  repairIntent: string;

  /** 모델이 직접 준 값(요청 스키마엔 없지만 참고용으로 남김). */
  rawConfidence: 'high' | 'medium' | 'low' | 'unknown';
}

export interface NormalizedResult {
  model: string;
  verdict: 'clean' | 'flagged_low_confidence' | 'flagged_high_confidence' | 'parse_error' | 'call_failed';

  /** issues가 비었으면 'high'(자신 있게 깨끗함), 아니면 issue 중 최고 confidence. */
  confidence: 'high' | 'medium' | 'low';

  issues: NormalizedIssue[];
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  rawText: string;
  errorText?: string;
}

const KEYWORD_MAP: Array<{ id: string; keywords: string[] }> = [
  { id: 'empty-viewport-half', keywords: ['빈 영역', '빈 공간', '뷰포트', '절반'] },
  { id: 'overlap', keywords: ['겹치', '벗어나'] },
  { id: 'text-overflow', keywords: ['잘리', '넘치', '말줄임'] },
  { id: 'spacing', keywords: ['간격', '답답'] },
  { id: 'baseline-misalignment', keywords: ['기준선'] },
  { id: 'accent-overuse', keywords: ['강조색'] },
  { id: 'floating-element', keywords: ['홀로', '떠 보이', '떠보이'] },
];

function inferCriterion(description: string): { id: string; severity: 'critical' | 'polish' } | null {
  for (const { id, keywords } of KEYWORD_MAP) {
    if (keywords.some((keyword) => description.includes(keyword))) {
      const item = REVIEW_CHECKLIST.find((c) => c.id === id);

      if (item) {
        return { id, severity: item.severity };
      }
    }
  }

  return null;
}

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);

  return fenced ? fenced[1].trim() : trimmed;
}

interface RawChecklistResponse {
  issues: Array<{ description: string; element: string; confidence: string }>;
  files: Record<string, string>;
}

function isValidRawChecklistResponse(value: unknown): value is RawChecklistResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;

  return Array.isArray(record.issues);
}

export function normalizeVisualResult(
  model: string,
  raw: RawVisualCallResult,
  costPerMTok: { input: number; output: number },
): NormalizedResult {
  const estimatedCostUsd =
    (raw.inputTokens / 1_000_000) * costPerMTok.input + (raw.outputTokens / 1_000_000) * costPerMTok.output;

  if (raw.errorText || raw.httpStatus !== 200) {
    return {
      model,
      verdict: 'call_failed',
      confidence: 'low',
      issues: [],
      latencyMs: raw.latencyMs,
      inputTokens: raw.inputTokens,
      outputTokens: raw.outputTokens,
      estimatedCostUsd,
      rawText: raw.rawText,
      errorText: raw.errorText ?? `httpStatus=${raw.httpStatus}`,
    };
  }

  let parsed: unknown = null;

  try {
    parsed = JSON.parse(stripCodeFences(raw.rawText));
  } catch {
    parsed = null;
  }

  if (!isValidRawChecklistResponse(parsed)) {
    return {
      model,
      verdict: 'parse_error',
      confidence: 'low',
      issues: [],
      latencyMs: raw.latencyMs,
      inputTokens: raw.inputTokens,
      outputTokens: raw.outputTokens,
      estimatedCostUsd,
      rawText: raw.rawText,
      errorText: '모델 응답이 체크리스트 프롬프트가 지정한 JSON 스키마와 불일치',
    };
  }

  const filePaths = Object.keys(parsed.files ?? {});
  const repairIntent = filePaths.length > 0 ? `수정 제안 있음 (${filePaths.length}개 파일: ${filePaths.join(', ')})` : '수정 제안 없음(지적만)';

  const issues: NormalizedIssue[] = parsed.issues.map((issue) => {
    const inferred = inferCriterion(issue.description ?? '');
    const rawConfidence: NormalizedIssue['rawConfidence'] = ['high', 'medium', 'low'].includes(issue.confidence)
      ? (issue.confidence as 'high' | 'medium' | 'low')
      : 'unknown';

    return {
      severity: inferred?.severity ?? 'unclassified',
      criterion: inferred?.id ?? 'unclassified',
      evidence: `${issue.description ?? ''}${issue.element ? ` (요소: ${issue.element})` : ''}`,
      targetFiles: filePaths,
      repairIntent,
      rawConfidence,
    };
  });

  const hasHigh = issues.some((issue) => issue.rawConfidence === 'high');
  const hasMedium = issues.some((issue) => issue.rawConfidence === 'medium');

  const verdict: NormalizedResult['verdict'] =
    issues.length === 0 ? 'clean' : hasHigh ? 'flagged_high_confidence' : 'flagged_low_confidence';

  const confidence: NormalizedResult['confidence'] =
    issues.length === 0 ? 'high' : hasHigh ? 'high' : hasMedium ? 'medium' : 'low';

  return {
    model,
    verdict,
    confidence,
    issues,
    latencyMs: raw.latencyMs,
    inputTokens: raw.inputTokens,
    outputTokens: raw.outputTokens,
    estimatedCostUsd,
    rawText: raw.rawText,
  };
}
