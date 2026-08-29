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
   * 채팅 홈 화면/사이드바 재설계로 사이드바는 "대화" 목록이 아니라 "앱"(포크/복제 계보로 묶인
   * 대화 그룹) 목록이 됐다 — "채팅"/"대화" 두 동의어가 같은 개념을 가리키며 갈리던 예전 문제와
   * 달리, 지금은 "앱"(그룹)과 "대화"(그룹 안 개별 항목)가 서로 다른 개념이라 함께 쓰여도 된다.
   * 검색창/그룹 라벨이 새 "앱" 어휘로 일관돼 있는지만 확인.
   */
  it('Menu.client.tsx: 앱 목록 검색이 "채팅 검색"이 아니라 "앱 검색"으로 일관돼 있다', () => {
    const source = readFileSync(join(__dirname, 'components/sidebar/Menu.client.tsx'), 'utf-8');
    expect(source).not.toContain('채팅 검색');
    expect(source).not.toContain('내 채팅');
    expect(source).toContain('앱 검색...');
  });

  // BaseChat.tsx의 랜딩 3단계 안내 섹션은 채팅 홈 화면 재설계로 통째로 삭제됐다 — 더 이상 존재하지 않음.
});

describe('한국어 문구 감사 — 사이클 47', () => {
  it('AvatarDropdown.tsx: 프로필/설정 메뉴 항목이 영어("Edit Profile"/"Settings")가 아니라 한국어다', () => {
    const source = readFileSync(join(__dirname, 'components/@settings/core/AvatarDropdown.tsx'), 'utf-8');
    expect(source).not.toContain('Edit Profile');
    expect(source).not.toContain('>Settings<');
    expect(source).toContain('프로필 수정');
  });

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
