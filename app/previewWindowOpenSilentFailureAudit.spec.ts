import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * 미리보기/워크벤치 감사(사이클 50) — Preview.tsx의 window.open() 반환값을 확인하지 않아
 * 팝업이 차단되면 아무 안내 없이 조용히 실패하던 두 곳(기기 프레임 없는 "새 창에서 보기",
 * 창크기 드롭다운의 "새 창에서 열기") 수정 확인. 기기 프레임 있는 분기는 이미 사이클 11에서
 * toast.error 처리돼 있었음 — OVERNIGHT5_IMPROVEMENTS.md 항목 31 참고.
 */
describe('미리보기/워크벤치 감사(사이클 50) — window.open 실패 시 무음 실패 방지', () => {
  const source = readFileSync(join(__dirname, 'components/workbench/Preview.tsx'), 'utf-8');

  it('세 곳(기기 프레임 분기, 프레임 없는 분기, 창크기 드롭다운) 모두 팝업 차단 시 토스트로 알린다', () => {
    const popupBlockedToastPattern = /팝업이 차단되어 새 창을 열 수 없어요\. 브라우저의 팝업 차단을 해제해 주세요\./g;
    const count = (source.match(popupBlockedToastPattern) || []).length;
    expect(count).toBe(3);
  });

  it('프레임 없는 표준 창 분기가 newWindow를 focus하기 전에 null 여부를 확인한다', () => {
    const standardWindowBranch = source.slice(source.indexOf('// Standard window without frame'));
    const branchSnippet = standardWindowBranch.slice(0, standardWindowBranch.indexOf('openInNewTab'));

    expect(branchSnippet).toContain('newWindow.focus()');
    expect(branchSnippet).toContain(
      "toast.error('팝업이 차단되어 새 창을 열 수 없어요. 브라우저의 팝업 차단을 해제해 주세요.')",
    );
  });
});
