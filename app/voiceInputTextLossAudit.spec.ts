import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * 검증 사이클 (감사 대상: 온보딩) — BaseChat.tsx의 recognition.onresult가 이번 인식 세션의
 * transcript만으로 textarea 값을 덮어써서, 마이크를 켜기 전에 직접 타이핑해둔 텍스트가
 * 첫 인식 결과가 들어오는 순간 통째로 사라지던 문제. startListening 시점의 입력값을
 * voiceBaseTextRef에 저장해두고 onresult에서 그 앞에 이어붙이도록 수정.
 * OVERNIGHT5_PROGRESS.md 해당 사이클 기록 참고.
 */
describe('BaseChat.tsx 음성 입력이 기존에 타이핑된 텍스트를 지우지 않는다', () => {
  const source = readFileSync(join(__dirname, 'components/chat/BaseChat.tsx'), 'utf-8');

  it('startListening이 마이크를 켜는 시점의 input 값을 voiceBaseTextRef에 저장한다', () => {
    expect(source).toContain("voiceBaseTextRef.current = input ? `${input} ` : '';");
  });

  it('recognition.onresult가 voiceBaseTextRef.current를 transcript 앞에 이어붙인다', () => {
    expect(source).toContain('target: { value: voiceBaseTextRef.current + transcript }');
  });

  it('메시지 전송 시 voiceBaseTextRef도 함께 초기화된다', () => {
    expect(source).toContain("voiceBaseTextRef.current = '';");
  });
});
