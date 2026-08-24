import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Phase 2 검증 사이클 (감사 대상: 요금제/결제) — BaseChat.tsx의 무료 생성 잔여 안내 문구가
 * 로그인 계정도 무조건 "무료 체험"(게스트 전용 용어, freeTrial.ts 참고)으로 표시하던 문제.
 * Chat.client.tsx의 notifyGenerationLimitReached는 이미 게스트/계정을 구분하는데 이 배지만
 * 구분이 없었음. OVERNIGHT5_PROGRESS.md 해당 사이클 기록 참고.
 */
describe('요금제/결제 — 무료 생성 잔여 안내 문구', () => {
  const baseChatSource = readFileSync(join(__dirname, 'components/chat/BaseChat.tsx'), 'utf-8');

  it('BaseChat.tsx 잔여 횟수 안내가 로그인 계정과 게스트를 구분한다', () => {
    expect(baseChatSource).toContain("{authUser ? '무료 생성' : '무료 체험'} {freeGenerationsRemaining}회 남았어요");
  });

  it('BaseChat.tsx 소진 안내가 로그인 계정과 게스트를 구분한다 (Chat.client.tsx 토스트 문구와 동일)', () => {
    expect(baseChatSource).toContain(
      "{authUser ? '무료 생성 횟수를 모두 사용했어요' : '무료 체험을 다 썼어요'}. 계속하려면",
    );
  });
});
