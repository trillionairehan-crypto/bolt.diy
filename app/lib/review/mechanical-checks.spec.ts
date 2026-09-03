import { describe, expect, it } from 'vitest';
import {
  formatMechanicalFindingsForPrompt,
  nearestPaletteVar,
  parseColorLiteral,
  resolveHueFromFiles,
  runMechanicalChecks,
  __internal,
} from './mechanical-checks';

const {
  runEmojiCheck,
  runColorLiteralCheck,
  runMapGuardCheck,
  runExternalImageCheck,
  runSkeleton7DataSlotCheck,
  runSkeleton7FallbackHeadlineCheck,
  runSkeleton7CaptionDedupeCheck,
  runSkeleton7CardGridHintCheck,
  isSkeleton7File,
} = __internal;

const HUE = 20; // coralred 기본 hue와 무관한 임의의 고정값 — 계산이 실행되는지만 확인.

describe('runEmojiCheck', () => {
  it('deletes an emoji mixed into surrounding text (space before)', () => {
    const src = 'const x = <p>완료 ✅</p>;';
    const { findings, content } = runEmojiCheck('src/App.tsx', src);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ rule: 'emoji-inline', autoFixed: true });
    expect(content).toBe('const x = <p>완료</p>;');
  });

  it('deletes an emoji mixed into surrounding text (space after)', () => {
    const src = '<h1>🎉 환영합니다</h1>';
    const { findings, content } = runEmojiCheck('src/App.tsx', src);
    expect(findings).toHaveLength(1);
    expect(findings[0].autoFixed).toBe(true);
    expect(content).toBe('<h1>환영합니다</h1>');
  });

  it('deletes an emoji mixed into template literal text', () => {
    const src = 'const label = `가격: ${price}원 💰`;';
    const { findings, content } = runEmojiCheck('src/utils.ts', src);
    expect(findings).toHaveLength(1);
    expect(findings[0].autoFixed).toBe(true);
    expect(content).toBe('const label = `가격: ${price}원`;');
  });

  it('does not delete an emoji that is the sole content of a JSX element', () => {
    const src = '<span>🏎️</span>';
    const { findings, content } = runEmojiCheck('src/Icon.tsx', src);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ rule: 'emoji-sole-content', autoFixed: false });
    expect(content).toBe(src);
  });

  it('does not delete an emoji that is the sole content of a nested span', () => {
    const src = '<button aria-label="아이콘"><span className="icon">🚀</span></button>';
    const { findings, content } = runEmojiCheck('src/Icon.tsx', src);
    expect(findings.some((f) => f.rule === 'emoji-sole-content')).toBe(true);
    expect(content).toBe(src);
  });

  it('does not delete an emoji that is the sole content of a string literal', () => {
    const src = "const icon = '🏠';";
    const { findings, content } = runEmojiCheck('src/constants.ts', src);
    expect(findings).toHaveLength(1);
    expect(findings[0].rule).toBe('emoji-sole-content');
    expect(content).toBe(src);
  });

  it('ignores emoji inside a line comment', () => {
    const src = '// 완료 표시는 ✅ 이모지 사용\nconst a = 1;';
    const { findings, content } = runEmojiCheck('src/App.tsx', src);
    expect(findings).toHaveLength(0);
    expect(content).toBe(src);
  });

  it('ignores emoji inside a block comment', () => {
    const src = '/* 아이콘 🏎️ 자리 */\nconst b = 2;';
    const { findings, content } = runEmojiCheck('src/App.tsx', src);
    expect(findings).toHaveLength(0);
    expect(content).toBe(src);
  });

  it('finds nothing in plain text with no emoji', () => {
    const src = '<p>안녕하세요</p>';
    const { findings, content } = runEmojiCheck('src/App.tsx', src);
    expect(findings).toHaveLength(0);
    expect(content).toBe(src);
  });
});

