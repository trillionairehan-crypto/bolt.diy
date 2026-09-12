import { describe, expect, it } from 'vitest';
import { checkCinematicSceneOrder, CINEMATIC_SCENE_ORDER } from './sceneOrder';

/** 프롬프트가 요구하는 모양 그대로의 최소 통과본. */
const GOOD = `import { HeroScene, PinnedChapters, TextReveal, Showcase3D, Marquee, Contact, Nav, Preloader, Cursor, SceneNav, useSmoothScroll } from './kit';

export default function App() {
  useSmoothScroll({ snap: true });

  return (
    <>
      <Preloader brand="온빛" />
      <Cursor />
      <Nav brand="온빛" links={[]} cta="예약" />
      <SceneNav />
      <HeroScene image="https://cdn/hero.jpg" video="https://cdn/hero.mp4" title="매일 아침 굽습니다" />
      <TextReveal as="h2" className="ck-display ck-display--statement" text="불 앞에서 보낸 시간" />
      <PinnedChapters
        id="story"
        startIndex={2}
        chapters={[
          { image: 'https://cdn/ch1.jpg', eyebrow: '01', title: '반죽', body: '하루 전에 시작합니다.', treatment: 'grain' },
          { image: 'https://cdn/ch2.jpg', eyebrow: '02', title: '발효', body: '느리게 기다립니다.', treatment: 'mono' },
          { image: 'https://cdn/ch3.jpg', eyebrow: '03', title: '굽기', body: '아침 여섯 시.', treatment: 'none' },
        ]}
      />
      <Showcase3D eyebrow="대표" title="캉파뉴" body="묵직한 결" specs={[{ label: '무게', value: '900g' }]} shape="bowl" poster="https://cdn/hero.jpg" />
      <Marquee items={['매일 굽는 빵']} emphasize={[1]} />
      <Contact id="contact" title="찾아오시는 길" rows={[]} cta="전화" />
    </>
  );
}
`;

describe('checkCinematicSceneOrder', () => {
  it('순서대로 다 쓴 생성물은 통과한다', () => {
    const result = checkCinematicSceneOrder(GOOD);
    expect(result.problems).toEqual([]);
    expect(result.pass).toBe(true);
    expect(result.order).toEqual([...CINEMATIC_SCENE_ORDER]);
    expect(result.chapterCount).toBe(3);
  });

  it('빠진 컴포넌트를 집어낸다', () => {
    const result = checkCinematicSceneOrder(GOOD.replace(/ {6}<Cursor \/>\n/, ''));
    expect(result.pass).toBe(false);
    expect(result.problems).toContain('<Cursor> 없음');
  });

  it('순서가 뒤바뀌면 잡아낸다', () => {
    const swapped = GOOD.replace(/( {6}<Preloader brand="온빛" \/>\n)( {6}<Cursor \/>\n)/, '$2$1');
    const result = checkCinematicSceneOrder(swapped);
    expect(result.pass).toBe(false);
    expect(result.problems).toContain('순서 어긋남 — <Cursor>이 <Preloader>보다 앞에 있다');
  });

  it('<Nav>와 <SceneNav>를 서로 오인하지 않는다', () => {
    const result = checkCinematicSceneOrder(GOOD.replace(' {6}<Nav brand[^\n]*\n', ''));
    expect(result.order).toContain('Nav');
    expect(result.order).toContain('SceneNav');
  });

  it('2단계 1차의 실패 모양(ScrollChapter·data-slot·raw 마크업)을 전부 잡는다', () => {
    const round1 = `import { HeroScene, ScrollChapter } from './kit';

export default function App() {
  return (
    <section data-slot="hero" style={{ height: '100vh' }}>
      <video src="https://cdn/hero.mp4" autoPlay muted loop playsInline />
      <img src="https://cdn/ch1.jpg" alt="" />
      <ScrollChapter index={2} image="https://cdn/ch1.jpg" />
    </section>
  );
}
`;
    const result = checkCinematicSceneOrder(round1);
    expect(result.pass).toBe(false);
    expect(result.problems).toContain('<ScrollChapter>를 직접 썼다 — 챕터는 <PinnedChapters>로만 만든다');
    expect(result.problems).toContain('data-slot 컨테이너를 만들었다 — 골격 7 체크리스트가 킷 지시를 덮었다');
    expect(result.problems).toContain('<video> 태그를 직접 썼다 — 미디어는 킷 컴포넌트 props로만 넘긴다');
    expect(result.problems).toContain('<img> 태그를 직접 썼다 — 미디어는 킷 컴포넌트 props로만 넘긴다');
    expect(result.problems).toContain('PinnedChapters 챕터가 0개다 — 정확히 3개여야 한다');
  });

  it('챕터가 3개가 아니면 잡아낸다', () => {
    const twoChapters = GOOD.replace(/ {10}\{ image: 'https:\/\/cdn\/ch3\.jpg'[^\n]*\n/, '');
    expect(checkCinematicSceneOrder(twoChapters).chapterCount).toBe(2);
  });

  it('본문 카피 안의 대괄호가 챕터 수 계산을 깨뜨리지 않는다', () => {
    const bracketCopy = GOOD.replace('하루 전에 시작합니다.', '하루 전에 시작합니다 [오전 6시]');
    expect(checkCinematicSceneOrder(bracketCopy).chapterCount).toBe(3);
  });
});
