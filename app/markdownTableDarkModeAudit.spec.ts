import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Phase 2 사이클 22 (감사 대상: 다크모드, 2회차) — Markdown.module.scss의 테이블 테두리/줄무늬
 * 배경(#dfe2e5/#f6f8fa)과 h6 색상(#6a737d)이 GitHub 라이트 테마 값으로 하드코딩돼 있어,
 * 다크모드 채팅 배경 위에서 AI 응답의 마크다운 테이블/h6가 밝은 사각형으로 튀던 문제.
 * 모든 채팅 메시지가 거치는 최고 빈도 표면(Markdown.tsx가 이 스타일을 씀,
 * Markdown.tsx 자체는 수정 금지 파일이라 .module.scss만 수정). OVERNIGHT5_PROGRESS.md 사이클 22 기록 참고.
 */
describe('Markdown.module.scss 테이블/h6 스타일이 테마 토큰을 쓰고 GitHub 라이트 테마 하드코딩 색상을 쓰지 않는다', () => {
  const source = readFileSync(join(__dirname, 'components/chat/Markdown.module.scss'), 'utf-8');

  it('has no hardcoded GitHub light-theme table/h6 colors', () => {
    expect(source).not.toMatch(/#dfe2e5/i);
    expect(source).not.toMatch(/#f6f8fa/i);
    expect(source).not.toMatch(/#6a737d/i);
  });

  it('table border uses var(--bolt-elements-borderColor)', () => {
    expect(source).toContain('border: 1px solid var(--bolt-elements-borderColor);');
  });

  it('table striped row background uses var(--bolt-elements-bg-depth-2)', () => {
    expect(source).toContain('background-color: var(--bolt-elements-bg-depth-2);');
  });

  it('h6 color uses var(--bolt-elements-textTertiary)', () => {
    expect(source).toContain('color: var(--bolt-elements-textTertiary);');
  });
});

/*
 * Menu.client.tsx's old "내 앱" (/apps) rocket-icon link (checked here before) was removed in the
 * chat home/sidebar redesign — sidebar/BaseChat.tsx's cream/ink surfaces are now a deliberately
 * fixed brand palette (Sidebar.module.scss/ChatHome.module.scss, no `dark:` variants at all),
 * the same precedent as the 404 coral hero in darkModeAccentAudit.spec.ts. /apps is now reached
 * via DeployedAppCards.tsx's "전체 보기" link instead.
 */
