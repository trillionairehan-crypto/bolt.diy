import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * overnight5 Phase 2 cycle 2 — same #FF5330-hardcoded-instead-of-var(--accent) pattern as
 * PromptClarification.tsx (cycle 1), found in two "생성 중" (generating) indicators: Artifact.tsx's
 * build progress bar, and Messages.client.tsx's three-dot typing indicator (whose own container
 * already correctly used var(--accent-soft)/var(--accent-text) — only the dots themselves were
 * hardcoded). Source-content assertion (no component-render test infra in this codebase).
 */
describe('generation-in-progress indicators use var(--accent), not hardcoded hex', () => {
  it('Artifact.tsx build progress bar has no hardcoded accent hex', () => {
    const source = readFileSync(join(__dirname, 'Artifact.tsx'), 'utf-8');
    expect(source).not.toContain('#FF5330');
    expect(source).toContain('var(--accent)');
  });

  it('Messages.client.tsx typing-indicator dots have no hardcoded accent hex', () => {
    const source = readFileSync(join(__dirname, 'Messages.client.tsx'), 'utf-8');
    expect(source).not.toContain('#FF5330');
    expect(source).toContain('var(--accent)');
  });
});
