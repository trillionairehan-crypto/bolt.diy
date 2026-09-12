import { describe, expect, it } from 'vitest';
import { isCinematicProject } from './isCinematicProject';
import { getFineTunedPrompt } from '~/lib/common/prompts/new-prompt';

describe('isCinematicProject', () => {
  it('킷이 시드된 프로젝트를 알아본다', () => {
    expect(isCinematicProject({ '/home/project/src/kit/tokens.css': {}, '/home/project/src/App.tsx': {} })).toBe(true);
  });

  it('킷이 없으면 false', () => {
    expect(isCinematicProject({ '/home/project/src/App.tsx': {}, '/home/project/package.json': {} })).toBe(false);
  });

  it('파일맵이 없거나 비면 false', () => {
    expect(isCinematicProject(undefined)).toBe(false);
    expect(isCinematicProject({})).toBe(false);
  });

  it('이름만 비슷한 경로에 속지 않는다', () => {
    expect(isCinematicProject({ '/home/project/src/kitchen/tokens.css.bak': {} })).toBe(false);
  });
});

describe('getFineTunedPrompt 골격 7 게이팅', () => {
  const base = getFineTunedPrompt();
  const cinematic = getFineTunedPrompt(undefined, undefined, undefined, true);

  it('기본 트랙은 골격 7 체크리스트를 그대로 준다', () => {
    expect(base).toContain('data-slot="hero"');
    expect(base).toContain('패럴랙스(background-attachment: fixed, 스크롤 연동 transform 등)는 쓰지 않는다');
  });

  it('시네마틱 트랙에서는 킷과 부딪히는 지시가 사라진다', () => {
    expect(cinematic).not.toContain('data-slot="hero"');
    expect(cinematic).not.toContain('패럴랙스(background-attachment: fixed, 스크롤 연동 transform 등)는 쓰지 않는다');
    expect(cinematic).not.toContain("font-family: 'Noto Serif KR', serif;");
  });

  it('시네마틱 트랙도 골격 7 자체와 나열 금지·spacious는 유지한다', () => {
    expect(cinematic).toContain('7. 소개·홍보형');
    expect(cinematic).toContain('시네마틱 킷이 src/kit/에 설치돼 있다');
    expect(cinematic).toContain('.map()·3열 이상 grid·반복 카드 컴포넌트를 쓰지 않는다');
    expect(cinematic).toContain('밀도는 spacious로 고정한다');
  });

  it('골격 1~6은 두 트랙에서 같다', () => {
    for (const marker of ['1. 명단·잔액형', '4. 목록·상세형', '6. 순위·티어형']) {
      expect(base).toContain(marker);
      expect(cinematic).toContain(marker);
    }
  });
});
