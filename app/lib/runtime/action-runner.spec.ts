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
