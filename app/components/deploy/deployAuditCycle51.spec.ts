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

/**
 * api.vercel-deploy.ts's loader (GET) read the Vercel access token from a URL
 * query parameter — unlike its own action (POST), which reads it from the JSON
 * body. Query-string tokens land in server/proxy access logs and browser
 * network history. Fixed by moving the token to the Authorization header, same
 * as the fetched-projects path a few lines above the fallback call.
 */
describe('api.vercel-deploy.ts loader reads the token from a header, not the URL', () => {
  it('does not read token from URL search params', () => {
    const source = readFileSync(join(__dirname, '..', '..', 'routes', 'api.vercel-deploy.ts'), 'utf-8');
    expect(source).not.toMatch(/searchParams\.get\(['"]token['"]\)/);
  });

  it('reads the token from the Authorization header instead', () => {
    const source = readFileSync(join(__dirname, '..', '..', 'routes', 'api.vercel-deploy.ts'), 'utf-8');
    expect(source).toMatch(/request\.headers\.get\(['"]Authorization['"]\)/);
  });
});

describe('VercelDeploymentLink.client.tsx sends the token via Authorization header', () => {
  it('does not put the token in the /api/vercel-deploy query string', () => {
    const source = readFileSync(join(__dirname, '..', 'chat', 'VercelDeploymentLink.client.tsx'), 'utf-8');
    expect(source).not.toMatch(/vercel-deploy\?projectId=\$\{projectId\}&token=/);
  });
});
