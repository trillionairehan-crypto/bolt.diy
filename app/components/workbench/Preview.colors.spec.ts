import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * overnight5 Phase 1 — the "창 크기" dropdown panel had hardcoded bolt.diy-purple/gray hex colors
 * instead of coralred's bolt-elements-family / --accent tokens (never fixed in the overnight4
 * quality audit, deferred as "범위가 커서"). No component-render test infra exists in this codebase for
 * this kind of pure styling change (see overnight5/6's own precedent of grepping source/build
 * output instead), so this asserts directly on the source file — a real regression guard against
 * someone reintroducing the old hex values, not a placeholder.
 */
describe('Preview.tsx window-size dropdown uses design tokens, not hardcoded hex colors', () => {
  const source = readFileSync(join(__dirname, 'Preview.tsx'), 'utf-8');

  const forbiddenHexColors = ['#6D28D9', '#111827', '#6B7280', '#F5EEFF', '#E5E7EB'];

  it.each(forbiddenHexColors)('does not contain the old hardcoded color %s', (hex) => {
    expect(source).not.toContain(hex);
  });

  it('the window-size dropdown text is Korean, not the old English leftovers', () => {
    expect(source).not.toContain('Open in new tab');
    expect(source).not.toContain('Open in new window');
    expect(source).not.toContain('Show Device Frame');
    expect(source).not.toContain('Landscape Mode');
  });
});
