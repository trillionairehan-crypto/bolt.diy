import { describe, expect, it } from 'vitest';
import { injectSkeleton7Images } from './injectSkeleton7Images';

const URLS = {
  hero: 'https://pub.example.r2.dev/media/c1/1-hero.jpg',
  ch1: 'https://pub.example.r2.dev/media/c1/1-ch1.jpg',
  ch2: 'https://pub.example.r2.dev/media/c1/1-ch2.jpg',
  ch3: 'https://pub.example.r2.dev/media/c1/1-ch3.jpg',
};

// 실생성 패턴 A(빵집 픽스처): 히어로는 코랄 틴트 div + 아이콘 + 캡션, 챕터는 코랄 틴트 div.
const TINT_BOX_SAMPLE = `
export default function App() {
  return (
    <main>
      <section data-slot="hero" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <Wheat size={32} color="var(--muted)" strokeWidth={1.5} />
            <span className="cr-caption">사진을 보내주시면 여기에 넣어드릴게요</span>
          </div>
        </div>
        <div className="cr-page"><h1 style={{ fontSize: '56px' }}>동네 빵집</h1></div>
      </section>
      <section data-slot="ch1" style={{ height: '100vh' }}>
        <div className="cr-page" style={{ background: '#fff' }}>
          <div style={{ aspectRatio: '4 / 3', background: 'var(--accent-soft)', borderRadius: 16 }}>
            <Croissant size={28} />
          </div>
          <h2>크루아상</h2>
        </div>
      </section>
      <section data-slot="ch2" style={{ height: '100vh' }}>
        <h2>공간</h2>
      </section>
      <section data-slot="ch3" style={{ height: '100vh' }}>
        <h2>오시는 길</h2>
      </section>
    </main>
  );
}
`;

// 패턴 B(2026-09-11 실생성): 공용 <ImagePlaceholder /> 컴포넌트를 챕터마다 호출.
const COMPONENT_SAMPLE = `
function ImagePlaceholder({ caption = true }: { caption?: boolean }) {
  return <div style={{ width: '100%', height: '100%', minHeight: '160px', background: 'var(--accent-soft)' }} />;
}
export default function App() {
  return (
    <main>
      <section data-slot="hero" style={{ height: '100vh' }}>
        <div style={{ flex: 1 }}><ImagePlaceholder caption /></div>
        <h1 style={{ fontSize: '56px' }}>오늘도 갓 구운</h1>
      </section>
      <section data-slot="ch1" style={{ height: '100vh' }}>
        <div className="cr-grid-2"><ImagePlaceholder caption={false} /><h2>반죽</h2></div>
      </section>
      <section data-slot="ch2" style={{ height: '100vh' }}>
        <div className="cr-grid-2"><h2>공간</h2><ImagePlaceholder caption={false} /></div>
      </section>
      <section data-slot="ch3" style={{ height: '100vh' }}>
        <h2>오시는 길</h2>
      </section>
    </main>
  );
}
`;

const CHAPTER_FILL_PREFIX = `<div style={{ position: 'relative', overflow: 'hidden', width: '100%', height: '100%', minHeight: '240px' }}><img src=`;

describe('injectSkeleton7Images', () => {
  it('pattern A: hero gets a backdrop with the tint box made transparent, ch1 fills its tint box', () => {
    const result = injectSkeleton7Images(TINT_BOX_SAMPLE, URLS);

    expect(result.injected).toEqual(['hero', 'ch1', 'ch2', 'ch3']);
    expect(result.missing).toEqual([]);

    expect(result.content).toContain(
      `<section data-slot="hero" style={{ position: 'relative', isolation: 'isolate', overflow: 'hidden', color: '#fff', height: '100vh', display: 'flex', flexDirection: 'column' }}><img src="${URLS.hero}"`,
    );
    expect(result.content).toContain("background: 'transparent', display: 'flex', alignItems: 'center'");
    expect(result.content).not.toContain('<Wheat');
    expect(result.content).not.toContain('사진을 보내주시면 여기에 넣어드릴게요');

    expect(result.content).toContain(
      `<div style={{ position: 'relative', overflow: 'hidden', aspectRatio: '4 / 3', background: 'var(--accent-soft)', borderRadius: 16 }}><img src="${URLS.ch1}"`,
    );

    // ch2/ch3 have no placeholder → backdrop fallback on the container
    expect(result.content).toContain(
      `<section data-slot="ch2" style={{ position: 'relative', isolation: 'isolate', overflow: 'hidden', color: '#fff', height: '100vh' }}><img src="${URLS.ch2}"`,
    );
    expect(result.content).toContain(`zIndex: -1 }} /><div aria-hidden="true"`);
  });

  it('pattern B: placeholder component calls are replaced — hero with a spacer, chapters with the image', () => {
    const result = injectSkeleton7Images(COMPONENT_SAMPLE, URLS);

    expect(result.injected).toEqual(['hero', 'ch1', 'ch2', 'ch3']);
    expect(result.content).toContain(`<div style={{ flex: 1 }}><div style={{ flex: 1 }} /></div>`);
    expect(result.content).toContain(`<div className="cr-grid-2">${CHAPTER_FILL_PREFIX}"${URLS.ch1}"`);
    expect(result.content).toContain(`<h2>공간</h2>${CHAPTER_FILL_PREFIX}"${URLS.ch2}"`);
    expect(result.content).toContain('function ImagePlaceholder(');
  });

  it('is idempotent', () => {
    const once = injectSkeleton7Images(TINT_BOX_SAMPLE, URLS);
    const twice = injectSkeleton7Images(once.content, URLS);

    expect(twice.injected).toEqual([]);
    expect(twice.content).toBe(once.content);
  });

  it('reports absent slots and leaves non-skeleton-7 files untouched', () => {
    const partial = `<section data-slot="hero" style={{ height: '100vh' }}></section><section data-slot="ch1" style={{ height: '100vh' }}></section>`;
    const result = injectSkeleton7Images(partial, URLS);

    expect(result.injected).toEqual(['hero', 'ch1']);
    expect(result.missing).toEqual(['ch2', 'ch3']);

    const plain = 'export const x = 1;';
    expect(injectSkeleton7Images(plain, URLS)).toEqual({ content: plain, injected: [], missing: [] });
  });

  it('adds a style attribute when a backdrop container has none', () => {
    const src = `<section data-slot="hero" className="hero"><h1>x</h1></section><section data-slot="ch1" style={{ height: '100vh' }}></section><section data-slot="ch2" style={{ height: '100vh' }}></section>`;
    const result = injectSkeleton7Images(src, { hero: URLS.hero });

    expect(result.content).toContain(
      `<section data-slot="hero" className="hero" style={{ position: 'relative', isolation: 'isolate', overflow: 'hidden', color: '#fff' }}><img src="${URLS.hero}"`,
    );
  });
});
