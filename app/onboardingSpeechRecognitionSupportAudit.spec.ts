import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Phase 2 검증 사이클 (감사 대상: 온보딩, 4회차) — 음성 입력(마이크) 버튼이 SpeechRecognition API를
 * 지원하지 않는 브라우저(예: Firefox)에서도 항상 활성화 상태로 렌더되던 버그. BaseChat.tsx는
 * 지원 브라우저에서만 recognition 인스턴스를 만들어 startListening/stopListening을 no-op으로
 * 만들었지만, 버튼 자체는 props.isStreaming 여부로만 disabled가 결정돼 있어 미지원 브라우저의
 * 첫 방문자가 랜딩 화면에서 마이크 아이콘을 눌러도 아무 피드백 없이 아무 일도 일어나지 않았음.
 * OVERNIGHT5_PROGRESS.md 해당 사이클 기록 참고.
 */
describe('음성 입력 버튼이 SpeechRecognition 미지원 브라우저에서 비활성화된다', () => {
  it('ChatBox.tsx가 speechRecognitionSupported=false일 때 SpeechRecognitionButton을 비활성화한다', () => {
    const source = readFileSync(join(__dirname, 'components/chat/ChatBox.tsx'), 'utf-8');
    expect(source).toContain('speechRecognitionSupported: boolean');
    expect(source).toContain('disabled={props.isStreaming || !props.speechRecognitionSupported}');
  });

  it('BaseChat.tsx가 recognition 인스턴스 존재 여부를 speechRecognitionSupported로 전달한다', () => {
    const source = readFileSync(join(__dirname, 'components/chat/BaseChat.tsx'), 'utf-8');
    expect(source).toContain('speechRecognitionSupported={recognition !== null}');
  });
});
