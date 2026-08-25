import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Phase 2 검증 사이클 (감사 대상: 배포) — 사이클 43.
 * OVERNIGHT5_PROGRESS.md 해당 사이클 기록 참고.
 *
 * ActionCommandError('Build Failed'/'Failed To Start Application', ...)의 첫 인자(header)가
 * app/components/chat/ChatAlert.tsx에서 description으로 그대로 노출("오류: {description}")돼,
 * 5개 배포 제공자 전부에서 빌드 실패 시 이미 한국어인 onDeployAlert(사이클 36에서 수정)와 별개로
 * ActionRunner#executeAction의 catch가 쏘는 두 번째 alert(onAlert → ChatAlert "터미널 오류")에
 * 영어 "Build Failed"/"Failed To Start Application"이 그대로 노출되던 문제.
 */
describe('배포 감사 — 사이클 43: ActionCommandError 헤더가 영어가 아니라 한국어다', () => {
  const source = readFileSync(join(__dirname, 'lib/runtime/action-runner.ts'), 'utf-8');

  it("ActionCommandError('Build Failed', ...) 하드코딩 영어 문구가 더 이상 없다", () => {
    expect(source).not.toContain("ActionCommandError('Build Failed'");
  });

  it("ActionCommandError('Failed To Start Application', ...) 하드코딩 영어 문구가 더 이상 없다", () => {
    expect(source).not.toContain("ActionCommandError('Failed To Start Application'");
  });

  it('빌드/시작 실패 ActionCommandError 헤더가 한국어다', () => {
    expect(source).toContain("ActionCommandError('빌드 실패'");
    expect(source).toContain("ActionCommandError('애플리케이션 시작 실패'");
  });
});
