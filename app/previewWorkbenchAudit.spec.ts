import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Phase 2 검증 사이클 (감사 대상: 미리보기/워크벤치) — 사이클 11.
 * OVERNIGHT5_PROGRESS.md 해당 사이클 기록 참고.
 */
describe('미리보기/워크벤치 감사 — 사이클 11', () => {
  it('ExpoQrModal.tsx: 안내 문구가 영어가 아니라 한국어다', () => {
    const source = readFileSync(join(__dirname, 'components/workbench/ExpoQrModal.tsx'), 'utf-8');
    expect(source).not.toContain('Preview on your own mobile device');
    expect(source).not.toContain('Scan this QR code with the Expo Go app');
    expect(source).not.toContain('No Expo URL detected.');
    expect(source).toContain('내 모바일 기기에서 미리보기');
    expect(source).toContain('Expo 주소를 찾을 수 없어요.');
  });

  it('TerminalTabs.tsx: 추가 터미널 탭 이름이 "Terminal"이 아니라 "터미널"이다', () => {
    const source = readFileSync(join(__dirname, 'components/workbench/terminal/TerminalTabs.tsx'), 'utf-8');
    expect(source).not.toContain('Terminal {terminalCount > 1 && index}');
    expect(source).toContain('터미널 {terminalCount > 1 && index}');
  });

  it('Preview.tsx: "새 창/탭에서 열기"가 실패해도 콘솔 로그만이 아니라 사용자에게 토스트로 알린다', () => {
    const source = readFileSync(join(__dirname, 'components/workbench/Preview.tsx'), 'utf-8');
    expect(source).toContain("import { toast } from 'react-toastify';");
    expect(source).toContain('팝업이 차단되어 새 창을 열 수 없어요');
    expect(source).toContain('열 수 있는 미리보기가 없어요');

    // 두 곳(openInNewWindow, 인라인 "새 창에서 열기" 핸들러) 모두에서 잘못된 URL을 사용자에게 알린다
    const invalidUrlToastPattern = /미리보기 주소를 확인할 수 없어요\. 잠시 후 다시 시도해 주세요\./g;
    const invalidUrlToastCount = (source.match(invalidUrlToastPattern) || []).length;
    expect(invalidUrlToastCount).toBe(2);
  });
});
