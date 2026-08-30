import { describe, expect, it } from 'vitest';
import type { ActionState } from '~/lib/runtime/action-runner';
import { getGenerationPhaseLabel } from './Artifact';

/*
 * 채팅 홈·생성 전환 통합 수정 — getGenerationPhaseLabel의 3단계 휴리스틱 검증. 파일 경로는
 * 판단에만 쓰고 반환값(화면 문구)엔 절대 나타나지 않는다는 것도 함께 확인한다.
 */
function action(overrides: Partial<ActionState> & Pick<ActionState, 'type' | 'status'>): ActionState & { id: string } {
  return {
    id: 'test-action',
    content: '',
    abort: () => {},
    executed: false,
    abortSignal: new AbortController().signal,
    ...overrides,
  } as ActionState & { id: string };
}

describe('getGenerationPhaseLabel', () => {
  it('액션이 없으면 "만들고 있어요"를 반환한다', () => {
    expect(getGenerationPhaseLabel([])).toBe('만들고 있어요');
  });

  it('진행 중인 파일 액션이 UI 경로면 "화면을 만들고 있어요"를 반환한다', () => {
    const actions = [action({ type: 'file', filePath: 'src/pages/HomePage.tsx', status: 'running' })];
    expect(getGenerationPhaseLabel(actions)).toBe('화면을 만들고 있어요');
  });

  it('진행 중인 파일 액션이 저장/데이터 경로면 "저장 기능을 붙이고 있어요"를 반환하고 경로 자체는 노출하지 않는다', () => {
    const actions = [action({ type: 'file', filePath: 'src/lib/db/reservations.ts', status: 'running' })];
    const label = getGenerationPhaseLabel(actions);
    expect(label).toBe('저장 기능을 붙이고 있어요');
    expect(label).not.toContain('reservations.ts');
    expect(label).not.toContain('/');
  });

  it('shell/start 액션이 진행 중이면 "마무리하고 있어요"를 반환한다', () => {
    const actions = [action({ type: 'shell', status: 'running' })];
    expect(getGenerationPhaseLabel(actions)).toBe('마무리하고 있어요');
  });

  it('가장 최근 진행 중인 파일 액션을 우선한다', () => {
    const actions = [
      action({ type: 'file', filePath: 'src/pages/HomePage.tsx', status: 'complete' }),
      action({ type: 'file', filePath: 'src/lib/db/reservations.ts', status: 'running' }),
    ];
    expect(getGenerationPhaseLabel(actions)).toBe('저장 기능을 붙이고 있어요');
  });

  it('완료된 액션만 있으면 "만들고 있어요"로 폴백한다', () => {
    const actions = [action({ type: 'file', filePath: 'src/pages/HomePage.tsx', status: 'complete' })];
    expect(getGenerationPhaseLabel(actions)).toBe('만들고 있어요');
  });
});
