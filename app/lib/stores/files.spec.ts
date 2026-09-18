import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WebContainer } from '@webcontainer/api';
import { FilesStore } from './files';

vi.mock('@sentry/remix', () => ({ captureMessage: vi.fn() }));

/*
 * 2026-09-18 post-stream stall 원인 재현 — WorkbenchStore._runAction → saveFile 경로에서
 * (1) 스트리밍으로 방금 생긴 파일이 워처보다 먼저 저장되면 unreachable을 던져 전역 큐가 죽었고
 * (2) webcontainer.fs.writeFile이 응답 없이 멈추면 액션이 'running'에 영영 남았다.
 */
function fakeWebContainer(writeFile: (path: string, content: string) => Promise<void>) {
  return {
    workdir: '/home/project',
    fs: { writeFile, readFile: vi.fn(), readdir: vi.fn(), mkdir: vi.fn(), rm: vi.fn() },
    internal: { watchPaths: vi.fn() },
  } as unknown as WebContainer;
}

describe('FilesStore.saveFile', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('워처가 아직 못 올린 새 파일도 저장한다 (예전엔 unreachable → 큐 사망)', async () => {
    const writeFile = vi.fn(async () => {});
    const store = new FilesStore(Promise.resolve(fakeWebContainer(writeFile)));

    await expect(store.saveFile('/home/project/src/App.tsx', 'export default 1;')).resolves.toBeUndefined();

    expect(writeFile).toHaveBeenCalledWith('src/App.tsx', 'export default 1;');
    expect(store.getFile('/home/project/src/App.tsx')?.content).toBe('export default 1;');
  });

  it('writeFile 응답이 안 오면 타임아웃 뒤 진행한다 — 영원히 기다리지 않는다', async () => {
    vi.useFakeTimers();

    const never = () => new Promise<void>(() => {});
    const store = new FilesStore(Promise.resolve(fakeWebContainer(never)));

    const saving = store.saveFile('/home/project/src/App.tsx', 'export default 2;');
    let settled = false;
    void saving.then(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(19_000);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(2_000);
    expect(settled).toBe(true);
    expect(store.getFile('/home/project/src/App.tsx')?.content).toBe('export default 2;');
  });
});
