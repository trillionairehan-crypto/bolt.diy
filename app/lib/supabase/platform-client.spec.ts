// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { callPlatformRpc } from './platform-client';

/*
 * 미터링 재로그인 버그 원인 확정 후 수정 — callPlatformRpc()가 supabase-js의 공유 클라이언트
 * 인스턴스를 거치지 않고 access_token을 Authorization 헤더에 직접 실어 fetch하는지 확인한다.
 * freeTrial.spec.ts가 호출부(getV2AccountGenerationStatus 등)를 이 함수째로 모킹해 검증하는 것과
 * 달리, 여기서는 이 함수 자체가 실제로 만드는 요청(URL·헤더·에러 처리)을 확인한다.
 */
describe('callPlatformRpc', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('전달받은 access_token을 Authorization 헤더에 그대로 실어 rest/v1/rpc/<fn>에 POST한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ monthRemaining: 2 }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await callPlatformRpc<{ monthRemaining: number }>('get_generation_status_v2', 'token-abc');

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [requestUrl, requestInit] = fetchMock.mock.calls[0];
    expect(String(requestUrl)).toMatch(/\/rest\/v1\/rpc\/get_generation_status_v2$/);
    expect(requestInit.method).toBe('POST');
    expect(requestInit.headers.Authorization).toBe('Bearer token-abc');
    expect(requestInit.headers.apikey).toBeTruthy();
    expect(result).toEqual({ data: { monthRemaining: 2 }, error: null });
  });

  it('응답이 실패하면 본문 텍스트를 에러 메시지로 담아 반환한다(던지지 않는다)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      statusText: 'Unauthorized',
      text: () => Promise.resolve('JWT expired'),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await callPlatformRpc('get_generation_status_v2', 'token-abc');

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('JWT expired');
  });
});
