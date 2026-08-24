import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * Selected-file border hardcoded #FF5330, which only matches light-mode --accent; dark theme
 * uses a lighter oklch value (variables.scss), so the indicator was the wrong shade in dark mode.
 */
describe('FileTree.tsx selected-file border uses the --accent token, not a hardcoded hex', () => {
  const source = readFileSync(join(__dirname, 'FileTree.tsx'), 'utf-8');

  it('does not hardcode the light-mode accent hex', () => {
    expect(source).not.toContain('#FF5330');
  });

  it('uses the --accent CSS variable for the selected border', () => {
    expect(source).toContain('border-l-[var(--accent)]');
  });
});
