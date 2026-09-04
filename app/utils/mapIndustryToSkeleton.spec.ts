import { describe, expect, it, vi, afterEach } from 'vitest';
import { mapIndustryToSkeleton } from './mapIndustryToSkeleton';

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

function mockFetchOnce(response: { ok: boolean; json?: () => Promise<unknown> }) {
  global.fetch = vi.fn().mockResolvedValue(response) as unknown as typeof fetch;
}

describe('mapIndustryToSkeleton', () => {
  it('returns the mapped gridItemId + skeleton on a clean JSON response', async () => {
    mockFetchOnce({
      ok: true,
      json: async () => ({ text: JSON.stringify({ gridItemId: 'cafe', skeleton: 7 }) }),
    });

    const result = await mapIndustryToSkeleton('배달 도시락 가게');
    expect(result).toEqual({ gridItemId: 'cafe', skeleton: 7 });
  });

  it('strips a markdown code fence around the JSON', async () => {
    mockFetchOnce({
      ok: true,
      json: async () => ({ text: '```json\n{"gridItemId": "fitness", "skeleton": 1}\n```' }),
    });

    const result = await mapIndustryToSkeleton('필라테스 스튜디오');
    expect(result).toEqual({ gridItemId: 'fitness', skeleton: 1 });
  });

  it('falls back to 기타(null/null) when the response is not ok', async () => {
    mockFetchOnce({ ok: false });

    const result = await mapIndustryToSkeleton('아무거나');
    expect(result).toEqual({ gridItemId: null, skeleton: null });
  });

  it('falls back to 기타 when the JSON fails schema validation (bad skeleton range)', async () => {
    mockFetchOnce({
      ok: true,
      json: async () => ({ text: JSON.stringify({ gridItemId: 'cafe', skeleton: 99 }) }),
    });

    const result = await mapIndustryToSkeleton('업종 불명');
    expect(result).toEqual({ gridItemId: null, skeleton: null });
  });

  it('falls back to 기타 when gridItemId is not one of the real Q3_GRID ids (hallucinated id)', async () => {
    mockFetchOnce({
      ok: true,
      json: async () => ({ text: JSON.stringify({ gridItemId: 'not-a-real-id', skeleton: null }) }),
    });

    const result = await mapIndustryToSkeleton('업종 불명');
    expect(result.gridItemId).toBeNull();
  });

  it('falls back to 기타 when fetch throws (network error / abort)', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;

    const result = await mapIndustryToSkeleton('업종 불명');
    expect(result).toEqual({ gridItemId: null, skeleton: null });
  });

  it('does not call fetch at all for empty/whitespace input', async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    const result = await mapIndustryToSkeleton('   ');
    expect(result).toEqual({ gridItemId: null, skeleton: null });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('LLM explicitly returning null/null (ambiguous input) is honored as 기타 + 골격 미지정', async () => {
    mockFetchOnce({
      ok: true,
      json: async () => ({ text: JSON.stringify({ gridItemId: null, skeleton: null }) }),
    });

    const result = await mapIndustryToSkeleton('그냥 뭔가');
    expect(result).toEqual({ gridItemId: null, skeleton: null });
  });
});
