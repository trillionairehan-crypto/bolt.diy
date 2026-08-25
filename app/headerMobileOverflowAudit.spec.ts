import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Phase 2 검증 사이클 (감사 대상: 모바일, 6회차) — 랜딩 헤더(홈 화면, chat.started===false)에서
 * 로그인 사용자에게 "요금제" 링크 + 테마 토글 + "내 프로젝트" 텍스트+아바타 알약 버튼이
 * flex-wrap/축소 없이 한 줄로 나열돼, 375px 뷰포트에서 폭 합이 ~388px로 뷰포트를 넘치던 문제.
 * OVERNIGHT5_PROGRESS.md 해당 사이클 기록 참고.
 */
describe('Header.tsx 랜딩 헤더의 로그인 알약 버튼이 좁은 화면에서 넘치지 않는다', () => {
  it('"내 프로젝트" 라벨이 sm 미만에서 숨겨지고 title로 접근성이 유지된다', () => {
    const source = readFileSync(join(__dirname, 'components/header/Header.tsx'), 'utf-8');

    expect(source).toContain('title="내 프로젝트"');
    expect(source).toContain('<span className="hidden sm:inline">내 프로젝트</span>');
  });

  it('알약 버튼 좌측 패딩이 sm 미만에서 줄어들어 아바타만 남았을 때 여백이 과하지 않다', () => {
    const source = readFileSync(join(__dirname, 'components/header/Header.tsx'), 'utf-8');

    expect(source).not.toContain('pl-4 pr-1.5 py-1.5 hover:opacity-90');
    expect(source).toContain('pl-1.5 pr-1.5 py-1.5 sm:pl-4');
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

    expect(source).toContain('className="flex-1 min-w-0 px-4 truncate text-center text-bolt-elements-textPrimary"');
  });
});
