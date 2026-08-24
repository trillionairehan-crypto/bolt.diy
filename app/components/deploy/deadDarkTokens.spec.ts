import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Same dead-token cleanup as app/components/ui/deadDarkTokens.spec.ts, applied separately to
 * these two large files (83 combined occurrences) — see overnight5 progress log for why they were
 * handled in their own pass rather than bundled with the 12 smaller ui/* files.
 */
describe('no dead bolt-elements-*-dark token references in the deploy dialogs', () => {
  const files = ['GitHubDeploymentDialog.tsx', 'GitLabDeploymentDialog.tsx'];
  const deadPattern = /dark:[^\s'"]*-dark(\/[0-9]+)?/;

  it.each(files)('%s has no dark:*-dark dead token reference', (file) => {
    const source = readFileSync(join(__dirname, file), 'utf-8');
    expect(source).not.toMatch(deadPattern);
  });
});
