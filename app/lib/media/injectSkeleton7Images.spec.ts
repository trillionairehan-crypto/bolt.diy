import { describe, expect, it } from 'vitest';
import { injectSkeleton7Images } from './injectSkeleton7Images';

const URLS = {
  hero: 'https://pub.example.r2.dev/media/c1/1-hero.png',
  ch1: 'https://pub.example.r2.dev/media/c1/1-ch1.png',
  ch2: 'https://pub.example.r2.dev/media/c1/1-ch2.png',
  ch3: 'https://pub.example.r2.dev/media/c1/1-ch3.png',
};

const SAMPLE = `
export default function App() {
  return (
    <main>
      <section data-slot="hero" style={{ height: '100vh', background: '#fff' }}>
        <h1 style={{ fontSize: '56px' }}>동네 빵집</h1>
        <p>사진을 보내주시면 여기에 넣어드릴게요</p>
      </section>
      <section data-slot="ch1" style={{ height: '100vh' }}>
        <h2>크루아상</h2>
      </section>
      <div data-slot="ch2" className="chapter" style={{ height: '100vh' }}>
        <h2>공간</h2>
      </div>
      <section data-slot="ch3" style={{ height: '100vh' }}>
        <h2>오시는 길</h2>
      </section>
    </main>
  );
}
`;

describe('injectSkeleton7Images', () => {
  it('injects all four slots, makes containers stacking contexts, removes the hero caption', () => {
    const result = injectSkeleton7Images(SAMPLE, URLS);

    expect(result.injected).toEqual(['hero', 'ch1', 'ch2', 'ch3']);
    expect(result.missing).toEqual([]);

    for (const url of Object.values(URLS)) {
      expect(result.content).toContain(`<img src="${url}"`);
    }

    expect(result.content).toContain(
      `<section data-slot="hero" style={{ position: 'relative', isolation: 'isolate', overflow: 'hidden', color: '#fff', height: '100vh', background: '#fff' }}>`,
    );
    expect(result.content).not.toContain('사진을 보내주시면 여기에 넣어드릴게요');
    expect(result.content).toContain("<h1 style={{ fontSize: '56px' }}>동네 빵집</h1>");
  });

  it('adds a style attribute when the container has none', () => {
    const src = `<section data-slot="hero" className="hero">\n<h1>x</h1>\n</section>\n<section data-slot="ch1" style={{ height: '100vh' }}></section><section data-slot="ch2" style={{ height: '100vh' }}></section>`;
    const result = injectSkeleton7Images(src, { hero: URLS.hero });

    expect(result.injected).toEqual(['hero']);
    expect(result.content).toContain(
      `<section data-slot="hero" className="hero" style={{ position: 'relative', isolation: 'isolate', overflow: 'hidden', color: '#fff' }}><img src="${URLS.hero}"`,
    );
  });

  it('is idempotent', () => {
    const once = injectSkeleton7Images(SAMPLE, URLS);
    const twice = injectSkeleton7Images(once.content, URLS);

    expect(twice.injected).toEqual([]);
    expect(twice.content).toBe(once.content);
  });

  it('reports slots that are absent and leaves non-skeleton-7 files untouched', () => {
    const partial = `<section data-slot="hero" style={{ height: '100vh' }}></section><section data-slot="ch1" style={{ height: '100vh' }}></section>`;
    const result = injectSkeleton7Images(partial, URLS);

    expect(result.injected).toEqual(['hero', 'ch1']);
    expect(result.missing).toEqual(['ch2', 'ch3']);

    const plain = 'export const x = 1;';
    expect(injectSkeleton7Images(plain, URLS)).toEqual({ content: plain, injected: [], missing: [] });
  });
});
