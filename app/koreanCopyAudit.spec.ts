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

  it('Menu.client.tsx: 같은 채팅 목록을 가리키는 라벨이 "채팅"과 "대화"로 갈리지 않고 "대화"로 통일돼 있다', () => {
    const source = readFileSync(join(__dirname, 'components/sidebar/Menu.client.tsx'), 'utf-8');
    expect(source).not.toContain('채팅 검색');
    expect(source).not.toContain('내 채팅');
    expect(source).toContain('대화 검색...');
    expect(source).toContain('내 대화');
  });

  it('BaseChat.tsx: 랜딩 3단계 안내 제목이 조건절(말하면)이 아니라 다른 두 단계와 같은 평서형이다', () => {
    const source = readFileSync(join(__dirname, 'components/chat/BaseChat.tsx'), 'utf-8');
    expect(source).not.toContain("title: '말하면'");
    expect(source).toContain("title: '말해요'");
  });
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
