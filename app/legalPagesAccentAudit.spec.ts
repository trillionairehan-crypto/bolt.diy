import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Phase 2 검증 사이클 (감사 대상: 다크모드) — 법률 페이지(privacy/terms/LegalPageLayout)의
 * 링크가 라이트모드 고정 코랄(#FF5330)을 하드코딩해 다크모드 --accent 값과 어긋나던 문제.
 * OVERNIGHT5_PROGRESS.md 해당 사이클 기록 참고.
 */
describe('법률 페이지 링크 색상 버그 수정', () => {
  const privacySource = readFileSync(join(__dirname, 'routes/privacy.tsx'), 'utf-8');
  const termsSource = readFileSync(join(__dirname, 'routes/terms.tsx'), 'utf-8');
  const layoutSource = readFileSync(join(__dirname, 'components/legal/LegalPageLayout.tsx'), 'utf-8');

  it('privacy.tsx 이메일 링크가 하드코딩 #FF5330 대신 var(--accent)를 쓴다', () => {
    expect(privacySource).not.toContain('text-[#FF5330]');
    expect(privacySource).toContain("style={{ color: 'var(--accent)' }}");
  });

  it('terms.tsx의 privacy 링크/연락처 이메일 링크가 하드코딩 #FF5330 대신 var(--accent)를 쓴다', () => {
    expect(termsSource).not.toContain('text-[#FF5330]');
    expect(termsSource.match(/style=\{\{ color: 'var\(--accent\)' \}\}/g)).toHaveLength(2);
  });

  it('LegalPageLayout.tsx의 "코랄레드 홈으로 돌아가기" 링크가 하드코딩 #FF5330 대신 var(--accent)를 쓴다', () => {
    expect(layoutSource).not.toContain('text-[#FF5330]');
    expect(layoutSource).toContain("style={{ color: 'var(--accent)' }}");
  });
});
