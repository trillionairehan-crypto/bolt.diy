import { blake3 } from '@noble/hashes/blake3.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import mime from 'mime';

/**
 * Cloudflare Pages "Direct Upload" client, reimplemented from Wrangler's own source
 * (node_modules/wrangler — src/pages/hash.ts, src/pages/upload.ts, src/api/pages/deploy.ts as of
 * wrangler@4.44.0) rather than any public REST doc, since Cloudflare does not document this asset
 * protocol — only the CLI implements it. Two things had to be reproduced exactly for uploads to be
 * accepted: the manifest hash algorithm (below) and the check-missing → upload → deploy sequence.
 *
 * Runs inside the Cloudflare Pages Functions (Workers) runtime, not Node — no `fs`, no native
 * addons. Wrangler's own hashing uses `blake3-wasm`, which needs a WASM loader wired up per
 * bundler target; @noble/hashes' pure-JS/TS blake3 avoids that risk entirely and produces
 * byte-identical output (verified against the official BLAKE3 empty-input test vector).
 */

const CF_API_BASE = 'https://api.cloudflare.com/client/v4';

/** Cloudflare's own cap; batching stays well under it (see UPLOAD_BATCH_MAX_BYTES). */
const MAX_ASSET_SIZE_BYTES = 25 * 1024 * 1024;

/**
 * Conservative per-request upload batch size — Wrangler tunes concurrency/bucket-packing far
 * more aggressively, but a simple sequential chunker is enough for the app-builder-scale sites
 * this deploys and is much less code to get wrong inside a single Worker request's time budget.
 */
const UPLOAD_BATCH_MAX_BYTES = 20 * 1024 * 1024;
const UPLOAD_BATCH_MAX_FILES = 200;

export interface CloudflareDeployFile {
  /** Relative path, no leading slash, e.g. "index.html" or "assets/app.js". */
  path: string;
  content: Uint8Array;
}

export interface CloudflareDeployResult {
  url: string;
  deploymentId: string;
  projectName: string;
}

export class CloudflareDeployError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'CloudflareDeployError';
    this.status = status;
  }
}

interface AssetEntry {
  path: string;
  content: Uint8Array;
  contentType: string;
  hash: string;
}

/** Node's `path.extname()` semantics: no dot, or a leading dot only (dotfile), means "no extension". */
function getExtension(filePath: string): string {
  const base = filePath.split('/').pop() ?? '';
  const lastDot = base.lastIndexOf('.');

  return lastDot <= 0 ? '' : base.slice(lastDot + 1);
}

function base64Encode(bytes: Uint8Array): string {
  let binary = '';

  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
}

/** Cloudflare's asset hash: blake3(base64(fileBytes) + extensionWithoutDot), first 16 bytes, hex. */
export function hashFileContent(filePath: string, content: Uint8Array): string {
  const input = base64Encode(content) + getExtension(filePath);
  return bytesToHex(blake3(new TextEncoder().encode(input), { dkLen: 16 }));
}

interface CloudflareApiEnvelope<T> {
  success: boolean;
  result: T;
  errors?: Array<{ code: number; message: string }>;
}

async function cfFetch<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${CF_API_BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
  });

  let data: CloudflareApiEnvelope<T> | undefined;

  try {
    data = (await response.json()) as CloudflareApiEnvelope<T>;
  } catch {
    // fall through — data stays undefined, handled below
  }

  if (!response.ok || !data?.success) {
    const message =
      data?.errors?.map((e) => e.message).join('; ') || `Cloudflare API request failed (${response.status})`;
    throw new CloudflareDeployError(message, response.status);
  }

  return data.result;
}

