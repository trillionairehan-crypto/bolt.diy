import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Phase 2 검증 사이클 (감사 대상: 배포) — 사이클 28.
 * OVERNIGHT5_PROGRESS.md 해당 사이클 기록 참고.
 */
describe('배포 감사 — 사이클 28: GitHub/GitLab 배포 다이얼로그가 영어가 아니라 한국어다', () => {
  const englishFragments = [
    'Deploy to GitHub',
    'Deploy to GitLab',
    'GitHub Connection Required',
    'GitLab Connection Required',
    'Repository Name',
    'Recent Repositories',
    'Search repositories...',
    'Make repository private',
    'No repositories found',
    'No matching repositories',
    'Loading repositories...',
    'Successfully pushed to GitHub',
    'Successfully pushed to GitLab',
    'Repository URL',
    'Pushed Files (',
    'View Repository',
    'Copy URL',
    'Connect GitHub Account',
    'Connect GitLab Account',
    "toast.error('GitHub authentication required')",
    "toast.error('GitLab authentication required')",
    "toast.error('Repository name is required')",
    "toast.error('Please connect your GitHub account",
    "toast.error('Please connect your GitLab account",
    "toast.success('URL copied to clipboard')",
  ];

  const files = ['components/deploy/GitHubDeploymentDialog.tsx', 'components/deploy/GitLabDeploymentDialog.tsx'];

  it.each(files)('%s: 다이얼로그에 노출되는 문구/토스트에 영어 잔재가 없다', (relativePath) => {
    const source = readFileSync(join(__dirname, relativePath), 'utf-8');

    for (const fragment of englishFragments) {
      expect(source).not.toContain(fragment);
    }
  });

  it('GitHubDeploymentDialog.tsx: 배포 버튼/제목/연결 안내가 한국어다', () => {
    const source = readFileSync(join(__dirname, 'components/deploy/GitHubDeploymentDialog.tsx'), 'utf-8');
    expect(source).toContain('GitHub에 배포');
    expect(source).toContain('GitHub 연결이 필요해요');
    expect(source).toContain('저장소 이름');
    expect(source).toContain('GitHub에 성공적으로 푸시했어요');
  });

  it('GitLabDeploymentDialog.tsx: 배포 버튼/제목/연결 안내가 한국어다', () => {
    const source = readFileSync(join(__dirname, 'components/deploy/GitLabDeploymentDialog.tsx'), 'utf-8');
    expect(source).toContain('GitLab에 배포');
    expect(source).toContain('GitLab 연결이 필요해요');
    expect(source).toContain('저장소 이름');
    expect(source).toContain('GitLab에 성공적으로 푸시했어요');
  });
});
