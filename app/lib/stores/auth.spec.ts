// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

/*
 * 로그아웃 시 로컬 대화 기록 삭제 롤백(2026-09-02) — 예전엔 "공용 PC 개인정보" 명목으로 signOut()과
 * SIGNED_OUT 이벤트마다 IndexedDB 대화·스냅샷을 지웠는데, 실제로는 로그아웃할 때마다 대화가 전부
 * 사라지는 프로덕션 버그로 드러났다. 이 스펙은 두 경로 모두 더 이상 로컬 데이터를 건드리지 않는지
 * 확인한다 — platformSupabase/persistence db는 모듈 top-level 싱글턴이라 vi.mock으로 갈아끼운다.
 */

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('auth — 로그아웃해도 로컬 대화 기록을 지우지 않는다', () => {
  afterEach(() => {
    vi.doUnmock('~/lib/supabase/platform-client');
    vi.doUnmock('~/lib/persistence/db');
    vi.resetModules();
  });

  it('signOut()은 세션만 끊고 IndexedDB에는 손대지 않는다', async () => {
    const clearAllChats = vi.fn().mockResolvedValue(undefined);
    const openDatabase = vi.fn();
    const signOutMock = vi.fn().mockResolvedValue({ error: null });

    vi.resetModules();
    vi.doMock('~/lib/persistence/db', () => ({ clearAllChats, openDatabase }));
    vi.doMock('~/lib/supabase/platform-client', () => ({
      platformSupabase: { auth: { signOut: signOutMock } },
    }));

    const { signOut } = await import('./auth');
    await signOut();

    expect(signOutMock).toHaveBeenCalled();
    expect(openDatabase).not.toHaveBeenCalled();
    expect(clearAllChats).not.toHaveBeenCalled();
  });

  it('다른 탭에서의 로그아웃 등 SIGNED_OUT 이벤트에서도 로컬 데이터를 지우지 않는다', async () => {
    const clearAllChats = vi.fn().mockResolvedValue(undefined);
    const openDatabase = vi.fn();

    let authStateCallback: ((event: string, session: unknown) => void) | undefined;

    vi.resetModules();
    vi.doMock('~/lib/persistence/db', () => ({ clearAllChats, openDatabase }));
    vi.doMock('~/lib/supabase/platform-client', () => ({
      platformSupabase: {
        auth: {
          getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
          onAuthStateChange: vi.fn((callback) => {
            authStateCallback = callback;
            return { data: { subscription: { unsubscribe: vi.fn() } } };
          }),
        },
      },
    }));

    const { initAuthListener } = await import('./auth');
    initAuthListener();

    expect(authStateCallback).toBeDefined();
    authStateCallback?.('SIGNED_OUT', null);
    await flushMicrotasks();

    expect(openDatabase).not.toHaveBeenCalled();
    expect(clearAllChats).not.toHaveBeenCalled();
  });
});
