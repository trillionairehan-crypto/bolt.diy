import { describe, expect, it, vi } from 'vitest';

const insertMock = vi.fn(async () => ({ error: null }));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({ insert: insertMock }),
  }),
}));

const { recordMessageUsageInBackground } = await import('./messageUsage');

const ENV = { VITE_PLATFORM_SUPABASE_URL: 'https://x.supabase.co', PLATFORM_SUPABASE_SERVICE_ROLE_KEY: 'key' };

function entry(chatId: string) {
  return {
    userId: null,
    chatId,
    messageId: 'm1',
    promptTokens: 1,
    completionTokens: 1,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    model: 'test-model',
    isAutoFix: false,
  };
}

/*
 * 실측(2026-09-04): api.chat.ts/api.llmcall.ts 둘 다 `void recordMessageUsage(...)`로만 던졌는데,
 * Cloudflare Workers 런타임은 ctx.waitUntil()로 등록되지 않은 대기 중 작업을 응답이 끝나면 취소할
 * 수 있어 프로덕션에서 유실될 위험이 있었다. 이 테스트는 waitUntil이 있으면 실제로 그걸 거쳐 등록되고
 * (fire-and-forget으로 그냥 흘려보내지 않고), 없으면 예외 없이 fire-and-forget으로 떨어지는지만
 * 확인한다 — 실제 Supabase insert 성공/실패 여부는 messageUsage.spec.ts의 관심사가 아니다.
 */
describe('recordMessageUsageInBackground', () => {
  it('registers the recording promise via ctx.waitUntil when ctx is available', () => {
    const waitUntil = vi.fn();
    const ctx = { waitUntil, passThroughOnException: vi.fn(), props: undefined } as unknown as ExecutionContext;

    recordMessageUsageInBackground(entry('41'), ENV, ctx);

    expect(waitUntil).toHaveBeenCalledTimes(1);
    expect(waitUntil.mock.calls[0][0]).toBeInstanceOf(Promise);
  });

  it('does not throw when ctx is undefined (local dev) — falls back to fire-and-forget', () => {
    expect(() => recordMessageUsageInBackground(entry('42'), ENV, undefined)).not.toThrow();
  });

  it('does not throw when ctx is present but waitUntil is missing', () => {
    const ctx = {} as unknown as ExecutionContext;
    expect(() => recordMessageUsageInBackground(entry('43'), ENV, ctx)).not.toThrow();
  });
});
