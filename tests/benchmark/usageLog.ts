/**
 * api.chat.ts는 스트림으로 promptTokens/completionTokens/totalTokens만 클라이언트에 보낸다
 * (data-usage 이벤트) — 캐시 read/write 토큰 분해는 서버 콘솔에만 `logger.debug('usage',
 * JSON.stringify(usage))`로 찍힌다(app/routes/api.chat.ts:268). dev 서버가 --experimental
 * 없이 그냥 콘솔로 로그를 쓰므로, 순차 실행(동시 요청 없음)이라는 전제 하에 "요청 보내기 직전 로그
 * 파일 크기" ~ "응답 받은 직후"까지 새로 추가된 부분만 읽어 usage JSON을 뽑는다.
 */
import { readFileSync, statSync } from 'node:fs';

export interface CacheUsage {
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export function logSizeNow(logPath: string): number {
  try {
    return statSync(logPath).size;
  } catch {
    return 0;
  }
}

const USAGE_LINE_REGEX = /usage\s+(\{[^\n]*\})/g;

export function extractCacheUsageSince(logPath: string, offsetBytes: number): CacheUsage | null {
  let raw: string;

  try {
    const buf = readFileSync(logPath);
    raw = buf.subarray(offsetBytes).toString('utf-8');
  } catch {
    return null;
  }

  const stripped = raw.replace(/\x1b\[[0-9;]*m/g, ''); // ANSI 색 코드 제거(chalk).

  let last: CacheUsage | null = null;

  for (const match of stripped.matchAll(USAGE_LINE_REGEX)) {
    try {
      const parsed = JSON.parse(match[1]);
      const cacheReadTokens = parsed?.inputTokenDetails?.cacheReadTokens ?? parsed?.cachedInputTokens ?? 0;
      const cacheWriteTokens = parsed?.inputTokenDetails?.cacheWriteTokens ?? 0;
      last = { cacheReadTokens, cacheWriteTokens };
    } catch {
      continue;
    }
  }

  return last;
}
