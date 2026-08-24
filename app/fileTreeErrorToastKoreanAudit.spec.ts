import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Phase 2 검증 사이클 (감사 대상: 미리보기/워크벤치, 사이클 19) — FileTree.tsx의 성공/예상된
 * 실패 토스트는 한국어인데, 예외(catch) 경로의 토스트만 영어로 하드코딩돼 있던 문제.
 * OVERNIGHT5_PROGRESS.md 사이클 19 기록 참고.
 */
describe('FileTree — 예외 처리 토스트 문구가 한국어다', () => {
  const source = readFileSync(join(__dirname, 'components/workbench/FileTree.tsx'), 'utf-8');

  it('업로드/삭제/잠금 관련 catch 토스트에 영어 문구가 남아있지 않다', () => {
    expect(source).not.toContain('Error uploading');
    expect(source).not.toContain('Error deleting');
    expect(source).not.toContain('Error locking');
    expect(source).not.toContain('Error unlocking');
  });

  it('업로드 실패 catch 토스트가 성공/예상된 실패 토스트와 같은 한국어 문구를 쓴다', () => {
    expect(source).toContain('toast.error(`${file.name} 파일을 올리지 못했어요`)');
  });
});
