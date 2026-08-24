import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Phase 2 검증 사이클 (감사 대상: 배포) — 사이클 12.
 * OVERNIGHT5_PROGRESS.md 해당 사이클 기록 참고.
 */
describe('배포 감사 — 사이클 12: GitHub/GitLab/Vercel/Netlify 배포 토스트가 영어가 아니라 한국어다', () => {
  const englishToastFragments = [
    "toast.error('Please connect",
    "toast.error('No active chat found",
    "throw new Error('No active project found",
    "throw new Error('Build failed",
    "throw new Error('Could not find build output directory",
    "'Invalid deployment response'",
    'deployment preparation completed successfully!`)',
    'deployment completed successfully!`)',
    "'GitHub deployment preparation failed'",
    "'GitLab deployment preparation failed'",
    "'Deployment failed: '",
    "throw new Error('Deployment timed out')",
  ];

  const files = [
    'components/deploy/GitHubDeploy.client.tsx',
    'components/deploy/GitLabDeploy.client.tsx',
    'components/deploy/VercelDeploy.client.tsx',
    'components/deploy/NetlifyDeploy.client.tsx',
  ];

  it.each(files)('%s: 사용자에게 보이는 토스트/에러 문구에 영어 잔재가 없다', (relativePath) => {
    const source = readFileSync(join(__dirname, relativePath), 'utf-8');

    for (const fragment of englishToastFragments) {
      expect(source).not.toContain(fragment);
    }
  });

  it('GitHubDeploy.client.tsx: 계정 연결 안내와 성공 토스트가 한국어다', () => {
    const source = readFileSync(join(__dirname, 'components/deploy/GitHubDeploy.client.tsx'), 'utf-8');
    expect(source).toContain('설정 > 연결에서 먼저 GitHub 계정을 연결해주세요.');
    expect(source).toContain('🚀 GitHub 배포 준비가 완료됐어요!');
  });

  it('GitLabDeploy.client.tsx: 계정 연결 안내와 성공 토스트가 한국어다', () => {
    const source = readFileSync(join(__dirname, 'components/deploy/GitLabDeploy.client.tsx'), 'utf-8');
    expect(source).toContain('설정 > 연결에서 먼저 GitLab 계정을 연결해주세요.');
    expect(source).toContain('🚀 GitLab 배포 준비가 완료됐어요!');
  });

  it('VercelDeploy.client.tsx: 계정 연결 안내와 성공 토스트가 한국어다', () => {
    const source = readFileSync(join(__dirname, 'components/deploy/VercelDeploy.client.tsx'), 'utf-8');
    expect(source).toContain('설정 탭에서 먼저 Vercel 계정을 연결해주세요.');
    expect(source).toContain('🚀 Vercel 배포가 끝났어요!');
  });

  it('NetlifyDeploy.client.tsx: 계정 연결 안내, 타임아웃, 성공 토스트가 한국어다', () => {
    const source = readFileSync(join(__dirname, 'components/deploy/NetlifyDeploy.client.tsx'), 'utf-8');
    expect(source).toContain('설정 탭에서 먼저 Netlify 계정을 연결해주세요.');
    expect(source).toContain('배포 시간이 초과됐어요.');
    expect(source).toContain('🚀 Netlify 배포가 끝났어요!');
  });
});
