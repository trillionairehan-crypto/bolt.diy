import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Phase 2 검증 사이클 (감사 대상: 미리보기/워크벤치) — FileTree.tsx 우클릭 컨텍스트 메뉴
 * (새 파일/새 폴더/경로 복사/잠금 관련 8개 항목)가 전부 영어로 하드코딩돼 있던 문제,
 * 그리고 경로 복사가 실패해도(클립보드 거부 등) 사용자에게 아무 피드백이 없던 문제.
 * OVERNIGHT5_PROGRESS.md 해당 사이클 기록 참고.
 */
describe('FileTree — 컨텍스트 메뉴 문구가 한국어다', () => {
  const source = readFileSync(join(__dirname, 'components/workbench/FileTree.tsx'), 'utf-8');

  it('영어 하드코딩 문구가 남아있지 않다', () => {
    expect(source).not.toContain('New File');
    expect(source).not.toContain('New Folder');
    expect(source).not.toContain('Copy path');
    expect(source).not.toContain('Copy relative path');
    expect(source).not.toContain('Lock File');
    expect(source).not.toContain('Unlock File');
    expect(source).not.toContain('Lock Folder');
    expect(source).not.toContain('Unlock Folder');
  });

  it('한국어 문구로 번역돼 있다', () => {
    expect(source).toContain('새 파일');
    expect(source).toContain('새 폴더');
    expect(source).toContain('경로 복사');
    expect(source).toContain('상대 경로 복사');
    expect(source).toContain('파일 잠금');
    expect(source).toContain('파일 잠금 해제');
    expect(source).toContain('폴더 잠금');
    expect(source).toContain('폴더 잠금 해제');
  });
});

describe('FileTree — 경로 복사 실패 시 사용자에게 피드백을 준다', () => {
  const source = readFileSync(join(__dirname, 'components/workbench/FileTree.tsx'), 'utf-8');

  it('clipboard.writeText Promise를 처리한다(.catch)', () => {
    const onCopyPathMatch = source.match(/const onCopyPath = [\s\S]*?\n {4}\};/);
    expect(onCopyPathMatch).not.toBeNull();
    expect(onCopyPathMatch![0]).toContain('.catch(');

    const onCopyRelativePathMatch = source.match(/const onCopyRelativePath = [\s\S]*?\n {4}\};/);
    expect(onCopyRelativePathMatch).not.toBeNull();
    expect(onCopyRelativePathMatch![0]).toContain('.catch(');
  });

  it('성공/실패 토스트 문구가 있다', () => {
    expect(source).toContain('경로를 복사했어요');
    expect(source).toContain('경로를 복사하지 못했어요');
  });
});
