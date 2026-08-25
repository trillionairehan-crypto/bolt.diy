import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * GitLabDeploymentDialog.tsx's two dialog close buttons used untranslated
 * "Close dialog" sr-only text while every other close button in the deploy
 * dialogs (this file's own line 304, and GitHubDeploymentDialog.tsx) already
 * used "닫기". Missed because sr-only text is invisible during manual QA.
 */
describe('GitLabDeploymentDialog.tsx close buttons are translated', () => {
  it('has no leftover English "Close dialog" sr-only text', () => {
    const source = readFileSync(join(__dirname, 'GitLabDeploymentDialog.tsx'), 'utf-8');
    expect(source).not.toMatch(/Close dialog/);
  });

  it('uses "닫기" for all sr-only close labels', () => {
    const source = readFileSync(join(__dirname, 'GitLabDeploymentDialog.tsx'), 'utf-8');
    const matches = source.match(/sr-only">닫기</g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(3);
  });
});

/**
 * gitlabApiService.ts's private _headers getter logged the user's GitLab
 * personal access token (length + 10-char prefix) to the browser console on
 * every API call — a leak surface via extensions/error-monitoring breadcrumbs.
 */
describe('gitlabApiService.ts does not log token info to console', () => {
  it('has no console.log referencing the token', () => {
    const source = readFileSync(join(__dirname, '..', '..', 'lib', 'services', 'gitlabApiService.ts'), 'utf-8');
    expect(source).not.toMatch(/console\.log\([^)]*[Tt]oken/);
    expect(source).not.toMatch(/tokenPrefix/);
  });
});