describe('runColorLiteralCheck — hex/rgb/hsl/oklch literals', () => {
  it('auto-fixes a hex literal in a css file when hue is resolved', () => {
    const src = '.card { background: #ffffff; }';
    const { findings, content } = runColorLiteralCheck('src/card.css', src, HUE);
    expect(findings.some((f) => f.rule === 'color-literal' && f.autoFixed)).toBe(true);
    expect(content).toMatch(/var\(--[\w-]+\)/);
    expect(content).not.toContain('#ffffff');
  });

  it('auto-fixes a fully-opaque rgba() literal (alpha 1) in an inline style', () => {
    const src = "style={{ color: 'rgba(0,0,0,1)' }}";
    const { findings, content } = runColorLiteralCheck('src/Card.tsx', src, HUE);
    expect(findings.some((f) => f.rule === 'color-literal' && f.autoFixed)).toBe(true);
    expect(content).toMatch(/var\(--[\w-]+\)/);
  });

  it('does not auto-fix a translucent rgba() literal (loses alpha otherwise)', () => {
    const src = "style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}";
    const { findings, content } = runColorLiteralCheck('src/Card.tsx', src, HUE);
    expect(findings).toHaveLength(1);
    expect(findings[0].autoFixed).toBe(false);
    expect(findings[0].message).toContain('투명도');
    expect(content).toBe(src);
  });

  it('does not auto-fix a translucent oklch() literal (regression case from live verification)', () => {
    const src = 'box-shadow: 0 8px 24px oklch(0 0 0 / 0.12);';
    const { findings, content } = runColorLiteralCheck('src/index.css', src, HUE);
    expect(findings).toHaveLength(1);
    expect(findings[0].autoFixed).toBe(false);
    expect(content).toBe(src);
  });

  it('auto-fixes an hsl() literal in a css file', () => {
    const src = '.badge { border: 1px solid hsl(210, 15%, 90%); }';
    const { findings, content } = runColorLiteralCheck('src/badge.css', src, HUE);
    expect(findings.some((f) => f.rule === 'color-literal' && f.autoFixed)).toBe(true);
    expect(content).toMatch(/var\(--[\w-]+\)/);
  });

  it('falls back to a hint (no rewrite) when hue cannot be resolved', () => {
    const src = '.card { background: #ffffff; }';
    const { findings, content } = runColorLiteralCheck('src/card.css', src, null);
    expect(findings).toHaveLength(1);
    expect(findings[0].autoFixed).toBe(false);
    expect(findings[0].message).toContain('--hue');
    expect(content).toBe(src);
  });

  it('does not flag a hex literal inside a :root block', () => {
    const src = ':root { --accent: #ff5330; }';
    const { findings, content } = runColorLiteralCheck('src/theme.css', src, HUE);
    expect(findings).toHaveLength(0);
    expect(content).toBe(src);
  });

  it('does not flag var(--x) usage', () => {
    const src = "style={{ color: 'var(--accent)' }}";
    const { findings, content } = runColorLiteralCheck('src/Card.tsx', src, HUE);
    expect(findings).toHaveLength(0);
    expect(content).toBe(src);
  });
});

describe('runColorLiteralCheck — Tailwind color classes (hint only)', () => {
  it('flags a Tailwind bg/text color class pair and never rewrites it', () => {
    const src = '<div className="bg-blue-500 text-white p-4">';
    const { findings, content } = runColorLiteralCheck('src/Hero.tsx', src, HUE);
    const tw = findings.filter((f) => f.rule === 'tailwind-color-class');
    expect(tw.length).toBeGreaterThanOrEqual(1);
    expect(tw.every((f) => !f.autoFixed)).toBe(true);
    expect(tw[0].message).toContain('Tailwind를 쓰지 않아');
    expect(content).toBe(src);
  });

  it('flags a border color class', () => {
    const src = '<div className="border border-red-400 rounded-xl">';
    const { findings } = runColorLiteralCheck('src/Alert.tsx', src, HUE);
    expect(findings.some((f) => f.rule === 'tailwind-color-class')).toBe(true);
  });

  it('flags a ring color class even with hue unresolved', () => {
    const src = '<input className="ring-2 ring-emerald-500" />';
    const { findings } = runColorLiteralCheck('src/Input.tsx', src, null);
    expect(findings.some((f) => f.rule === 'tailwind-color-class')).toBe(true);
  });

  it('does not flag layout-only utility classes', () => {
    const src = '<div className="cr-card flex items-center gap-2">';
    const { findings } = runColorLiteralCheck('src/Card.tsx', src, HUE);
    expect(findings.filter((f) => f.rule === 'tailwind-color-class')).toHaveLength(0);
  });
});

