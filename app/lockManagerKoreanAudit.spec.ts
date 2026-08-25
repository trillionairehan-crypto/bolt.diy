import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Phase 2 검증 사이클 (감사 대상: 미리보기/워크벤치, 사이클 42) — LockManager.tsx(설정 >
 * 잠금 탭)가 검색 placeholder/필터 옵션/토스트/빈 상태/버튼/footer까지 전체가 영어로
 * 하드코딩돼 있던 문제. EditorPanel.tsx의 "Locks" 탭에서 항상 렌더되는 실사용 표면.
 */
describe('LockManager — 잠금 관리 UI 문구가 한국어다', () => {
  const source = readFileSync(join(__dirname, 'components/workbench/LockManager.tsx'), 'utf-8');

  it('영어 하드코딩 문구가 남아있지 않다', () => {
    expect(source).not.toContain('placeholder="Search...');
    expect(source).not.toContain('>All<');
    expect(source).not.toContain('>Files<');
    expect(source).not.toContain('>Folders<');
    expect(source).not.toContain('No items selected to unlock.');
    expect(source).not.toContain('Unlocked ${unlockedCount} selected item(s).');
    expect(source).not.toContain('Unlock all');
    expect(source).not.toContain('No locked items found');
    expect(source).not.toContain('title="Unlock"');
    expect(source).not.toContain('unlocked`)');
    expect(source).not.toContain('item(s) •');
  });

  it('잠금 해제 확인/성공 토스트가 한국어다', () => {
    expect(source).toContain('잠금 해제할 항목을 선택해 주세요.');
    expect(source).toContain('선택한 항목 ${unlockedCount}개의 잠금을 해제했어요.');
  });
});
