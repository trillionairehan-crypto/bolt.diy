import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * overnight5 Phase 2 cycle 1 — the onboarding question screen hardcoded ACCENT = '#FF5330'
 * (light mode's --accent value) instead of using var(--accent), unlike every other coral-accent
 * surface in this app. variables.scss's dark theme block sets --accent to a different, brighter
 * oklch lightness (0.68 vs light's 0.58) and --on-accent to var(--bg) (dark text) instead of
 * white — so this screen didn't participate in the theme system's dark-mode values at all.
 * Source-content assertion (see Preview.colors.spec.ts's note — no component-render test infra).
 */
describe('PromptClarification.tsx follows the --accent/--on-accent theme tokens', () => {
  const source = readFileSync(join(__dirname, 'PromptClarification.tsx'), 'utf-8');

  it('does not hardcode the light-mode-only accent hex', () => {
    expect(source).not.toContain('#FF5330');
  });

  it('does not hardcode text-white on an accent-filled button', () => {
    expect(source).not.toContain('text-white');
  });

  it('uses var(--accent) for the accent color', () => {
    expect(source).toContain('var(--accent)');
  });

  it('uses var(--on-accent) for text on accent-filled buttons', () => {
    expect(source).toContain('var(--on-accent)');
  });
});
