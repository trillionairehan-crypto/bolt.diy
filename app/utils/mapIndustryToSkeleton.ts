import type { ProviderInfo } from '~/types/model';
import { PROVIDER_LIST } from './constants';
import { Q3_GRID, SKELETON_NAMES, type SkeletonId } from '~/lib/onboarding/question-bank';

/**
 * Q3(어떤 일을 하시나요) "직접 입력" 경로 전용 매핑 — 사용자가 격자 10개에 없는 업종을 타이핑하면,
 * 이 함수가 그 텍스트를 (a) 격자 항목 중 하나(표시용 — "기타"로 남을 수도 있음), (b) 골격 7종 중
 * 하나(생성 지시문용, 없으면 자유 생성)로 매핑한다.
 *
 * 이제는 폐기된 generateAppQuestions.ts(0~2개 앱별 질문을 만들던 Haiku 호출)와 같은 /api/llmcall
 * 경로·타임아웃·JSON 파싱 패턴을 그대로 따르되, 이 함수는 질문을 만드는 게 아니라 이미 받은 답 하나를
 * 분류만 한다.
 */

export const INDUSTRY_MAPPING_MODEL = 'claude-haiku-4-5';
export const INDUSTRY_MAPPING_PROVIDER_NAME = 'Anthropic';

const TIMEOUT_MS = 3000;

export interface IndustryMappingResult {
  /** Q3_GRID의 id 중 하나, 또는 매핑 실패/애매하면 null("기타"로 표시). */
  gridItemId: string | null;

  /** 골격 1~7, 또는 매핑 실패/자유 생성이 맞으면 null. */
  skeleton: SkeletonId | null;
}

const NO_MATCH: IndustryMappingResult = { gridItemId: null, skeleton: null };

const GRID_ITEMS_LIST = Q3_GRID.map((item) => `${item.id}: ${item.label}`).join('\n');
const SKELETON_LIST = (Object.entries(SKELETON_NAMES) as [string, string][])
  .map(([id, name]) => `${id}: ${name}`)
  .join('\n');

const systemPrompt = `사용자가 "어떤 일을 하시나요?" 질문에 직접 입력한 업종 텍스트를 아래 두 목록에
매핑하는 분류기입니다.

격자 항목(id: 이름):
${GRID_ITEMS_LIST}

골격(id: 이름) — 이 업종의 사람이 가장 흔히 만들고 싶어할 앱 유형:
${SKELETON_LIST}

규칙:
- 격자 항목 중 명확히 가까운 게 있으면 그 id를 쓰세요. 애매하거나 안 맞으면 gridItemId를 null로
  하세요.
- 골격도 마찬가지로 명확할 때만 숫자를 쓰고, 애매하면 skeleton을 null로 하세요(자유 생성이 낫습니다).
- 정확히 이 형태의 JSON 객체 하나만 응답하세요, 마크다운 코드펜스나 설명 없이:
{ "gridItemId": "<id 또는 null>", "skeleton": <1~7 정수 또는 null> }`;

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);

  return fenced ? fenced[1].trim() : trimmed;
}

function isValidResult(value: unknown): value is { gridItemId: string | null; skeleton: number | null } {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const obj = value as Record<string, unknown>;
  const gridOk = obj.gridItemId === null || typeof obj.gridItemId === 'string';
  const skeletonOk =
    obj.skeleton === null || (typeof obj.skeleton === 'number' && obj.skeleton >= 1 && obj.skeleton <= 7);

  return gridOk && skeletonOk;
}

export async function mapIndustryToSkeleton(rawInput: string): Promise<IndustryMappingResult> {
  const provider = PROVIDER_LIST.find((p) => p.name === INDUSTRY_MAPPING_PROVIDER_NAME) as ProviderInfo | undefined;

  if (!provider || !rawInput.trim()) {
    return NO_MATCH;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch('/api/llmcall', {
      method: 'POST',
      signal: controller.signal,
      body: JSON.stringify({
        message: rawInput,
        model: INDUSTRY_MAPPING_MODEL,
        provider,
        system: systemPrompt,
      }),
    });

    if (!response.ok) {
      return NO_MATCH;
    }

    const { text } = (await response.json()) as { text: string };
    const parsed: unknown = JSON.parse(stripCodeFences(text));

    if (!isValidResult(parsed)) {
      return NO_MATCH;
    }

    const gridItemId =
      parsed.gridItemId && Q3_GRID.some((item) => item.id === parsed.gridItemId) ? parsed.gridItemId : null;
    const skeleton = parsed.skeleton as SkeletonId | null;

    return { gridItemId, skeleton };
  } catch {
    return NO_MATCH;
  } finally {
    clearTimeout(timeoutId);
  }
}
