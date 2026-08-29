import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Phase 2 검증 사이클 (감사 대상: 요금제/결제, 2회차) — 무료 생성 남은 횟수 표시가
 * getGenerationsRemaining()의 실패(로그인 계정은 Supabase RPC 에러 시 throw)를 잡지 않아,
 * 초기값 0이 그대로 남아 "무료 체험을 다 썼어요"로 잘못 표시되던 문제. 실제로는 남은 횟수를
 * 모르는 상태(일시적 네트워크 오류 등)인데 소진됐다고 오인시킴. OVERNIGHT5_PROGRESS.md 사이클
 * 21 기록 참고.
 *
 * 채팅 홈 화면/사이드바 재설계(코랄레드 브랜드 정리)로 이 카운터는 BaseChat.tsx에서
 * components/sidebar/QuotaBar.tsx로 옮겨졌다 — 안전장치(에러 무시, null=모름 초기값,
 * null일 때 렌더링 안 함)는 그대로.
 */
describe('요금제/결제 — 무료 생성 카운터 로딩 실패 처리', () => {
  const quotaBarSource = readFileSync(join(__dirname, 'components/sidebar/QuotaBar.tsx'), 'utf-8');

  it('getGenerationsRemaining() 호출에 .catch()가 붙어 있다', () => {
    const callIndex = quotaBarSource.indexOf('getGenerationsRemaining()');
    expect(callIndex).toBeGreaterThan(-1);

    const afterCall = quotaBarSource.slice(callIndex, callIndex + 400);
    expect(afterCall).toContain('.catch(');
  });

  it('remaining 초기값은 "모름"을 나타내는 null이지 0이 아니다', () => {
    expect(quotaBarSource).toContain('useState<number | null>(null)');
  });

  it('remaining이 null(아직 모름)이면 "무료 체험을 다 썼어요" 안내를 렌더링하지 않는다', () => {
    const guardIndex = quotaBarSource.indexOf('if (remaining === null)');
    const exhaustedIndex = quotaBarSource.indexOf('무료 체험을 다 썼어요');

    expect(guardIndex).toBeGreaterThan(-1);
    expect(exhaustedIndex).toBeGreaterThan(guardIndex);
  });
});