describe('parseColorLiteral / nearestPaletteVar', () => {
  it('parses hex, rgb, hsl and oklch into comparable OKLab coordinates', () => {
    expect(parseColorLiteral('#ff0000')).not.toBeNull();
    expect(parseColorLiteral('rgb(255, 0, 0)')).not.toBeNull();
    expect(parseColorLiteral('hsl(0, 100%, 50%)')).not.toBeNull();
    expect(parseColorLiteral('oklch(0.63 0.26 29)')).not.toBeNull();
  });

  it('returns null for unparseable input', () => {
    expect(parseColorLiteral('not-a-color')).toBeNull();
  });

  it('picks a real palette variable name for a near-white color', () => {
    const parsed = parseColorLiteral('#ffffff');
    expect(parsed).not.toBeNull();

    const name = nearestPaletteVar(parsed!, HUE);
    expect(name.startsWith('--')).toBe(true);
  });
});

describe('runMapGuardCheck (heuristic, hint only)', () => {
  it('flags an unguarded render map', () => {
    const src = '<ul>{items.map((item) => <li key={item.id}>{item.name}</li>)}</ul>';
    const findings = runMapGuardCheck('src/List.tsx', src);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ rule: 'unguarded-array-map', autoFixed: false });
  });

  it('flags an unguarded render map on a simple identifier', () => {
    const src = '<div>{data.map(x => <Card key={x.id} {...x} />)}</div>';
    const findings = runMapGuardCheck('src/Grid.tsx', src);
    expect(findings).toHaveLength(1);
  });

  it('flags an unguarded render map wrapped in parens', () => {
    const src = '{list.map((l) => (<Row key={l.id}>{l.label}</Row>))}';
    const findings = runMapGuardCheck('src/Rows.tsx', src);
    expect(findings).toHaveLength(1);
  });

  it('does not flag a map guarded by a length check', () => {
    const src = '{items.length > 0 && items.map((item) => <li key={item.id}>{item.name}</li>)}';
    const findings = runMapGuardCheck('src/List.tsx', src);
    expect(findings).toHaveLength(0);
  });

  it('does not flag a map guarded by a length ternary', () => {
    const src = '{items.length ? items.map((item) => <li key={item.id}>{item.name}</li>) : <Empty />}';
    const findings = runMapGuardCheck('src/List.tsx', src);
    expect(findings).toHaveLength(0);
  });

  it('does not flag a map guarded by a truthy check', () => {
    const src = '{items && items.map((item) => <li key={item.id}>{item.name}</li>)}';
    const findings = runMapGuardCheck('src/List.tsx', src);
    expect(findings).toHaveLength(0);
  });

  it('does not flag a plain non-JSX array transform', () => {
    const src = 'const ids = items.map((item) => item.id);';
    const findings = runMapGuardCheck('src/utils.tsx', src);
    expect(findings).toHaveLength(0);
  });
});

