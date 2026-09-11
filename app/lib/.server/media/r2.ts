import { AwsClient } from 'aws4fetch';

/**
 * Cloudflare R2 업로드 — S3 호환 API(aws4fetch, SigV4)로 직접 PUT한다. Pages R2 바인딩 대신 S3 API를
 * 쓰는 이유: 로컬 dev(remix vite:dev)에서도 실제 버킷에 올라가 공개 URL이 바로 열려야 WebContainer
 * 미리보기 iframe이 이미지를 볼 수 있다(바인딩은 로컬에서 miniflare 에뮬레이션이라 URL이 안 열린다).
 *
 * 필요한 env:
 *   CLOUDFLARE_ACCOUNT_ID  (이미 있음 — 배포용과 공용)
 *   R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY  (R2 API 토큰, Object Read & Write)
 *   R2_BUCKET_NAME         (예: coralred-media)
 *   R2_PUBLIC_BASE_URL     (버킷 공개 URL — r2.dev 서브도메인 또는 커스텀 도메인, 끝 슬래시 없이)
 */
export interface R2Env {
  CLOUDFLARE_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET_NAME?: string;
  R2_PUBLIC_BASE_URL?: string;
}

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
}

export function readR2Config(env: R2Env | undefined): R2Config | null {
  const accountId = env?.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = env?.R2_ACCESS_KEY_ID;
  const secretAccessKey = env?.R2_SECRET_ACCESS_KEY;
  const bucket = env?.R2_BUCKET_NAME;
  const publicBaseUrl = env?.R2_PUBLIC_BASE_URL?.replace(/\/+$/, '');

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBaseUrl) {
    return null;
  }

  return { accountId, accessKeyId, secretAccessKey, bucket, publicBaseUrl };
}

export class R2UploadError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'R2UploadError';
  }
}

const UPLOAD_TIMEOUT_MS = 30_000;

export function r2PublicUrl(config: R2Config, key: string): string {
  return `${config.publicBaseUrl}/${key}`;
}

export async function putR2Object(
  config: R2Config,
  key: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<string> {
  const client = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: 's3',
    region: 'auto',
  });

  const url = `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucket}/${key}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  try {
    const response = await client.fetch(url, {
      method: 'PUT',

      // aws4fetch signs the body hash; pass a fresh ArrayBuffer-backed copy so the Workers fetch types accept it.
      body: bytes.slice().buffer as ArrayBuffer,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new R2UploadError(`R2 PUT ${key} failed: HTTP ${response.status} ${text.slice(0, 200)}`, response.status);
    }
  } catch (error) {
    if (controller.signal.aborted) {
      throw new R2UploadError(`R2 PUT ${key} timed out`, 0);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  return r2PublicUrl(config, key);
}
