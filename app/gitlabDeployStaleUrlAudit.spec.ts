import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Phase 2 검증 사이클 (감사 대상: 배포, 사이클 20) — GitLab 배포 성공 후 localStorage에
 * 저장되는 저장소 URL이 방금 계산한 값이 아니라 setCreatedRepoUrl로 예약만 해둔(아직 커밋 안 된)
 * state 클로저의 이전 값을 읽고 있던 문제. 첫 배포면 빈 문자열, 재배포면 이전 저장소의 URL이
 * `gitlab-repo-{chatId}` 키로 영구 저장됨. GitHub 쪽(GitHubDeploymentDialog.tsx)은 URL을
 * 인라인으로 다시 계산해서 이 문제가 없었음 — GitLab만 겪던 회귀. OVERNIGHT5_PROGRESS.md 사이클 20 기록 참고.
 */
describe('GitLab 배포 — localStorage에 저장하는 저장소 URL', () => {
  const source = readFileSync(join(__dirname, 'components/deploy/GitLabDeploymentDialog.tsx'), 'utf-8');

  it('localStorage.setItem에는 더 이상 state 클로저 값(createdRepoUrl)을 쓰지 않는다', () => {
    const setItemIndex = source.indexOf('gitlab-repo-${currentChatId}');
    expect(setItemIndex).toBeGreaterThan(-1);

    const setItemBody = source.slice(setItemIndex, setItemIndex + 200);
    expect(setItemBody).not.toContain('createdRepoUrl');
    expect(setItemBody).toContain('url: repoUrl');
  });

  it('신규/기존 저장소 분기 모두 repoUrl 지역 변수에 실제 계산된 URL을 대입한다', () => {
    expect(source).toContain('repoUrl = existingProject.http_url_to_repo;');
    expect(source).toContain('repoUrl = newProject.http_url_to_repo;');
  });
});
