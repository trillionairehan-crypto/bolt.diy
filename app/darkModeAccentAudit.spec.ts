import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Phase 2 사이클 6 (감사 대상: 다크모드) — 같은 하드코딩 패턴(#FF5330/#E44A28가 라이트 모드
 * --accent와 값이 같아 라이트에선 안 보이지만 다크 모드 --accent/--on-accent는 다른 oklch 값이라
 * 어긋남)이 남아있던 파일들. PromptClarification/Artifact/Messages/FileTree/GitHub·GitLabDeploymentDialog와
 * 동일 버그 클래스. OVERNIGHT5_PROGRESS.md 사이클 6 기록 참고.
 */
describe('실사용 앱 UI 표면들이 var(--accent) 계열 토큰을 쓰고 하드코딩 accent hex를 쓰지 않는다', () => {
  const files = [
    'components/ui/Slider.tsx',
    'components/chat/APIKeyManager.tsx',
    'components/chat/ModelSelector.tsx',
    'components/sidebar/Menu.client.tsx',
    'components/sidebar/HistoryItem.tsx',
    'components/chat/ChatErrorBoundary.tsx',
  ];

  it.each(files)('%s has no hardcoded #FF5330/#E44A28 accent color', (file) => {
    const source = readFileSync(join(__dirname, file), 'utf-8');
    expect(source).not.toMatch(/#FF5330/i);
    expect(source).not.toMatch(/#E44A28/i);
  });

  /*
   * ChatBox.tsx's PromptEffectLine/PromptEffectContainer/PromptShine (checked here before) —
   * the animated dashed gradient-stroke border around the input — was removed entirely per a
   * later request ("입력창 테두리의 코랄 그라데이션 제거. 단색 테두리로."), replaced with a
   * plain solid border. Nothing left to check here.
   */

  it('Slider.tsx tab underline uses var(--accent)', () => {
    const source = readFileSync(join(__dirname, 'components/ui/Slider.tsx'), 'utf-8');
    expect(source).toContain("background: 'var(--accent)'");
  });

  /*
   * Menu.client.tsx's selection-mode toggle (checked here before) was removed in the chat
   * home/sidebar redesign — the bulk-select UI it belonged to no longer exists.
   */

  it('ChatErrorBoundary.tsx reload button uses var(--accent)/var(--on-accent)', () => {
    const source = readFileSync(join(__dirname, 'components/chat/ChatErrorBoundary.tsx'), 'utf-8');
    expect(source).toContain("background: 'var(--accent)'");
    expect(source).toContain("color: 'var(--on-accent)'");
  });
});

describe('root.tsx 일반 ErrorBoundary 재시작 버튼이 var(--accent)를 쓴다 (404 코랄 히어로는 의도된 고정색이라 제외)', () => {
  const source = readFileSync(join(__dirname, 'root.tsx'), 'utf-8');

  it('generic ErrorBoundary reload button uses var(--accent)/var(--on-accent)', () => {
    const genericBoundaryButton = source.slice(source.indexOf('화면에 문제가 생겼어요'));
    expect(genericBoundaryButton).toContain("background: 'var(--accent)'");
    expect(genericBoundaryButton).toContain("color: 'var(--on-accent)'");
  });

  it('intentional coral 404 hero is untouched (not a bug, do not regress by removing it)', () => {
    expect(source).toContain("background: '#FF5330'");
  });
});

describe('VercelDeploymentLink.client.tsx 링크 아이콘 hover가 순수 검정 대신 테마 토큰을 쓴다', () => {
  const source = readFileSync(join(__dirname, 'components/chat/VercelDeploymentLink.client.tsx'), 'utf-8');

  it('has no hardcoded hover:text-[#000000]', () => {
    expect(source).not.toContain('hover:text-[#000000]');
  });

  it('uses hover:text-bolt-elements-textPrimary instead', () => {
    expect(source).toContain('hover:text-bolt-elements-textPrimary');
  });
});

describe('NetlifyDeploymentLink.client.tsx 링크 아이콘 hover가 고정 Netlify 브랜드 틸 대신 테마 토큰을 쓴다 (VercelDeploymentLink.client.tsx와 동일 패턴/사용처)', () => {
  const source = readFileSync(join(__dirname, 'components/chat/NetlifyDeploymentLink.client.tsx'), 'utf-8');

  it('has no hardcoded hover:text-[#00AD9F]', () => {
    expect(source).not.toContain('hover:text-[#00AD9F]');
  });

  it('uses hover:text-bolt-elements-textPrimary instead', () => {
    expect(source).toContain('hover:text-bolt-elements-textPrimary');
  });
});

/**
 * Phase 2 사이클 45 (감사 대상: 다크모드, 8회차) — `bolt-elements-link-text`/`bolt-elements-link-textHover`는
 * uno.config.ts의 `elements` 토큰 테이블에 한 번도 정의된 적 없는 죽은 클래스라(정의된 건
 * `bolt-elements-messages-linkColor` 및 `bolt-elements-item-contentAccent`뿐), 라이트 모드 링크 색은
 * 상속색으로 조용히 폴백되고 다크 모드 hover는 아무 변화도 없었음(사이클 14 IMPROVEMENTS 항목 13에서
 * 발견만 되고 범위 초과로 보류됐던 항목, 이번 사이클에서 수정).
 */
describe('NetlifyTab.tsx/NetlifyConnection.tsx 배포 URL 링크가 죽은 bolt-elements-link-text 토큰 대신 실제 정의된 토큰을 쓴다', () => {
  const files = [
    'components/@settings/tabs/netlify/NetlifyTab.tsx',
    'components/@settings/tabs/netlify/components/NetlifyConnection.tsx',
  ];

  it.each(files)('%s has no references to the undefined bolt-elements-link-text/-textHover tokens', (file) => {
    const source = readFileSync(join(__dirname, file), 'utf-8');
    expect(source).not.toContain('bolt-elements-link-text');
  });

  it.each(files)('%s deploy URL links use the real bolt-elements-item-contentAccent token', (file) => {
    const source = readFileSync(join(__dirname, file), 'utf-8');
    expect(source.match(/text-bolt-elements-item-contentAccent/g)?.length).toBeGreaterThanOrEqual(4);
  });
});
