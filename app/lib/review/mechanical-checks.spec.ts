import { describe, expect, it } from 'vitest';
import {
  formatMechanicalFindingsForPrompt,
  nearestPaletteVar,
  parseColorLiteral,
  resolveHueFromFiles,
  runMechanicalChecks,
  __internal,
} from './mechanical-checks';

const { runEmojiCheck, runColorLiteralCheck, runMapGuardCheck, runExternalImageCheck } = __internal;

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
