import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Phase 2 검증 사이클 (감사 대상: 요금제/결제) — 무료 생성 잔여 안내 문구가 로그인 계정도
 * 무조건 "무료 체험"(게스트 전용 용어, freeTrial.ts 참고)으로 표시하던 문제. Chat.client.tsx의
 * notifyGenerationLimitReached는 이미 게스트/계정을 구분하는데 이 배지만 구분이 없었음.
 * OVERNIGHT5_PROGRESS.md 해당 사이클 기록 참고.
 *
 * 채팅 홈 화면/사이드바 재설계(코랄레드 브랜드 정리)로 이 안내는 BaseChat.tsx에서
 * components/sidebar/QuotaBar.tsx로 옮겨졌다 — 문구/구분 로직은 그대로.
 *
 * v1 미터링 정리(2026-09-07)로 "OO회 중 OO회 사용"(한도 기반 바 표시)는 죽은 코드가 됐다 —
 * v2 계정 RPC는 한도 없이 remaining만 주기 때문에 limit이 항상 null이라 그 분기가 아예 안
 * 타졌다. "N회 남았어요" 단일 문구로 정리하면서 이 감사가 지키려던 것(계정/게스트 문구 구분)은
 * 그대로 유지했다.
 */
describe('요금제/결제 — 무료 생성 잔여 안내 문구', () => {
  const quotaBarSource = readFileSync(join(__dirname, 'components/sidebar/QuotaBar.tsx'), 'utf-8');

  it('QuotaBar.tsx 잔여 안내가 로그인 계정과 게스트를 구분한다', () => {
    expect(quotaBarSource).toContain("{authUser ? '무료 생성' : '무료 체험'} {remaining}회 남았어요");
  });

  it('QuotaBar.tsx 소진 시 "요금제 보기" 링크는 문장에 섞이지 않고 별도로 붙는다', () => {
    expect(quotaBarSource).toContain('exhausted ? (');
    expect(quotaBarSource).toContain('요금제 보기');
  });
});
