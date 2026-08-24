import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Phase 2 검증 사이클 (감사 대상: 온보딩, 사이클 17) — 앱별 동적 질문에서 "잘 모르겠어요"를
 * 고르면 고정 질문과 달리 "질문: 잘 모르겠어요" 같은 무의미한 줄이 그대로 생성 프롬프트에
 * 들어가던 문제. OVERNIGHT5_PROGRESS.md 사이클 17 기록 참고.
 */
describe('온보딩 — 동적 질문 "잘 모르겠어요" 답변 처리', () => {
  const clarificationSource = readFileSync(join(__dirname, 'components/chat/PromptClarification.tsx'), 'utf-8');

  it("optionId가 'unsure'면 promptAdditions에 아무것도 추가하지 않고 빈 객체를 반환한다", () => {
    const unsureCheckIndex = clarificationSource.indexOf("answer.optionId === 'unsure'");
    const dynamicBranchIndex = clarificationSource.indexOf("answer.optionId === 'custom' || question.isDynamic");

    expect(unsureCheckIndex).toBeGreaterThan(-1);
    expect(dynamicBranchIndex).toBeGreaterThan(-1);

    // 'unsure' 체크가 custom/isDynamic 분기보다 먼저 와야 동적 질문에도 적용된다.
    expect(unsureCheckIndex).toBeLessThan(dynamicBranchIndex);

    const betweenChecks = clarificationSource.slice(unsureCheckIndex, dynamicBranchIndex);
    expect(betweenChecks).toContain('return {};');
  });
});