describe('runExternalImageCheck (hint only)', () => {
  it('flags a placehold.co image with no onError', () => {
    const src = '<img src="https://placehold.co/400x300" alt="preview" />';
    const findings = runExternalImageCheck('src/Preview.tsx', src);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ rule: 'external-image-no-onerror', autoFixed: false });
  });

  it('flags any external http(s) image with no onError', () => {
    const src = '<img src="https://example.com/photo.jpg" className="cr-img" alt="x" />';
    const findings = runExternalImageCheck('src/Photo.tsx', src);
    expect(findings).toHaveLength(1);
  });

  it('flags a non-self-closing external image tag', () => {
    const src = '<img src=\'https://cdn.example.com/a.png\' alt="b">';
    const findings = runExternalImageCheck('src/Banner.tsx', src);
    expect(findings).toHaveLength(1);
  });

  it('does not flag an external image that already has onError', () => {
    const src = '<img src="https://placehold.co/400x300" onError={handleError} alt="x" />';
    const findings = runExternalImageCheck('src/Preview.tsx', src);
    expect(findings).toHaveLength(0);
  });

  it('does not flag a local relative image', () => {
    const src = '<img src="/local/image.png" alt="local" />';
    const findings = runExternalImageCheck('src/Local.tsx', src);
    expect(findings).toHaveLength(0);
  });

  it('does not flag an image whose src is a plain variable reference', () => {
    const src = '<img src={dataUrl} alt="data" />';
    const findings = runExternalImageCheck('src/Data.tsx', src);
    expect(findings).toHaveLength(0);
  });
});

/*
 * 실측(2026-09-02, 배달 플랫폼 생성물)의 실제 실패 형태를 그대로 재현한다 — 스톡 URL이 <img src>
 * 리터럴이 아니라 데이터 파일의 평범한 객체 속성에 있었고, JSX는 src={r.image}처럼 동적으로만
 * 참조했다. runExternalImageCheck의 위 "plain variable reference는 안 잡음" 테스트가 보여주듯 그
 * 경로는 원래부터 사각지대였다 — runStockImageDomainCheck는 <img> 태그 여부와 무관하게 도메인
 * 문자열 자체를 찾아 이 사각지대를 메운다.
 */
describe('runStockImageDomainCheck (hint only)', () => {
  it('flags a pexels URL sitting in a plain data-file object property (the real bug shape)', () => {
    const src = "export const RESTAURANTS = [{ id: 'r1', image: 'https://images.pexels.com/photos/1/photo.jpeg' }];";
    const findings = __internal.runStockImageDomainCheck('src/data/restaurants.ts', src);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ rule: 'external-stock-image-domain', autoFixed: false });
  });

  it('flags an unsplash URL used directly as an <img> src', () => {
    const src = '<img src="https://images.unsplash.com/photo-123" alt="x" />';
    const findings = __internal.runStockImageDomainCheck('src/Card.tsx', src);
    expect(findings).toHaveLength(1);
  });

  it('flags placehold.co and picsum.photos too', () => {
    const src = "const a = 'https://placehold.co/400x300'; const b = 'https://picsum.photos/200';";
    const findings = __internal.runStockImageDomainCheck('src/Mock.tsx', src);
    expect(findings).toHaveLength(2);
  });

  it('flags a stock domain inside a CSS background-image', () => {
    const src = '.hero { background-image: url("https://images.pexels.com/photos/2/photo.jpeg"); }';
    const findings = __internal.runStockImageDomainCheck('src/hero.css', src);
    expect(findings).toHaveLength(1);
  });

  it('does not flag a local or same-origin image path', () => {
    const src = '<img src="/local/photo.png" alt="x" />';
    const findings = __internal.runStockImageDomainCheck('src/Local.tsx', src);
    expect(findings).toHaveLength(0);
  });

  it('ignores a stock domain mentioned only in a comment', () => {
    const src = '// see https://unsplash.com for inspiration\nconst a = 1;';
    const findings = __internal.runStockImageDomainCheck('src/App.tsx', src);
    expect(findings).toHaveLength(0);
  });

  it('does not touch file content (hint only, never auto-fixed)', () => {
    const src = "const image = 'https://images.pexels.com/photos/1/photo.jpeg';";
    const findings = __internal.runStockImageDomainCheck('src/data/restaurants.ts', src);
    expect(findings.every((f) => !f.autoFixed)).toBe(true);
  });

  it('skips files outside the scanned extension set', () => {
    const src = "image: 'https://images.pexels.com/photos/1/photo.jpeg'";
    const findings = __internal.runStockImageDomainCheck('src/data/restaurants.json', src);
    expect(findings).toHaveLength(0);
  });
});

