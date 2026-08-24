import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Phase 2 검증 사이클 (감사 대상: 미리보기/워크벤치, 사이클 19) — 파일 저장 후 미리보기 새로고침이
 * `usePreviewStore()`가 만드는, 실제 WebContainer와 연결되지 않은 가짜 싱글턴을 호출해 매 저장마다
 * unhandled promise rejection을 던지고(`#init()`이 `{}.on`을 호출) 새로고침도 아무 동작을 안 하던 문제.
 * `WorkbenchStore`가 이미 들고 있는, 실제 webcontainer와 연결된 인스턴스를 쓰도록 수정.
 * OVERNIGHT5_PROGRESS.md 사이클 19 기록 참고.
 */
describe('워크벤치 — 파일 저장 후 미리보기 새로고침', () => {
  const workbenchClientSource = readFileSync(join(__dirname, 'components/workbench/Workbench.client.tsx'), 'utf-8');
  const workbenchStoreSource = readFileSync(join(__dirname, 'lib/stores/workbench.ts'), 'utf-8');

  it('Workbench.client.tsx는 더 이상 연결 끊긴 usePreviewStore() 싱글턴을 호출하지 않는다', () => {
    expect(workbenchClientSource).not.toContain('usePreviewStore');
  });

  it('onFileSave는 실제 webcontainer와 연결된 workbenchStore를 통해 새로고침한다', () => {
    const onFileSaveIndex = workbenchClientSource.indexOf('const onFileSave = useCallback');
    expect(onFileSaveIndex).toBeGreaterThan(-1);

    const onFileSaveBody = workbenchClientSource.slice(onFileSaveIndex, onFileSaveIndex + 500);
    expect(onFileSaveBody).toContain('workbenchStore.refreshAllPreviews();');
  });

  it('WorkbenchStore#refreshAllPreviews는 자신이 생성한 연결된 #previewsStore로 위임한다', () => {
    expect(workbenchStoreSource).toContain(
      'refreshAllPreviews() {\n    this.#previewsStore.refreshAllPreviews();\n  }',
    );
  });
});
