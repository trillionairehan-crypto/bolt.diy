import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Phase 2 사이클 30 (감사 대상: 다크모드, 4회차) — 사이드바 하단 설정/도움말 아이콘 버튼이
 * 바로 옆(같은 줄) "내 앱" 링크와 달리 dark: 변형 없이 라이트 전용 #666 고정색만 써서
 * 다크모드에서 저대비로 흐릿하게 보이던 문제. GitHub 설정 탭의 캐시 "전체 삭제" 버튼도
 * 같은 파일의 성공 알림 박스와 달리 red 계열 텍스트/보더 색상에 dark: 변형이 빠져있던 문제.
 * OVERNIGHT5_PROGRESS.md 사이클 30 기록 참고.
 */
describe('SettingsButton.tsx 아이콘 버튼이 다크모드 색상 변형을 갖는다', () => {
  const source = readFileSync(join(__dirname, 'components/ui/SettingsButton.tsx'), 'utf-8');

  it('SettingsButton has a dark: variant next to its light-mode #666 color', () => {
    const match = source.match(/data-testid="settings-button"[\s\S]*?className="([^"]+)"/);
    expect(match).not.toBeNull();
    expect(match?.[1]).toContain('text-[#666]');
    expect(match?.[1]).toContain('dark:text-gray-500');
  });

  it('HelpButton has a dark: variant next to its light-mode #666 color', () => {
    const match = source.match(/data-testid="help-button"[\s\S]*?className="([^"]+)"/);
    expect(match).not.toBeNull();
    expect(match?.[1]).toContain('text-[#666]');
    expect(match?.[1]).toContain('dark:text-gray-500');
  });
});

describe('GitHubCacheManager.tsx "전체 삭제" 버튼이 다크모드 red 색상 변형을 갖는다', () => {
  const source = readFileSync(
    join(__dirname, 'components/@settings/tabs/github/components/GitHubCacheManager.tsx'),
    'utf-8',
  );

  it('Clear All button text/border colors have dark: variants', () => {
    const match = source.match(/onClick=\{handleClearAll\}[\s\S]*?className="([^"]+)"/);
    expect(match).not.toBeNull();
    expect(match?.[1]).toContain('dark:text-red-400');
    expect(match?.[1]).toContain('dark:hover:text-red-300');
    expect(match?.[1]).toContain('dark:border-red-800/60');
    expect(match?.[1]).toContain('dark:hover:border-red-700');
  });
});
