import { beforeEach, describe, expect, it } from 'vitest';
import { devServerCrashAtom, noteDevServerOutput, resetDevServerHealth } from './devServerHealth';

/* 2026-09-18 프로덕션 터미널 실측 문구. */
const CRASH_LINE = '\u001b[31m오후 1:47:12 [vite] Pre-transform error: The service was stopped (x17)\u001b[0m\r\n';

describe('noteDevServerOutput', () => {
  beforeEach(() => resetDevServerHealth());

  it('vite/esbuild 사망 문구를 잡고 ANSI를 벗긴 줄을 남긴다', () => {
    expect(noteDevServerOutput(CRASH_LINE, 1_000)).toBe(true);

    const crash = devServerCrashAtom.get();
    expect(crash?.count).toBe(1);
    expect(crash?.sample).toBe('오후 1:47:12 [vite] Pre-transform error: The service was stopped (x17)');
  });

  it('10초 안의 반복(x17 같은 연속 출력)은 한 번으로 센다', () => {
    noteDevServerOutput(CRASH_LINE, 1_000);
    expect(noteDevServerOutput(CRASH_LINE, 5_000)).toBe(false);
    expect(devServerCrashAtom.get()?.count).toBe(1);

    expect(noteDevServerOutput(CRASH_LINE, 12_000)).toBe(true);
    expect(devServerCrashAtom.get()?.count).toBe(2);
  });

  it('잘못된 import로 인한 Pre-transform error는 사망이 아니다 (2026-09-20 실생성 오탐)', () => {
    expect(
      noteDevServerOutput(
        '[vite] Pre-transform error: Failed to resolve import "./kit/CustomCursor" from "src/App.tsx"',
        1_000,
      ),
    ).toBe(false);
    expect(devServerCrashAtom.get()).toBeNull();
  });

  it('정상 출력은 건드리지 않는다', () => {
    expect(noteDevServerOutput('VITE v5.4.21 ready in 1541 ms\r\n  ➜  Local: http://localhost:5173/', 1_000)).toBe(
      false,
    );
    expect(devServerCrashAtom.get()).toBeNull();
  });
});
