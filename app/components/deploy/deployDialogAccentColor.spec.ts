import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * GitHub/GitLab deploy dialogs hardcoded the light-mode accent hex (#FF5330) instead of
 * var(--accent) — invisible in light mode (identical value) but wrong in dark mode, where
 * --accent shifts to a lighter oklch value. Same pattern already fixed in PromptClarification.tsx,
 * Artifact.tsx, Messages.client.tsx and FileTree.tsx (see OVERNIGHT5_PROGRESS.md).
 *
 * 어두운 코랄 삭제(overnight5): --accent-hover 변수 자체가 삭제됐다 — 호버는 opacity로 표현하므로
 * var(--accent-hover) 존재를 더는 요구하지 않는다.
 */
describe('deploy dialogs use var(--accent) instead of hardcoded #FF5330', () => {
  const files = ['GitHubDeploymentDialog.tsx', 'GitLabDeploymentDialog.tsx'];

  it.each(files)('%s has no hardcoded #FF5330/#E44A28 accent color', (file) => {
    const source = readFileSync(join(__dirname, file), 'utf-8');
    expect(source).not.toMatch(/#FF5330/i);
    expect(source).not.toMatch(/#E44A28/i);
  });

  it.each(files)('%s has no dark-coral --accent-hover variable', (file) => {
    const source = readFileSync(join(__dirname, file), 'utf-8');
    expect(source).not.toMatch(/--accent-hover/);
  });

  it('GitHubDeploymentDialog.tsx uses var(--accent) tokens', () => {
    const source = readFileSync(join(__dirname, 'GitHubDeploymentDialog.tsx'), 'utf-8');
    expect(source).toMatch(/var\(--accent\)/);
    expect(source).toMatch(/var\(--on-accent\)/);
  });
});
