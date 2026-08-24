import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Phase 2 검증 사이클 (감사 대상: 미리보기/워크벤치, 4회차) — "차이점" 탭(DiffView.tsx)이
 * 다른 워크벤치 표면(코드/미리보기 슬라이더, 파일트리 컨텍스트 메뉴 등)과 달리 상태 문구·안내
 * 문구 전체가 영어로 하드코딩돼 있던 문제. OVERNIGHT5_PROGRESS.md 해당 사이클 기록 참고.
 */
describe('DiffView — 상태/안내 문구가 한국어다', () => {
  const source = readFileSync(join(__dirname, 'components/workbench/DiffView.tsx'), 'utf-8');

  it('영어 하드코딩 문구가 남아있지 않다', () => {
    expect(source).not.toContain('Files are identical');
    expect(source).not.toContain('Both versions match exactly');
    expect(source).not.toContain('Current Content');
    expect(source).not.toContain('>Modified<');
    expect(source).not.toContain('>No Changes<');
    expect(source).not.toContain('Streaming…</span>');
    expect(source).not.toContain('Loading diff...');
    expect(source).not.toContain('Select a file to view differences');
    expect(source).not.toContain('Failed to render diff view');
  });

  it('한국어 상태/안내 문구로 번역돼 있다', () => {
    expect(source).toContain('파일이 동일해요');
    expect(source).toContain('두 버전이 완전히 일치해요');
    expect(source).toContain('현재 내용');
    expect(source).toContain('수정됨');
    expect(source).toContain('변경 없음');
    expect(source).toContain('스트리밍 중…');
    expect(source).toContain('차이점을 불러오는 중...');
    expect(source).toContain('차이점을 보려면 파일을 선택하세요');
    expect(source).toContain('차이점 화면을 그리지 못했어요');
  });
});
