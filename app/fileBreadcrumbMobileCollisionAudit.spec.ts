import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Phase 2 검증 사이클 (감사 대상: 모바일, 사이클 23) — FileBreadcrumb.tsx의 경로 드롭다운이
 * `avoidCollisions={false}`로 Radix의 자동 화면 밖 재배치를 꺼두고 있었음. 사이클 15에서
 * `w-[min(300px,calc(100vw-2rem))]`로 폭은 이미 고쳤지만, 화면 오른쪽 끝 근처(깊은 경로)에서
 * `align="start"`로 고정 앵커링되면 여전히 뷰포트 밖으로 밀려날 수 있는 문제가 남아 있었음.
 * OVERNIGHT5_PROGRESS.md 사이클 23 기록 참고.
 */
describe('파일 경로 드롭다운 — 모바일 화면 밖 재배치', () => {
  const source = readFileSync(join(__dirname, 'components/workbench/FileBreadcrumb.tsx'), 'utf-8');

  it('DropdownMenu.Content는 avoidCollisions={false}로 Radix의 자동 재배치를 끄지 않는다', () => {
    expect(source).not.toContain('avoidCollisions={false}');
  });

  it('폭 클램프 패턴은 여전히 유지된다', () => {
    expect(source).toContain('w-[min(300px,calc(100vw-2rem))]');
  });
});