describe('resolveHueFromFiles', () => {
  it('finds --hue set on the body style in index.html', () => {
    const hue = resolveHueFromFiles({
      'index.html': '<body style="--hue: 33">',
      'src/App.tsx': 'export default function App() { return null; }',
    });
    expect(hue).toBe(33);
  });

  it('returns null when no file sets --hue', () => {
    const hue = resolveHueFromFiles({ 'src/App.tsx': 'export default function App() { return null; }' });
    expect(hue).toBeNull();
  });
});

describe('runMechanicalChecks (orchestration)', () => {
  it('applies auto-fixes and reports both fixed and hint findings together', () => {
    const files = {
      'src/App.tsx': '<p>완료 ✅</p><img src="https://placehold.co/1x1" alt="x" />',
      'src/theme.css': '.card { background: #ffffff; }',
    };
    const { findings, updatedFiles } = runMechanicalChecks(files, HUE);

    expect(Object.keys(updatedFiles)).toEqual(expect.arrayContaining(['src/App.tsx', 'src/theme.css']));
    expect(updatedFiles['src/App.tsx']).not.toContain('✅');
    expect(findings.some((f) => f.rule === 'emoji-inline' && f.autoFixed)).toBe(true);
    expect(findings.some((f) => f.rule === 'external-image-no-onerror' && !f.autoFixed)).toBe(true);
  });

  it('does not emit unguarded-array-map findings (disabled after live false-positive measurement)', () => {
    const files = {
      'src/List.tsx': '<ul>{items.map((item) => <li key={item.id}>{item.name}</li>)}</ul>',
    };
    const { findings } = runMechanicalChecks(files, HUE);
    expect(findings.some((f) => f.rule === 'unguarded-array-map')).toBe(false);
  });

  it('leaves untouched files out of updatedFiles', () => {
    const files = { 'src/App.tsx': '<p>안녕하세요</p>' };
    const { findings, updatedFiles } = runMechanicalChecks(files, HUE);
    expect(findings).toHaveLength(0);
    expect(updatedFiles).toEqual({});
  });
});

describe('isSkeleton7File', () => {
  it('detects via data-slot="hero" marker', () => {
    expect(isSkeleton7File('<section data-slot="hero">x</section>')).toBe(true);
  });

  it('detects via cr-ch-fallback-headline marker', () => {
    expect(isSkeleton7File('<h1 class="cr-ch-fallback-headline">x</h1>')).toBe(true);
  });

  it('detects via 2+ literal 100vh occurrences as a fallback signal', () => {
    expect(isSkeleton7File('height: 100vh; ... height: 100vh;')).toBe(true);
  });

  it('does not flag an ordinary file with no skeleton-7 markers', () => {
    expect(isSkeleton7File('<div className="card">평범한 카드</div>')).toBe(false);
  });

  it('does not flag a single incidental 100vh mention', () => {
    expect(isSkeleton7File('min-height: 100vh;')).toBe(false);
  });
});