async function ensureProject(accountId: string, token: string, projectName: string): Promise<void> {
  const getResponse = await fetch(`${CF_API_BASE}/accounts/${accountId}/pages/projects/${projectName}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (getResponse.ok) {
    return;
  }

  if (getResponse.status !== 404) {
    const data = (await getResponse.json().catch(() => undefined)) as CloudflareApiEnvelope<unknown> | undefined;
    throw new CloudflareDeployError(
      data?.errors?.[0]?.message || `Cloudflare 프로젝트 확인에 실패했어요 (${getResponse.status})`,
      getResponse.status,
    );
  }

  await cfFetch(`/accounts/${accountId}/pages/projects`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: projectName, production_branch: 'main' }),
  });
}

async function getUploadJwt(accountId: string, token: string, projectName: string): Promise<string> {
  const result = await cfFetch<{ jwt: string }>(
    `/accounts/${accountId}/pages/projects/${projectName}/upload-token`,
    token,
  );
  return result.jwt;
}

async function checkMissingHashes(jwt: string, hashes: string[]): Promise<string[]> {
  if (hashes.length === 0) {
    return [];
  }

  return cfFetch<string[]>('/pages/assets/check-missing', jwt, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hashes }),
  });
}

function chunkForUpload(entries: AssetEntry[]): AssetEntry[][] {
  const batches: AssetEntry[][] = [];
  let current: AssetEntry[] = [];
  let currentBytes = 0;

  for (const entry of entries) {
    const wouldOverflow =
      current.length >= UPLOAD_BATCH_MAX_FILES ||
      (current.length > 0 && currentBytes + entry.content.byteLength > UPLOAD_BATCH_MAX_BYTES);

    if (wouldOverflow) {
      batches.push(current);
      current = [];
      currentBytes = 0;
    }

    current.push(entry);
    currentBytes += entry.content.byteLength;
  }

  if (current.length > 0) {
    batches.push(current);
  }

  return batches;
}

async function uploadMissingAssets(jwt: string, entries: AssetEntry[], missingHashes: string[]): Promise<void> {
  const missing = new Set(missingHashes);
  const toUpload = entries.filter((entry) => missing.has(entry.hash));

  for (const batch of chunkForUpload(toUpload)) {
    const payload = batch.map((entry) => ({
      key: entry.hash,
      value: base64Encode(entry.content),
      metadata: { contentType: entry.contentType },
      base64: true,
    }));

    await cfFetch('/pages/assets/upload', jwt, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }
}

interface CloudflareDeploymentResponse {
  id: string;
  url: string;
  aliases?: string[] | null;
}

async function createDeployment(
  accountId: string,
  token: string,
  projectName: string,
  manifest: Record<string, string>,
): Promise<CloudflareDeploymentResponse> {
  const formData = new FormData();
  formData.append('manifest', JSON.stringify(manifest));

  return cfFetch<CloudflareDeploymentResponse>(
    `/accounts/${accountId}/pages/projects/${projectName}/deployments`,
    token,
    {
      method: 'POST',
      body: formData,
    },
  );
}

/**
 * "Made with 코랄레드" badge injected into free-tier deploys' HTML (bottom-right, fixed).
 *
 * TODO(티어 분기): there is no server-side subscription/tier lookup anywhere in this codebase yet
 * (pricing.tsx's PortOne integration doesn't verify payment server-side either — see its own TODO).
 * Until one exists, this is called unconditionally for every deploy from api.cloudflare-deploy.ts,
 * which is the only currently-correct behavior (every user is effectively on the undetermined/free
 * tier). Once a real tier lookup exists, gate that call site on it — do not add a fake check here.
 */
const MADE_WITH_BADGE_HTML =
  '<a href="https://coralred.kr" target="_blank" rel="noopener noreferrer" ' +
  'style="position:fixed;right:12px;bottom:12px;z-index:2147483647;display:inline-flex;' +
  'align-items:center;gap:6px;padding:6px 12px;border-radius:999px;background:#1a1a1a;' +
  "color:#faf7f0;font:600 12px/1 -apple-system,BlinkMacSystemFont,'Pretendard',sans-serif;" +
  'text-decoration:none;box-shadow:0 2px 8px rgba(0,0,0,.25);opacity:.9;">Made with 코랄레드</a>';

export function injectMadeWithBadge(html: string): string {
  const bodyCloseIndex = html.lastIndexOf('</body>');

  if (bodyCloseIndex === -1) {
    return `${html}${MADE_WITH_BADGE_HTML}`;
  }

  return `${html.slice(0, bodyCloseIndex)}${MADE_WITH_BADGE_HTML}${html.slice(bodyCloseIndex)}`;
}

export async function deployToCloudflarePages(params: {
  accountId: string;
  apiToken: string;
  projectName: string;
  files: CloudflareDeployFile[];
}): Promise<CloudflareDeployResult> {
  const { accountId, apiToken, projectName, files } = params;

  if (files.length === 0) {
    throw new CloudflareDeployError('배포할 파일이 없어요. 먼저 빌드가 성공했는지 확인해주세요.');
  }

  for (const file of files) {
    if (file.content.byteLength > MAX_ASSET_SIZE_BYTES) {
      throw new CloudflareDeployError(`${file.path} 파일이 너무 커요 (25MB 제한).`);
    }
  }

  await ensureProject(accountId, apiToken, projectName);

  const entries: AssetEntry[] = files.map((file) => ({
    path: file.path,
    content: file.content,
    contentType: mime.getType(file.path) || 'application/octet-stream',
    hash: hashFileContent(file.path, file.content),
  }));

  const jwt = await getUploadJwt(accountId, apiToken, projectName);
  const missingHashes = await checkMissingHashes(
    jwt,
    entries.map((entry) => entry.hash),
  );

  await uploadMissingAssets(jwt, entries, missingHashes);

  try {
    await cfFetch('/pages/assets/upsert-hashes', jwt, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hashes: entries.map((entry) => entry.hash) }),
    });
  } catch {
    // Best-effort cache priming only (matches Wrangler's own behavior) — never fails the deploy.
  }

  const manifest = Object.fromEntries(entries.map((entry) => [`/${entry.path}`, entry.hash]));
  const deployment = await createDeployment(accountId, apiToken, projectName, manifest);

  const productionAlias = deployment.aliases?.find((alias) => alias.endsWith('.pages.dev'));

  return {
    url: productionAlias ?? deployment.url,
    deploymentId: deployment.id,
    projectName,
  };
}
