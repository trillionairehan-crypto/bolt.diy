import { putR2Object, type R2Config } from '~/lib/.server/media/r2';

const MAX_VIDEO_BYTES = 40 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 60_000;

/** 공급자 임시 URL(만료됨)의 영상을 내려받아 R2에 영구 저장하고 공개 URL을 돌려준다. */
export async function copyVideoToR2(
  sourceUrl: string,
  r2: R2Config,
  key: string,
): Promise<{ url: string; bytes: number }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

  try {
    const response = await fetch(sourceUrl, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`video download failed: HTTP ${response.status}`);
    }

    const bytes = new Uint8Array(await response.arrayBuffer());

    if (bytes.byteLength > MAX_VIDEO_BYTES) {
      throw new Error(`video too large: ${bytes.byteLength} bytes`);
    }

    const url = await putR2Object(r2, key, bytes, response.headers.get('content-type') || 'video/mp4');

    return { url, bytes: bytes.byteLength };
  } finally {
    clearTimeout(timeoutId);
  }
}
