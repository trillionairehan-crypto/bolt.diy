export function corsHeadersFor(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    Vary: 'Origin',
  };
}

export function jsonError(status: number, message: string, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

export function jsonOk(status: number, body: unknown, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

/**
 * Preflight can't authenticate (no Authorization header on an OPTIONS request) — reflecting the
 * requesting Origin here is standard CORS practice and safe, since the actual GET/POST/etc. that
 * follows independently re-verifies the token and the exact deploy_origin match. Preflight is
 * permission-checking only, not itself a data-bearing request.
 */
export function preflightResponse(request: Request): Response {
  const origin = request.headers.get('Origin') || '*';

  return new Response(null, { status: 204, headers: corsHeadersFor(origin) });
}
