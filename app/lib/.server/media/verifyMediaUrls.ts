/**
 * 배포 직전 이미지 URL 유효 확인 — 빌드 산출물(html/js/css) 텍스트에서 R2 공개 URL을 긁어 HEAD로
 * 하나씩 확인한다. 생성 중 업로드가 실패했거나 객체가 지워졌으면 배포된 사이트에 깨진 이미지가 남으므로
 * 배포를 막는 쪽을 택한다.
 */

export interface DeployTextFile {
  path: string;
  content: Uint8Array;
}

const TEXT_EXTENSIONS = /\.(html?|js|mjs|css|json|txt)$/i;
const MAX_SCAN_BYTES = 8 * 1024 * 1024;
const MAX_URLS = 32;
const HEAD_TIMEOUT_MS = 8_000;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function collectMediaUrls(files: DeployTextFile[], publicBaseUrl: string): string[] {
  const base = publicBaseUrl.replace(/\/+$/, '');
  const regex = new RegExp(`${escapeRegex(base)}/media/[^\\s"'()<>\\\\]+`, 'g');
  const decoder = new TextDecoder();
  const found = new Set<string>();

  for (const file of files) {
    if (!TEXT_EXTENSIONS.test(file.path) || file.content.byteLength > MAX_SCAN_BYTES) {
      continue;
    }

    const text = decoder.decode(file.content);

    for (const match of text.matchAll(regex)) {
      found.add(match[0]);

      if (found.size >= MAX_URLS) {
        return [...found];
      }
    }
  }

  return [...found];
}

export interface MediaUrlCheck {
  checked: string[];
  broken: Array<{ url: string; status: number | 'timeout' | 'error' }>;
}

export async function verifyMediaUrls(urls: string[]): Promise<MediaUrlCheck> {
  const results = await Promise.all(
    urls.map(async (url): Promise<MediaUrlCheck['broken'][number] | null> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), HEAD_TIMEOUT_MS);

      try {
        const response = await fetch(url, { method: 'HEAD', signal: controller.signal });

        return response.ok ? null : { url, status: response.status };
      } catch {
        return { url, status: controller.signal.aborted ? 'timeout' : 'error' };
      } finally {
        clearTimeout(timeoutId);
      }
    }),
  );

  return { checked: urls, broken: results.filter((r): r is NonNullable<typeof r> => r !== null) };
}
