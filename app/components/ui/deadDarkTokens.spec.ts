import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * overnight5 Phase 1 — 12 files had `dark:bolt-elements-X-dark` class references where
 * `--bolt-elements-X-dark` isn't a real CSS variable (variables.scss never defines it) — dead,
 * silently-ignored classes that happened to look like real dark-mode overrides. The preceding
 * non-suffixed token (e.g. `text-bolt-elements-textPrimary`) is already theme-reactive on its own,
 * so removing the dead clause changes nothing visually — this just stops the confusing dead code
 * from coming back. (GitHubDeploymentDialog.tsx/GitLabDeploymentDialog.tsx have the same pattern
 * but are handled separately — much larger files, tracked as their own item.)
 */
describe('no dead bolt-elements-*-dark token references', () => {
  const files = [
    'Badge.tsx',
    'Breadcrumbs.tsx',
    'CodeBlock.tsx',
    'EmptyState.tsx',
    'FilterChip.tsx',
    'GradientCard.tsx',
    'RepositoryStats.tsx',
    'SearchResultItem.tsx',
    'StatusIndicator.tsx',
    'Tabs.tsx',
    'TabsWithSlider.tsx',
    'Tooltip.tsx',
  ];

  const deadPattern = /dark:[^\s'"]*-dark(\/[0-9]+)?/;

  it.each(files)('%s has no dark:*-dark dead token reference', (file) => {
    const source = readFileSync(join(__dirname, file), 'utf-8');
    expect(source).not.toMatch(deadPattern);
  });
});
