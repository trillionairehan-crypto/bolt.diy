import { describe, expect, it } from 'vitest';
import { ActionRunner } from './action-runner';
import type { ActionCallbackData } from './message-parser';

function createMockWebcontainer(overrides: { writeFile?: () => Promise<void>; mkdir?: () => Promise<void> } = {}) {
  return {
    workdir: '/home/project',
    fs: {
      mkdir: overrides.mkdir ?? (async () => undefined),
      writeFile: overrides.writeFile ?? (async () => undefined),
    },
  } as any;
}

function fileActionData(overrides: Partial<ActionCallbackData> = {}): ActionCallbackData {
  return {
    artifactId: 'artifact-1',
    messageId: 'message-1',
    actionId: 'action-1',
    action: { type: 'file', filePath: '/home/project/src/App.tsx', content: 'export default function App() {}' },
    ...overrides,
  };
}

/*
 * 2026-09-18 dev 서버 사망 복구. 가짜 셸: executeCommand는 실제 BoltShell처럼 옛 abort 콜백을 먼저 부르고
 * 명령을 기록한 뒤, dev 서버답게 끝나지 않는다(never-resolving).
 */
function createMockShell() {
  const commands: string[] = [];
  const shell: any = {
    process: {},
    terminal: {},
    executionState: {
      value: undefined as any,
      get() {
        return this.value;
      },
      set(v: any) {
        this.value = v;
      },
    },
    ready: async () => undefined,
    executeCommand: async (sessionId: string, command: string, abort?: () => void) => {
      const state = shell.executionState.get();

      if (state?.active && state.abort) {
        state.abort();
      }

      commands.push(command);
      shell.executionState.set({ sessionId, active: true, abort });

      return new Promise(() => {});
    },
  };

  return { shell, commands };
}

describe('ActionRunner.restartStartAction', () => {
  it('start 액션을 다시 띄우면 상태가 running으로 유지되고 명령이 다시 나간다', async () => {
    const { shell, commands } = createMockShell();
    const runner = new ActionRunner(Promise.resolve(createMockWebcontainer()), () => shell);
    const data: ActionCallbackData = {
      artifactId: 'artifact-1',
      messageId: 'message-1',
      actionId: 'start-1',
      action: { type: 'start', content: 'npm run dev' },
    };

    runner.addAction(data);
    await runner.runAction(data);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(commands).toEqual(['npm run dev']);
    expect(runner.actions.get()['start-1'].status).toBe('running');

    expect(runner.restartStartAction('start-1')).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(commands).toEqual(['npm run dev', 'npm run dev']);
    expect(runner.actions.get()['start-1'].status).toBe('running');
  });

  it('start가 아니거나 없는 액션은 false', () => {
    const { shell } = createMockShell();
    const runner = new ActionRunner(Promise.resolve(createMockWebcontainer()), () => shell);
    const data = fileActionData();

    runner.addAction(data);

    expect(runner.restartStartAction(data.actionId)).toBe(false);
    expect(runner.restartStartAction('nope')).toBe(false);
  });
});

describe('ActionRunner file action failures', () => {
  it('marks the action failed (not complete) when webcontainer.fs.writeFile rejects', async () => {
    const webcontainer = createMockWebcontainer({
      writeFile: async () => {
        throw new Error('ENOSPC: no space left on device');
      },
    });
    const runner = new ActionRunner(Promise.resolve(webcontainer), () => ({}) as any);
    const data = fileActionData();

    runner.addAction(data);
    await runner.runAction(data);

    expect(runner.actions.get()[data.actionId].status).toBe('failed');
  });

  it('marks the action failed (not complete) when webcontainer.fs.mkdir rejects', async () => {
    const webcontainer = createMockWebcontainer({
      mkdir: async () => {
        throw new Error('EACCES: permission denied');
      },
    });
    const runner = new ActionRunner(Promise.resolve(webcontainer), () => ({}) as any);
    const data = fileActionData();

    runner.addAction(data);
    await runner.runAction(data);

    expect(runner.actions.get()[data.actionId].status).toBe('failed');
  });

  it('marks the action complete when the write actually succeeds', async () => {
    const webcontainer = createMockWebcontainer();
    const runner = new ActionRunner(Promise.resolve(webcontainer), () => ({}) as any);
    const data = fileActionData();

    runner.addAction(data);
    await runner.runAction(data);

    expect(runner.actions.get()[data.actionId].status).toBe('complete');
  });
});
