import { describe, expect, it } from 'vitest';
import { injectCinematicImages } from './injectCinematicImages';

const RESERVED = {
  hero: 'https://pub-x.r2.dev/media/j1/hero.jpg',
  ch1: 'https://pub-x.r2.dev/media/j1/ch1.jpg',
  ch2: 'https://pub-x.r2.dev/media/j1/ch2.jpg',
  ch3: 'https://pub-x.r2.dev/media/j1/ch3.jpg',
};

/** 2026-09-12 실측 생성물의 모양 — URL을 상수로 빼고 킷 prop에 넘긴다. */
const UNSPLASH_APP = `import { HeroScene, PinnedChapters } from './kit';

const HERO = 'https://images.unsplash.com/photo-1554048612-b6a482bc67e5?w=2400';
const WORK_1 = 'https://images.unsplash.com/photo-1554080353-a576cf803bda?w=1600';
const WORK_2 = 'https://images.unsplash.com/photo-1519741497674-611481863552?w=1600';
const WORK_3 = 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=1600';

export default function App() {
  return (
    <>
      <HeroScene image={HERO} title="빛이 머무는 순간" />
      <PinnedChapters
        chapters={[
          { image: WORK_1, title: '인물' },
          { image: WORK_2, title: '웨딩' },
          { image: WORK_3, title: '브랜드' },
        ]}
      />
    </>
  );
}
`;

describe('injectCinematicImages', () => {
  it('모델이 지어낸 스톡 사진을 예약 URL로 갈아끼운다', () => {
    const result = injectCinematicImages(UNSPLASH_APP, RESERVED);

    expect(result.replaced).toBe(4);
    expect(result.slots).toEqual(['hero', 'ch1', 'ch2', 'ch3']);
    expect(result.content).not.toMatch(/unsplash/i);
    expect(result.content).toContain(RESERVED.hero);
    expect(result.content).toContain(RESERVED.ch3);
  });

  it('히어로가 먼저, 그다음이 챕터 순서다', () => {
    const { content } = injectCinematicImages(UNSPLASH_APP, RESERVED);

    expect(content.indexOf(RESERVED.hero)).toBeLessThan(content.indexOf(RESERVED.ch1));
    expect(content.indexOf(RESERVED.ch1)).toBeLessThan(content.indexOf(RESERVED.ch2));
  });

  it('멱등 — 이미 예약 URL을 쓰는 생성물은 건드리지 않는다', () => {
    const already = UNSPLASH_APP.replace(/https:\/\/images\.unsplash\.com[^']*/g, RESERVED.hero);
    const result = injectCinematicImages(already, RESERVED);

    expect(result.replaced).toBe(0);
    expect(result.content).toBe(already);
  });

  it('확장자가 붙은 외부 이미지도 잡는다', () => {
    const withExtension = `const HERO = 'https://cdn.example.com/photos/bakery.jpg';\n<HeroScene image={HERO} />`;
    const result = injectCinematicImages(withExtension, RESERVED);

    expect(result.replaced).toBe(1);
    expect(result.content).toContain(RESERVED.hero);
  });

  it('영상 URL과 로컬 경로는 건드리지 않는다', () => {
    const mixed = `const V = 'https://cdn.example.com/loop.mp4';\nconst L = '/media/local.jpg';\nconst H = 'https://images.unsplash.com/photo-1?w=10';`;
    const result = injectCinematicImages(mixed, RESERVED);

    expect(result.content).toContain('https://cdn.example.com/loop.mp4');
    expect(result.content).toContain("'/media/local.jpg'");
    expect(result.replaced).toBe(1);
  });

  it('챕터가 3개보다 많으면 ch1~ch3을 돌려 쓴다', () => {
    const many = Array.from(
      { length: 5 },
      (_, i) => `const P${i} = 'https://images.unsplash.com/photo-${i}?w=10';`,
    ).join('\n');
    const result = injectCinematicImages(many, RESERVED);

    expect(result.slots).toEqual(['hero', 'ch1', 'ch2', 'ch3', 'ch1']);
  });

  it('예약 URL이 없으면 아무것도 하지 않는다', () => {
    const result = injectCinematicImages(UNSPLASH_APP, {});

    expect(result.replaced).toBe(0);
    expect(result.content).toBe(UNSPLASH_APP);
  });
});
