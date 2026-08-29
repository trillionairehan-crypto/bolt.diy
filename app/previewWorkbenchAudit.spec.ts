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

  /*
   * "새 창/탭에서 열기"를 포함한 미리보기 상단 툴바 전체가 채팅 화면 재설계 라운드에서
   * 삭제됐다 ("사용자가 만든 앱 디자인을 해친다. 미리보기는 앱 화면만 보여준다") — 이 항목이
   * 검증하던 openInNewWindow/openInNewTab과 그 토스트 처리도 함께 사라졌다.
   */
});
