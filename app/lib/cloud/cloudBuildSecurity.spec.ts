import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * CLOUD-DESIGN.md's T9 — service_role never reaches the client bundle. Runs a real production
 * build and greps the actual output rather than trusting the source-level pattern (VITE_ prefix,
 * context.cloudflare.env-only reads) not to have a bypass somewhere. Slower than a unit test
 * (~5-10s for this project's build), but this is the one guarantee in this feature that's worth
 * paying for with a real build rather than asserting on intent.
 */
describe('Cloud service key never reaches the client build', () => {
  const repoRoot = join(__dirname, '..', '..', '..');

  it('the client build output contains no reference to CLOUD_SUPABASE_SERVICE_KEY or CLOUD_APP_TOKEN_SECRET', () => {
    execSync('pnpm run build', { cwd: repoRoot, stdio: 'pipe' });

    const clientDir = join(repoRoot, 'build', 'client');
    expect(existsSync(clientDir)).toBe(true);

    const forbiddenStrings = ['CLOUD_SUPABASE_SERVICE_KEY', 'CLOUD_APP_TOKEN_SECRET'];
    const offenders: string[] = [];

    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          walk(fullPath);
          continue;
        }

        if (!/\.(js|mjs|cjs|html|css|map)$/.test(entry.name)) {
          continue;
        }

        const content = readFileSync(fullPath, 'utf-8');

        for (const forbidden of forbiddenStrings) {
          if (content.includes(forbidden)) {
            offenders.push(`${fullPath}: ${forbidden}`);
          }
        }
      }
    };

    walk(clientDir);

    expect(offenders).toEqual([]);
  }, 120_000);
});
