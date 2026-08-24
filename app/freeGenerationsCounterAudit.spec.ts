import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Phase 2 검증 사이클 (감사 대상: 요금제/결제, 2회차) — BaseChat.tsx의 무료 생성 남은 횟수
 * 표시가 getGenerationsRemaining()의 실패(로그인 계정은 Supabase RPC 에러 시 throw)를
 * 잡지 않아, 초기값 0이 그대로 남아 "무료 체험을 다 썼어요"로 잘못 표시되던 문제.
 * 실제로는 남은 횟수를 모르는 상태(일시적 네트워크 오류 등)인데 소진됐다고 오인시킴.
 * OVERNIGHT5_PROGRESS.md 사이클 21 기록 참고.
 */
describe('요금제/결제 — 무료 생성 카운터 로딩 실패 처리', () => {
  const baseChatSource = readFileSync(join(__dirname, 'components/chat/BaseChat.tsx'), 'utf-8');

  it('getGenerationsRemaining() 호출에 .catch()가 붙어 있다', () => {
    const callIndex = baseChatSource.indexOf('getGenerationsRemaining()');
    expect(callIndex).toBeGreaterThan(-1);

    const afterCall = baseChatSource.slice(callIndex, callIndex + 400);
    expect(afterCall).toContain('.catch(');
  });

  it('freeGenerationsRemaining 초기값은 "모름"을 나타내는 null이지 0이 아니다', () => {
    expect(baseChatSource).toContain('useState<number | null>(null)');
  });

  it('freeGenerationsRemaining이 null(아직 모름)이면 "무료 체험을 다 썼어요" 안내를 렌더링하지 않는다', () => {
    const guardIndex = baseChatSource.indexOf('freeGenerationsRemaining !== null &&');
    const exhaustedIndex = baseChatSource.indexOf('무료 체험을 다 썼어요');

    expect(guardIndex).toBeGreaterThan(-1);
    expect(exhaustedIndex).toBeGreaterThan(guardIndex);
  });
});
