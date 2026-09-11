import { describe, expect, it } from 'vitest';
import { signKlingJwt } from './kling';

function decode(segment: string): Record<string, unknown> {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (segment.length % 4)) % 4);

  return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
}

describe('signKlingJwt', () => {
  it('produces an HS256 JWT with iss/exp/nbf claims the Kling docs require', async () => {
    const token = await signKlingJwt('ak_test', 'sk_test', 1_700_000_000);
    const [header, payload, signature] = token.split('.');

    expect(decode(header)).toEqual({ alg: 'HS256', typ: 'JWT' });
    expect(decode(payload)).toEqual({ iss: 'ak_test', exp: 1_700_000_000 + 1800, nbf: 1_700_000_000 - 5 });
    expect(signature).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('is deterministic for the same inputs and changes with the secret', async () => {
    const a = await signKlingJwt('ak', 'secret-1', 1);
    const b = await signKlingJwt('ak', 'secret-1', 1);
    const c = await signKlingJwt('ak', 'secret-2', 1);

    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
