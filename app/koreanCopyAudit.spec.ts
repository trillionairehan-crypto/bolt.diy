import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Phase 2 검증 사이클 (감사 대상: 한국어 문구) — 문구 일관성/조사/병렬구조 버그 3건.
 * OVERNIGHT5_PROGRESS.md 해당 사이클 기록 참고.
 */
describe('한국어 문구 감사 — 사이클 8', () => {
  it('DeployButton.tsx: "GitLab로"가 아니라 받침 있는 명사에 맞는 "GitLab으로"를 쓴다', () => {
    const source = readFileSync(join(__dirname, 'components/deploy/DeployButton.tsx'), 'utf-8');
    expect(source).not.toContain('GitLab로');
    expect(source).toContain('GitLab으로 내보내기');
  });

  /*
   * Menu.client.tsx의 "앱 검색" 입력(여기서 확인하던 것)은 사이드바 디테일 라운드(2026-09-02)에서
   * "대화 검색" placeholder로 다시 도입됐다가, 사이드바 전면 재구성 라운드(같은 날 후속)에서
   * 검색·날짜 묶음·20개 제한 전체가 폐기되며 다시 완전히 제거됐다 — 검색 UI 자체가 더 이상 없어
   * 문구 일관성을 확인할 대상이 없다.
   * BaseChat.tsx의 랜딩 3단계 안내 섹션도 채팅 홈 화면 재설계로 통째로 삭제됐다 — 더 이상 존재하지 않음.
   */
});

describe('한국어 문구 감사 — 사이클 47', () => {
  /*
   * AvatarDropdown.tsx는 설정·알림·프로필 라운드에서 완전히 제거됐다 — ControlPanel.tsx 헤더의
   * 중복 계정 메뉴(사이드바 AccountMenu.tsx와 항목이 겹침)였고, 좌측 고정 탭 레이아웃으로 바뀌며
   * 더 이상 쓰이지 않아 파일째 삭제. 이 테스트가 감사하던 대상이 더 이상 존재하지 않음.
   */

  it('pricing.tsx: 메시지 개수 뒤에 단위 없이 숫자와 "메시지"가 바로 붙지 않고 "건" 단위가 있다', () => {
    const source = readFileSync(join(__dirname, 'routes/pricing.tsx'), 'utf-8');
    expect(source).not.toMatch(/\$\{plan\.messagesPerMonth[^}]*\}메시지/);
    expect(source).toContain('월 메시지 ${plan.messagesPerMonth}건');
  });

  it('guide.tsx: "1메시지씩"이 아니라 기존 관행대로 "1건씩"을 쓴다', () => {
    const source = readFileSync(join(__dirname, 'routes/guide.tsx'), 'utf-8');
    expect(source).not.toContain('1메시지씩');
    expect(source).toContain('1건씩');
  });
});
