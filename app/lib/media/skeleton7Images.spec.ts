import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WORK_DIR } from '~/utils/constants';

const files: Record<string, { type: 'file'; content: string; isBinary: boolean }> = {};

vi.mock('~/lib/stores/workbench', () => ({
  workbenchStore: {
    files: { get: () => files },
    writeFileDirect: vi.fn(async (filePath: string, content: string) => {
      files[filePath] = { type: 'file', content, isBinary: false };
    }),
    resetAllFileModifications: vi.fn(),
  },
}));

vi.mock('~/lib/persistence', () => ({
  chatId: { get: () => 'chat-1' },
  ensureChatId: async () => 'chat-1',
}));

const RESERVED = {
  hero: 'https://pub-x.r2.dev/media/j1/hero.jpg',
  ch1: 'https://pub-x.r2.dev/media/j1/ch1.jpg',
  ch2: 'https://pub-x.r2.dev/media/j1/ch2.jpg',
  ch3: 'https://pub-x.r2.dev/media/j1/ch3.jpg',
};

/** 2026-09-18 프로덕션 실측 모양 — 킷 import + <HeroScene>, 사진은 Pexels. */
const PEXELS_APP = `import { HeroScene, PinnedChapters } from './kit';

const HERO_IMAGE = 'https://images.pexels.com/photos/4620844/pexels-photo-4620844.jpeg';
const CHAPTERS = [
  { image: 'https://images.pexels.com/photos/4620843/pexels-photo-4620843.jpeg', title: '재단' },
  { image: 'https://images.pexels.com/photos/6069552/pexels-photo-6069552.jpeg', title: '스티칭' },
  { image: 'https://images.pexels.com/photos/4620842/pexels-photo-4620842.jpeg', title: '마감' },
];

export default function App() {
  return (
    <>
      <HeroScene image={HERO_IMAGE} title="가죽은 시간을 머금고" />
      <PinnedChapters chapters={CHAPTERS} />
    </>
  );
}
`;

const APP_PATH = `${WORK_DIR}/src/App.tsx`;

const JOB_INPUT = { industry: '가죽 공방', prompt: '가죽 공방 브랜드 소개', accentHex: '#ff5533', darkPalette: true };

describe('applySkeleton7Images — 자동 수정 뒤 재주입', () => {
  const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ images: RESERVED }) }));

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockClear();

    for (const key of Object.keys(files)) {
      delete files[key];
    }
  });

  it('자동 수정이 스톡 URL을 되살려도 새 잡 없이 같은 예약 URL을 다시 넣는다', async () => {
    const { prepareSkeleton7Images, applySkeleton7Images } = await import('./skeleton7Images');

    const prepared = await prepareSkeleton7Images(JOB_INPUT);
    expect(prepared?.urls.hero).toBe(RESERVED.hero);

    // 모델이 예약 URL을 무시하고 Pexels를 썼다 → 자동 검토 뒤 첫 주입.
    files[APP_PATH] = { type: 'file', content: PEXELS_APP, isBinary: false };

    const first = await applySkeleton7Images();
    expect(first?.mode).toBe('injected');
    expect(files[APP_PATH].content).toContain(RESERVED.hero);
    expect(files[APP_PATH].content).not.toMatch(/pexels/);

    // 자동 수정 턴이 App.tsx를 통째로 다시 써서 Pexels가 돌아왔다.
    files[APP_PATH] = { type: 'file', content: PEXELS_APP, isBinary: false };

    const fetchCallsBefore = fetchMock.mock.calls.length;

    const second = await applySkeleton7Images();
    expect(second?.mode).toBe('reinjected');
    expect(second?.filesWritten).toEqual([APP_PATH]);
    expect(files[APP_PATH].content).toContain(RESERVED.ch3);
    expect(files[APP_PATH].content).not.toMatch(/pexels/);
    expect(fetchMock.mock.calls.length).toBe(fetchCallsBefore);

    // 예약 URL이 그대로면 아무것도 안 쓴다(멱등).
    expect(await applySkeleton7Images()).toBeNull();
  });
});
