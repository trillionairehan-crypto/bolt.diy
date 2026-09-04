import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Phase 2 검증 사이클 (감사 대상: 온보딩, 사이클 17) — 앱별 동적 질문에서 "잘 모르겠어요"를
 * 고르면 고정 질문과 달리 "질문: 잘 모르겠어요" 같은 무의미한 줄이 그대로 생성 프롬프트에
 * 들어가던 문제. OVERNIGHT5_PROGRESS.md 사이클 17 기록 참고.
 *
 * 2026-09 5문항 전면 개편 이후 갱신: Haiku 동적 질문(app/utils/generateAppQuestions.ts)과
 * "잘 모르겠어요" 옵션 자체가 통째로 폐기됐다 — 이제 이 버그가 재현될 경로가 구조적으로 없다
 * (Q1~Q3는 필수 단일선택, Q4·Q5는 "건너뛰기" 버튼이지 "answer.optionId === 'unsure'" 같은 옵션
 * 값이 아니다). 이 파일은 그 구조적 보장 자체를 검증하는 걸로 바꿨다: Q4/Q5를 건너뛰거나 답해도
 * 그 값이 promptAdditions로 흐르는 경로 자체가 없어야 한다.
 */
describe('온보딩 — Q4/Q5는 어떤 경우에도 생성 프롬프트에 줄을 남기지 않는다', () => {
  const clarificationSource = readFileSync(join(__dirname, 'components/chat/PromptClarification.tsx'), 'utf-8');

  it('Haiku 동적 질문/"잘 모르겠어요" 경로가 더 이상 존재하지 않는다', () => {
    expect(clarificationSource).not.toContain('generateAppQuestions');
    expect(clarificationSource).not.toContain('isUnsure');
    expect(clarificationSource).not.toContain("optionId === 'unsure'");
    expect(clarificationSource).not.toContain('isDynamic');
  });

  it('buildDirectivesAndConclude는 q4/q5 값을 파라미터로도 받지 않는다 — 구조적으로 섞여 들어갈 수 없다', () => {
    const fnMatch = clarificationSource.match(/const buildDirectivesAndConclude = \(([^)]*)\)/);
    expect(fnMatch).not.toBeNull();

    const params = fnMatch![1];
    expect(params).not.toMatch(/\bq4\b/);
    expect(params).not.toMatch(/\bq5\b/);
  });

  it('skipQ4/skipQ5/confirmQ4/answerQ5 어디에도 promptAdditions/setDirectives 호출이 없다 — Q4·Q5는 DB(saveOnboardingResponse) 경로로만 흐른다', () => {
    for (const fnName of ['confirmQ4', 'skipQ4', 'skipQ5']) {
      const startIndex = clarificationSource.indexOf(`const ${fnName} =`);
      expect(startIndex, `${fnName} not found`).toBeGreaterThan(-1);

      const body = clarificationSource.slice(startIndex, startIndex + 200);
      expect(body).not.toContain('promptAdditions');
      expect(body).not.toContain('setDirectives');
    }
  });
});
