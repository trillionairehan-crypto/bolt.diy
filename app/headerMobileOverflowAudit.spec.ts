import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Phase 2 검증 사이클 (감사 대상: 모바일, 6회차) — 랜딩 헤더(홈 화면, chat.started===false)에서
 * 로그인 사용자에게 "요금제" 링크 + 테마 토글 + "내 프로젝트" 텍스트+아바타 알약 버튼이
 * flex-wrap/축소 없이 한 줄로 나열돼, 375px 뷰포트에서 폭 합이 ~388px로 뷰포트를 넘치던 문제.
 * OVERNIGHT5_PROGRESS.md 해당 사이클 기록 참고.
 *
 * 채팅 홈 화면/사이드바 재설계로 "요금제" 링크와 "내 프로젝트" 알약 버튼(가변 폭 텍스트 라벨)은
 * 헤더에서 완전히 사라지고 고정 크기(32px) 아이콘 버튼 하나로 대체됐다 — 넘칠 만한 가변폭
 * 텍스트가 이제 헤더 오른쪽에 없으므로 이 문제 자체가 구조적으로 재발할 수 없다.
 */
describe('Header.tsx 오른쪽 컨트롤이 좁은 화면에서 넘치지 않는다', () => {
  it('프로필 버튼이 라벨 없는 고정 크기 아이콘 버튼이라 넘칠 가변폭 텍스트가 없다', () => {
    const source = readFileSync(join(__dirname, 'components/header/Header.tsx'), 'utf-8');

    expect(source).toContain('aria-label="프로필"');
    expect(source).toContain('w-8 h-8 rounded-full');
    expect(source).not.toContain('내 프로젝트');
  });
});

/**
 * 검증 사이클(감사 대상: 모바일) — 채팅 시작 후 헤더의 `flex-1` 제목 span에 `min-w-0`이 없어서
 * `truncate`가 flex 행 안에서 실제로 작동하지 않던 문제. flex 아이템의 기본 min-width는 auto라
 * 내용(긴 채팅 제목) 폭 아래로 안 줄어들고, `index.scss`의 전역 `overflow-x: hidden`이 스크롤바
 * 대신 조용히 클리핑을 일으켜 좁은 화면(폰 폭)에서 오른쪽의 테마 토글/배포 버튼이 화면 밖으로
 * 밀려 눌리지 않게 되던 문제.
 */
describe('Header.tsx 채팅 헤더의 제목이 flex 행에서 실제로 줄임(truncate)된다', () => {
  it('제목 span에 min-w-0이 있어 flex-1이 내용 폭 아래로 줄어들 수 있다', () => {
    const source = readFileSync(join(__dirname, 'components/header/Header.tsx'), 'utf-8');

    expect(source).toContain('className="flex-1 min-w-0 px-4 truncate text-center"');
  });
});
