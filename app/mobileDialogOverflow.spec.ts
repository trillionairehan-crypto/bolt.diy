import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Phase 2 검증 사이클 (감사 대상: 모바일) — 두 다이얼로그가 375px 모바일 뷰포트에서
 * 뷰포트 밖으로 넘치던 버그. OVERNIGHT5_PROGRESS.md 해당 사이클 기록 참고.
 */
describe('모바일 뷰포트에서 다이얼로그가 넘치지 않는다', () => {
  it('ControlPanel.tsx 설정 모달이 고정폭이 아니라 뷰포트 상대 너비를 쓴다', () => {
    const source = readFileSync(join(__dirname, 'components/@settings/core/ControlPanel.tsx'), 'utf-8');
    expect(source).not.toContain("'w-[1200px] h-[90vh]'");
    expect(source).toContain('w-[95vw]');

    /*
     * 설정 패널 재설계: 최대폭이 항목 4-1 요청으로 1200px → 960px로 줄었다(3탭 고정 레이아웃엔
     * 그 정도로 충분 — 전 화면을 덮어 빈 공간이 많던 문제). "고정폭 아니라 뷰포트 상대"라는 이
     * 테스트의 취지 자체는 그대로라 값만 갱신.
     */
    expect(source).toContain('max-w-[960px]');
  });

  it('ColorSchemeDialog.tsx가 min-w-[480px]를 max-w-[90vw]와 무조건 충돌시키지 않는다 (min-width는 CSS에서 max-width보다 우선하므로 모바일에서 min-w만 무조건 적용되면 넘침)', () => {
    const source = readFileSync(join(__dirname, 'components/ui/ColorSchemeDialog.tsx'), 'utf-8');
    expect(source).not.toMatch(/className="py-4 px-4 min-w-\[480px\]/);
    expect(source).toContain('sm:min-w-[480px]');
    expect(source).toContain('max-w-[90vw]');
  });
});
