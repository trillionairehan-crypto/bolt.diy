import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Phase 2 검증 사이클 (감사 대상: 모바일, 2회차) — 고정 300px 폭 입력창/드롭다운 3곳이
 * 375px 모바일 뷰포트에서 넘치던 버그. OVERNIGHT5_PROGRESS.md 해당 사이클 기록 참고.
 */
describe('고정 300px 폭 요소가 모바일 뷰포트에서 넘치지 않는다', () => {
  it('WebSearch.client.tsx URL 입력창이 뷰포트에 맞춰 줄어든다', () => {
    const source = readFileSync(join(__dirname, 'components/chat/WebSearch.client.tsx'), 'utf-8');
    expect(source).not.toContain("'w-[300px] px-3 py-1.5 text-sm rounded-md'");
    expect(source).toContain('w-[min(300px,calc(100vw-8rem))]');
    expect(source).toContain('max-w-[calc(100vw-2rem)]');
  });

  it('APIKeyManager.tsx API 키 입력창이 뷰포트에 맞춰 줄어든다', () => {
    const source = readFileSync(join(__dirname, 'components/chat/APIKeyManager.tsx'), 'utf-8');
    expect(source).not.toContain('w-[300px] px-3 py-1.5 text-sm rounded border');
    expect(source).toContain('w-[min(300px,calc(100vw-10rem))]');
  });

  it('FileBreadcrumb.tsx 폴더 드롭다운이 min-w 대신 뷰포트 상대 너비를 써서 max-width와 충돌하지 않는다', () => {
    const source = readFileSync(join(__dirname, 'components/workbench/FileBreadcrumb.tsx'), 'utf-8');
    expect(source).not.toContain('min-w-[300px]');
    expect(source).toContain('w-[min(300px,calc(100vw-2rem))]');
  });
});