describe('runSkeleton7DataSlotCheck', () => {
  const chapter = (inner: string, dataSlot?: string) =>
    `<section style={{height:"100vh"}}${dataSlot ? ` data-slot="${dataSlot}"` : ''}>${inner}</section>`;

  it('renames 4 chapter containers to hero/ch1/ch2/ch3 in order, leaving already-correct ones untouched', () => {
    const src = [chapter('A', 'wrong'), chapter('B'), chapter('C', 'ch2'), chapter('D')].join('\n');
    const { findings, content } = runSkeleton7DataSlotCheck('src/App.tsx', src);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ rule: 'skeleton7-data-slot', autoFixed: true });
    expect(content).toContain('data-slot="hero"');
    expect(content).toContain('data-slot="ch1"');
    expect(content).toContain('data-slot="ch2"');
    expect(content).toContain('data-slot="ch3"');
    expect(content).not.toContain('data-slot="wrong"');

    // C already had the correct ch2 slot — its surrounding tag text is untouched.
    expect(content).toContain(chapter('C', 'ch2'));
  });

  it('does nothing when all 4 slots are already correctly named in order', () => {
    const src = [chapter('A', 'hero'), chapter('B', 'ch1'), chapter('C', 'ch2'), chapter('D', 'ch3')].join('\n');
    const { findings, content } = runSkeleton7DataSlotCheck('src/App.tsx', src);
    expect(findings).toHaveLength(0);
    expect(content).toBe(src);
  });

  it('only leaves a hint (no auto-fix) when the chapter count is not exactly 4', () => {
    const src = [chapter('A'), chapter('B'), chapter('C')].join('\n');
    const { findings, content } = runSkeleton7DataSlotCheck('src/App.tsx', src);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ rule: 'skeleton7-chapter-count', autoFixed: false });
    expect(content).toBe(src);
  });

  it('is a no-op on a file with no skeleton-7 markers', () => {
    const src = '<div className="card">평범한 카드</div>';
    const { findings, content } = runSkeleton7DataSlotCheck('src/App.tsx', src);
    expect(findings).toHaveLength(0);
    expect(content).toBe(src);
  });
});

describe('runSkeleton7FallbackHeadlineCheck', () => {
  it('bumps a sub-56px fallback headline font-size up to 56px, preserving original formatting', () => {
    const src = '<h1 class="cr-ch-fallback-headline" style="font-size:44px">환영합니다</h1>';
    const { findings, content } = runSkeleton7FallbackHeadlineCheck('src/App.tsx', src);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ rule: 'skeleton7-fallback-headline-size', autoFixed: true });
    expect(content).toContain('font-size:56px');
    expect(content).not.toContain('44px');
  });

  it('leaves a font-size already at or above 56px untouched', () => {
    const src = '<h1 class="cr-ch-fallback-headline" style="font-size:60px">환영합니다</h1>';
    const { findings, content } = runSkeleton7FallbackHeadlineCheck('src/App.tsx', src);
    expect(findings).toHaveLength(0);
    expect(content).toBe(src);
  });

  it('is a no-op when the fallback headline class is absent', () => {
    const src = '<h1 style="font-size:20px">평범한 제목</h1>';
    const { findings, content } = runSkeleton7FallbackHeadlineCheck('src/App.tsx', src);
    expect(findings).toHaveLength(0);
    expect(content).toBe(src);
  });

  it('fixes an inline style that appears BEFORE the className attribute (regression: 2026-09-03 cafe case)', () => {
    const src = '<h1 style={{fontSize:"44px"}} className="cr-ch-fallback-headline">환영합니다</h1>';
    const { findings, content } = runSkeleton7FallbackHeadlineCheck('src/App.tsx', src);
    expect(findings).toHaveLength(1);
    expect(findings[0].autoFixed).toBe(true);
    expect(content).not.toContain('44px');
    expect(content).toContain('56px');
  });

  it('fixes a camelCase JSX inline style object (fontSize, not font-size)', () => {
    const src = '<h1 className="cr-ch-fallback-headline" style={{ fontSize: \'44px\' }}>환영합니다</h1>';
    const { findings, content } = runSkeleton7FallbackHeadlineCheck('src/App.tsx', src);
    expect(findings).toHaveLength(1);
    expect(content).toContain("fontSize: '56px'");
    expect(content).not.toContain('44px');
  });

  it('fixes an inline override while leaving an already-correct CSS rule for the same class untouched', () => {
    const src = [
      '.cr-ch-fallback-headline { font-size: 56px; }',
      '<h1 className="cr-ch-fallback-headline" style={{ fontSize: 44 }}>환영합니다</h1>',
    ].join('\n');
    const { findings, content } = runSkeleton7FallbackHeadlineCheck('src/App.tsx', src);
    expect(findings).toHaveLength(1);
    expect(content).toContain('.cr-ch-fallback-headline { font-size: 56px; }');
    expect(content).toContain('fontSize: 56');
    expect(content).not.toContain('fontSize: 44');
  });
});

