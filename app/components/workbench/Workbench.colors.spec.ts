import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * overnight5 Phase 1 — the "저장" (sync files) dropdown had hardcoded bg-white/dark:bg-[#141414]
 * and border-gray-200/50/dark:border-gray-800/50 instead of tokens, unlike its sibling checkpoint-
 * rewind dropdown a few lines above it in the same file, which already used
 * bg-[var(--surface-2)]/border-bolt-elements-borderColor correctly. Fixed to match. Source-content
 * assertion (see Preview.colors.spec.ts's own note — no component-render test infra here).
 */
describe('Workbench.client.tsx sync dropdown uses design tokens, not hardcoded colors', () => {
  const source = readFileSync(join(__dirname, 'Workbench.client.tsx'), 'utf-8');

  it('does not use the old hardcoded panel background', () => {
    expect(source).not.toContain('bg-white dark:bg-[#141414]');
  });

  it('does not use the old hardcoded gray border', () => {
    expect(source).not.toContain('border-gray-200/50 dark:border-gray-800/50');
  });
});
