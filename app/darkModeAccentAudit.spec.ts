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

  it('ChatBox.tsx PromptEffectLine gradient stops use var(--accent) (isLanding-only inline style block still intentionally hardcodes #FF5330, unrelated to this)', () => {
    const source = readFileSync(join(__dirname, 'components/chat/ChatBox.tsx'), 'utf-8');
    expect(source.match(/stopColor:\s*'var\(--accent\)'/g)?.length).toBe(4);
    expect(source).not.toContain('stopColor="#FF5330"');
  });

  it('Slider.tsx tab underline uses var(--accent)', () => {
    const source = readFileSync(join(__dirname, 'components/ui/Slider.tsx'), 'utf-8');
    expect(source).toContain("background: 'var(--accent)'");
  });

  it('Menu.client.tsx selection-mode toggle uses var(--on-accent)/var(--accent-hover)', () => {
    const source = readFileSync(join(__dirname, 'components/sidebar/Menu.client.tsx'), 'utf-8');
    expect(source).toContain('var(--on-accent)');
    expect(source).toContain('var(--accent-hover)');
  });

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
