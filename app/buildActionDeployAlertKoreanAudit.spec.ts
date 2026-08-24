import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Phase 2 검증 사이클 (감사 대상: 배포) — 사이클 36.
 * OVERNIGHT5_PROGRESS.md 해당 사이클 기록 참고.
 *
 * ActionRunner#runBuildAction()이 쏘는 onDeployAlert가 영어로 하드코딩돼 있어서,
 * 5개 배포 제공자(Cloudflare/GitHub/GitLab/Netlify/Vercel) 전부에서 빌드 단계마다
 * 직전에 표시된 한국어 배포 상태(handleDeployAction, 예: "빌드 중이에요")를
 * "Building Application"/"Build Failed"/"Build Completed" 영어 문구로 덮어쓰던 문제.
 */
describe('배포 감사 — 사이클 36: 빌드 액션 배포 알림이 영어가 아니라 한국어다', () => {
  const source = readFileSync(join(__dirname, 'lib/runtime/action-runner.ts'), 'utf-8');

  const englishBuildAlertFragments = [
    "title: 'Building Application'",
    "title: 'Build Failed'",
    "title: 'Build Completed'",
  ];

  it.each(englishBuildAlertFragments)('%s 하드코딩 영어 문구가 더 이상 없다', (fragment) => {
    expect(source).not.toContain(fragment);
  });

  it('빌드 시작/실패/완료 알림 제목이 한국어다', () => {
    expect(source).toContain("title: '빌드 중이에요'");
    expect(source).toContain("title: '빌드에 실패했어요'");
    expect(source).toContain("title: '빌드가 끝났어요'");
  });
});
