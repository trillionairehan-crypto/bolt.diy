import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * GitHub/GitLab deploy dialogs hardcoded the light-mode accent hex (#FF5330) instead of
 * var(--accent) — invisible in light mode (identical value) but wrong in dark mode, where
 * --accent shifts to a lighter oklch value. Same pattern already fixed in PromptClarification.tsx,
 * Artifact.tsx, Messages.client.tsx and FileTree.tsx (see OVERNIGHT5_PROGRESS.md).
 */
describe('deploy dialogs use var(--accent) instead of hardcoded #FF5330', () => {
  const files = ['GitHubDeploymentDialog.tsx', 'GitLabDeploymentDialog.tsx'];

  it.each(files)('%s has no hardcoded #FF5330/#E44A28 accent color', (file) => {
    const source = readFileSync(join(__dirname, file), 'utf-8');
    expect(source).not.toMatch(/#FF5330/i);
    expect(source).not.toMatch(/#E44A28/i);
  });

  it('GitHubDeploymentDialog.tsx uses var(--accent) tokens', () => {
    const source = readFileSync(join(__dirname, 'GitHubDeploymentDialog.tsx'), 'utf-8');
    expect(source).toMatch(/var\(--accent\)/);
    expect(source).toMatch(/var\(--on-accent\)/);
    expect(source).toMatch(/var\(--accent-hover\)/);
  });
});
