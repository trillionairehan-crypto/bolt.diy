import { describe, expect, it } from 'vitest';
import { selectReviewableEntries } from './reviewGeneratedApp';
import { WORK_DIR } from './constants';

type Entry = { type: 'file'; content: string; isBinary: boolean };

function file(content = 'x'): Entry {
  return { type: 'file', content, isBinary: false };
}

describe('selectReviewableEntries', () => {
  const files = {
    [`${WORK_DIR}/src/App.tsx`]: file(),
    [`${WORK_DIR}/src/main.tsx`]: file(),
    [`${WORK_DIR}/src/vite-env.d.ts`]: file(),
    [`${WORK_DIR}/src/kit/Showcase3D.tsx`]: file("const accent = '#ff5330';"),
    [`${WORK_DIR}/src/kit/tokens.css`]: file(':root { --ck-accent: #ff5330; }'),
    [`${WORK_DIR}/package.json`]: file(),
  } as Record<string, Entry>;

  const paths = selectReviewableEntries(files as never).map(([path]) => path);

  it('src 아래 생성물 파일만 고른다', () => {
    expect(paths).toContain(`${WORK_DIR}/src/App.tsx`);
    expect(paths).toContain(`${WORK_DIR}/src/main.tsx`);
    expect(paths).not.toContain(`${WORK_DIR}/package.json`);
    expect(paths).not.toContain(`${WORK_DIR}/src/vite-env.d.ts`);
  });

  /*
   * 킷은 우리가 시드한 고정 라이브러리다. 검토에 넣으면 매번 86KB가 입력에 얹히고, 색 리터럴
   * 자동수정이 three에 넘기는 '#ff5330'을 var(...)로 바꿔 3D를 깨뜨린다.
   */
  it('시네마틱 킷(src/kit/)은 검토 대상에서 제외한다', () => {
    expect(paths.some((path) => path.includes('/src/kit/'))).toBe(false);
  });
});