describe('runSkeleton7CaptionDedupeCheck', () => {
  const CAPTION = '사진을 보내주시면 여기에 넣어드릴게요';

  it('keeps the occurrence nearest data-slot="hero" and removes the rest', () => {
    const src = [
      `<div data-slot="hero"><span>${CAPTION}</span></div>`,
      `<div data-slot="ch1"><span>${CAPTION}</span></div>`,
      `<div data-slot="ch2"><span>${CAPTION}</span></div>`,
    ].join('');
    const { findings, content } = runSkeleton7CaptionDedupeCheck('src/App.tsx', src);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ rule: 'skeleton7-hero-caption-dedupe', autoFixed: true });
    expect(content.split(CAPTION)).toHaveLength(2); // one occurrence left
    expect(content).toContain(`<div data-slot="hero"><span>${CAPTION}</span></div>`);
  });

  it('leaves a single occurrence untouched', () => {
    const src = `<div data-slot="hero"><span>${CAPTION}</span></div>`;
    const { findings, content } = runSkeleton7CaptionDedupeCheck('src/App.tsx', src);
    expect(findings).toHaveLength(0);
    expect(content).toBe(src);
  });
});

describe('runSkeleton7CardGridHintCheck', () => {
  it('flags a 3+ column grid with a nearby .map() as a card/list violation hint', () => {
    const src = `
      <section style={{height: '100vh'}}>hero</section>
      <div className="grid" /* grid-template-columns: repeat(4, 1fr); */>
        {items.map((item) => <Card key={item.id} {...item} />)}
      </div>
      <section style={{height: '100vh'}}>last</section>
    `;
    const findings = runSkeleton7CardGridHintCheck('src/App.tsx', src);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ rule: 'skeleton7-card-grid-detected', autoFixed: false });
  });

  it('does not flag a grid with no nearby .map() call', () => {
    const src = `
      <section style={{height: '100vh'}}>hero</section>
      <div /* grid-template-columns: repeat(3, 1fr); */>고정된 카드 3개, 반복 렌더링 아님</div>
      <section style={{height: '100vh'}}>last</section>
    `;
    expect(runSkeleton7CardGridHintCheck('src/App.tsx', src)).toHaveLength(0);
  });

  it('is a no-op on a file with no skeleton-7 markers', () => {
    const src = '.grid { grid-template-columns: repeat(3, 1fr); } // items.map(...)';
    expect(runSkeleton7CardGridHintCheck('src/App.tsx', src)).toHaveLength(0);
  });
});

describe('formatMechanicalFindingsForPrompt', () => {
  it('returns an empty string when there are no findings', () => {
    expect(formatMechanicalFindingsForPrompt([])).toBe('');
  });

  it('separates auto-fixed entries from hints', () => {
    const text = formatMechanicalFindingsForPrompt([
      { file: 'src/App.tsx', line: 1, rule: 'emoji-inline', message: '이모지 제거', autoFixed: true },
      { file: 'src/List.tsx', line: 5, rule: 'unguarded-array-map', message: '가드 없음', autoFixed: false },
    ]);
    expect(text).toContain('이미 기계 검사가 수정함');
    expect(text).toContain('기계 검사 힌트');
    expect(text).toContain('src/App.tsx:1');
    expect(text).toContain('src/List.tsx:5');
  });
});
