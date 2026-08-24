/**
 * 코랄레드 Cloud 앱 토큰 — CLOUD-DESIGN.md 3번 섹션의 그대로 구현.
 * Web Crypto API만 사용(Cloudflare Workers/Pages Functions 런타임에 Node crypto가 없음).
 * 서버 전용 — 이 파일을 클라이언트 번들에서 import하면 안 됨(CLOUD_APP_TOKEN_SECRET을 직접 다루진
 * 않지만, 토큰 위조 로직 자체가 서버에만 있어야 하는 게 이 설계의 핵심 전제).
 */

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';

  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);
}

async function hmacSign(payload: string, secret: string): Promise<string> {
  const key = await importHmacKey(secret);
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));

  return base64UrlEncode(new Uint8Array(sigBuf));
}

/** Constant-time-ish compare — both inputs are fixed-length HMAC outputs, so length alone leaks nothing useful. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;

  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

export async function issueCloudAppToken(appId: string, secret: string): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  const payload = `${appId}.${iat}`;
  const sig = await hmacSign(payload, secret);

  return `${payload}.${sig}`;
}

export interface CloudTokenPayload {
  appId: string;
  iat: number;
}

/** Returns null for any malformed or forged token — callers must not distinguish the failure reason. */
export async function verifyCloudAppToken(token: string, secret: string): Promise<CloudTokenPayload | null> {
  const parts = token.split('.');

  if (parts.length !== 3) {
    return null;
  }

  const [appId, iatStr, sig] = parts;

  if (!appId || !iatStr || !sig) {
    return null;
  }

  const iat = Number(iatStr);

  if (!Number.isFinite(iat) || !/^[0-9]+$/.test(iatStr)) {
    return null;
  }

  const payload = `${appId}.${iatStr}`;
  const expectedSig = await hmacSign(payload, secret);

  if (!timingSafeEqual(expectedSig, sig)) {
    return null;
  }

  return { appId, iat };
}

/** app_secret_hash storage — sha256(token), never the token itself (see CLOUD-DESIGN.md's T7). */
export async function hashCloudAppToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));

  return base64UrlEncode(new Uint8Array(digest));
}
