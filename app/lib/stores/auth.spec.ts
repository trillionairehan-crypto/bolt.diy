// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

/*
 * 로그아웃 시 로컬 대화 기록 노출 버그 수정 — 로그아웃하면 IndexedDB의 대화·스냅샷이 지워지는지,
 * 그리고 명시적 signOut() 호출뿐 아니라(로그아웃 확인 다이얼로그 경로) 다른 탭에서의 로그아웃·
 * 세션 만료 같은 SIGNED_OUT 이벤트에서도 똑같이 지워지는지 확인한다. platformSupabase/persistence
 * db는 모듈 top-level 싱글턴이라 vi.mock으로 갈아끼운다 — freeTrial.spec.ts와 같은 로컬 모킹
 * 패턴, 다른 파일에 영향 없음.
 */

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('auth — 로그아웃 시 로컬 대화 기록 정리', () => {
  afterEach(() => {
    vi.doUnmock('~/lib/supabase/platform-client');
    vi.doUnmock('~/lib/persistence/db');
    vi.resetModules();
  });

  it('signOut()은 세션을 끊은 뒤 IndexedDB 대화 기록을 지운다', async () => {
    const fakeDb = {} as IDBDatabase;
    const clearAllChats = vi.fn().mockResolvedValue(undefined);
    const openDatabase = vi.fn().mockResolvedValue(fakeDb);
    const signOutMock = vi.fn().mockResolvedValue({ error: null });

    vi.resetModules();
    vi.doMock('~/lib/persistence/db', () => ({ clearAllChats, openDatabase }));
    vi.doMock('~/lib/supabase/platform-client', () => ({
      platformSupabase: { auth: { signOut: signOutMock } },
    }));

    const { signOut } = await import('./auth');
    await signOut();

    expect(signOutMock).toHaveBeenCalled();
    expect(openDatabase).toHaveBeenCalled();
    expect(clearAllChats).toHaveBeenCalledWith(fakeDb);
  });

  it('다른 탭에서의 로그아웃 등 SIGNED_OUT 이벤트에서도 똑같이 지운다(명시적 signOut() 호출 없이도)', async () => {
    const fakeDb = {} as IDBDatabase;
    const clearAllChats = vi.fn().mockResolvedValue(undefined);
    const openDatabase = vi.fn().mockResolvedValue(fakeDb);

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

    expect(openDatabase).toHaveBeenCalled();
    expect(clearAllChats).toHaveBeenCalledWith(fakeDb);
  });

  it('SIGNED_IN 등 로그아웃이 아닌 이벤트에서는 지우지 않는다', async () => {
    const clearAllChats = vi.fn().mockResolvedValue(undefined);
    const openDatabase = vi.fn().mockResolvedValue({} as IDBDatabase);

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

    authStateCallback?.('SIGNED_IN', { user: { id: 'u1' } });
    await flushMicrotasks();

    expect(clearAllChats).not.toHaveBeenCalled();
  });

  it('clearLocalChatHistory는 실패해도 던지지 않는다(로그아웃 자체를 막지 않음)', async () => {
    const openDatabase = vi.fn().mockRejectedValue(new Error('boom'));
    const clearAllChats = vi.fn();

    vi.resetModules();
    vi.doMock('~/lib/persistence/db', () => ({ clearAllChats, openDatabase }));
    vi.doMock('~/lib/supabase/platform-client', () => ({
      platformSupabase: null,
    }));

    const { clearLocalChatHistory } = await import('./auth');

    await expect(clearLocalChatHistory()).resolves.toBeUndefined();
  });
});
