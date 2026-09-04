import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Phase 2 검증 사이클 (감사 대상: 온보딩) — PromptClarification/BaseChat/ChatBox에서
 * 발견된 버그들. OVERNIGHT5_PROGRESS.md 해당 사이클 기록 참고.
 *
 * 2026-09 5문항 전면 개편(Q1~Q5) 이후 갱신: "바로 만들기" 전체 건너뛰기 버튼과 handleSkip은
 * 아예 없어졌다(Q1~Q3는 필수, Q4·Q5만 개별 건너뛰기) — 그 부분의 원래 검증(터치 타겟 44px)은
 * 지금의 Q4/Q5 "건너뛰기" 링크·격자의 "직접 입력" 셀 쪽으로 옮겨서 유지한다.
 */
describe('온보딩 흐름 버그 수정', () => {
  const chatBoxSource = readFileSync(join(__dirname, 'components/chat/ChatBox.tsx'), 'utf-8');
  const clarificationSource = readFileSync(join(__dirname, 'components/chat/PromptClarification.tsx'), 'utf-8');
  const clarificationStyleSource = readFileSync(
    join(__dirname, 'components/chat/PromptClarification.module.scss'),
    'utf-8',
  );
  const chatClientSource = readFileSync(join(__dirname, 'components/chat/Chat.client.tsx'), 'utf-8');

  it('ChatBox.tsx 전송 버튼이 공백만 입력해도 비활성화된다 (input.length가 아닌 trim 기준)', () => {
    expect(chatBoxSource).not.toMatch(/!props\.isStreaming && props\.input\.length === 0 && props\.uploadedFiles/);
    expect(chatBoxSource).toContain(
      '(!props.isStreaming && props.input.trim().length === 0 && props.uploadedFiles.length === 0)',
    );
  });

  it('PromptClarification.tsx가 "만들기" 완료를 completedRef로 중복 호출 방지한다', () => {
    expect(clarificationSource).toContain('completedRef');
    expect(clarificationSource).toContain('if (completedRef.current)');
    expect(clarificationSource).toContain('completedRef.current = true');
    expect(clarificationSource).toContain(
      'onClick={() => completeOnce(finalPrompt.trim() || initialPrompt, directives)}',
    );
  });

  it('Q4/Q5 "건너뛰기" 링크와 Q3 "직접 입력" 셀이 최소 44px 터치 타겟을 갖는다', () => {
    // .weakLink(건너뛰기)는 min-height 44px, .optionButtonCompact(격자 셀·직접 입력)는 48px.
    expect(clarificationStyleSource).toMatch(/\.weakLink\s*\{[^}]*min-height:\s*44px/);
    expect(clarificationStyleSource).toMatch(/\.optionButtonCompact\s*\{[^}]*min-height:\s*48px/);
    expect(clarificationSource).toContain('onClick={skipQ4}');
    expect(clarificationSource).toContain('onClick={skipQ5}');
  });

  it('PromptClarification.tsx 직접입력 인풋이 IME 조합 중 Enter로 오submit되지 않는다', () => {
    expect(clarificationSource).toContain("if (e.key === 'Enter' && !e.nativeEvent.isComposing)");
  });

  // BaseChat.tsx의 랜딩 3단계 안내 배지는 채팅 홈 화면 재설계로 그 섹션째 삭제됐다 — 더 이상 존재하지 않음.

  it('Chat.client.tsx의 ?prompt= 딥링크 핸들러가 공백만 있는 값은 무시한다 (다른 진입점과 동일한 trim 기준)', () => {
    expect(chatClientSource).not.toMatch(/const prompt = searchParams\.get\('prompt'\);\s*\n\s*if \(prompt\) \{/);
    expect(chatClientSource).toContain("const prompt = searchParams.get('prompt');");
    expect(chatClientSource).toMatch(
      /const prompt = searchParams\.get\('prompt'\);\s*\n\s*if \(prompt\?\.trim\(\)\) \{/,
    );
  });
});
