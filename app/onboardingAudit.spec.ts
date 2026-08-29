import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Phase 2 검증 사이클 (감사 대상: 온보딩) — PromptClarification/BaseChat/ChatBox에서
 * 발견된 버그들. OVERNIGHT5_PROGRESS.md 해당 사이클 기록 참고.
 */
describe('온보딩 흐름 버그 수정', () => {
  const chatBoxSource = readFileSync(join(__dirname, 'components/chat/ChatBox.tsx'), 'utf-8');
  const clarificationSource = readFileSync(join(__dirname, 'components/chat/PromptClarification.tsx'), 'utf-8');
  const chatClientSource = readFileSync(join(__dirname, 'components/chat/Chat.client.tsx'), 'utf-8');

  it('ChatBox.tsx 전송 버튼이 공백만 입력해도 비활성화된다 (input.length가 아닌 trim 기준)', () => {
    expect(chatBoxSource).not.toMatch(/!props\.isStreaming && props\.input\.length === 0 && props\.uploadedFiles/);
    expect(chatBoxSource).toContain(
      '(!props.isStreaming && props.input.trim().length === 0 && props.uploadedFiles.length === 0)',
    );
  });

  it('PromptClarification.tsx가 onComplete를 중복 호출하지 않도록 completedRef로 막는다', () => {
    expect(clarificationSource).toContain('completedRef');
    expect(clarificationSource).toContain('const handleSkip = () => completeOnce(initialPrompt, EMPTY_DIRECTIVES);');
    expect(clarificationSource).toContain(
      'onClick={() => completeOnce(finalPrompt.trim() || initialPrompt, directives)}',
    );
  });

  it('PromptClarification.tsx의 "바로 만들기"/"직접 입력할게요" 버튼이 최소 44px 터치 타겟을 갖는다', () => {
    expect(clarificationSource).toMatch(/onClick=\{handleSkip\}\s*\n\s*className="min-h-11/);
    expect(clarificationSource).toMatch(/onClick=\{\(\) => setShowCustomInput\(true\)\}\s*\n\s*className="min-h-11/);
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
