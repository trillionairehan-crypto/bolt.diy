import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Phase 2 검증 사이클 (감사 대상: 한국어 문구, 2회차) — 설정 > 프로필 탭(ProfileTab.tsx)의
 * 라벨/placeholder/토스트가 전부 영어로 하드코딩돼 있던 문제.
 * OVERNIGHT5_PROGRESS.md 해당 사이클 기록 참고.
 */
describe('ProfileTab — 라벨/placeholder/토스트 문구가 한국어다', () => {
  const source = readFileSync(join(__dirname, 'components/@settings/tabs/profile/ProfileTab.tsx'), 'utf-8');

  it('영어 하드코딩 문구가 남아있지 않다 (JSX 주석 제외)', () => {
    expect(source).not.toContain('>Profile Picture<');
    expect(source).not.toContain('Upload a profile picture or avatar');
    expect(source).not.toContain('>Username<');
    expect(source).not.toContain('Enter your username');
    expect(source).not.toContain('>Bio<');
    expect(source).not.toContain('Tell us about yourself');
    expect(source).not.toContain('Profile picture updated');
    expect(source).not.toContain('Failed to update profile picture');
    expect(source).not.toContain('updated`)');
  });

  it('한국어 라벨/토스트로 번역돼 있다', () => {
    expect(source).toContain('프로필 사진');
    expect(source).toContain('사용자 이름');
    expect(source).toContain('프로필 사진이 업데이트됐어요');
    expect(source).toContain('프로필 사진을 업데이트하지 못했어요');
  });

  /*
   * 설정·알림·프로필 라운드: "소개"(bio) 필드는 SaaS 계정에 불필요하다는 요청으로 완전히
   * 제거됐다(이니셜 아바타 + 이메일 읽기 전용 필드로 대체) — 더 이상 감사할 대상이 아님.
   */
});
