import { describe, expect, it } from 'vitest';
import {
  extractRelativeImports,
  resolveRelativeImport,
  findMissingRelativeImports,
  formatMissingImportsAlert,
} from './file-reference-postprocess';

describe('extractRelativeImports', () => {
  it('extracts a simple relative import with its line number', () => {
    const refs = extractRelativeImports(`import Foo from './Foo';`);
    expect(refs).toEqual([{ specifier: './Foo', line: 1 }]);
  });

  it('reports the correct line number for an import on a later line', () => {
    const content = `import React from 'react';\nimport Foo from './Foo';\n`;
    const refs = extractRelativeImports(content);
    expect(refs).toEqual([{ specifier: './Foo', line: 2 }]);
  });

  it('ignores bare package specifiers (not relative)', () => {
    const refs = extractRelativeImports(`import React from 'react';`);
    expect(refs).toEqual([]);
  });

  it('extracts a parent-directory relative import', () => {
    const refs = extractRelativeImports(`import { helper } from '../utils/helper';`);
    expect(refs).toEqual([{ specifier: '../utils/helper', line: 1 }]);
  });

  it('extracts a dynamic import()', () => {
    const refs = extractRelativeImports(`const mod = await import('./lazy');`);
    expect(refs).toEqual([{ specifier: './lazy', line: 1 }]);
  });

  it('extracts a require() call', () => {
    const refs = extractRelativeImports(`const foo = require('./foo');`);
    expect(refs).toEqual([{ specifier: './foo', line: 1 }]);
  });

  it('extracts a re-export specifier', () => {
    const refs = extractRelativeImports(`export { helper } from './helper';`);
    expect(refs).toEqual([{ specifier: './helper', line: 1 }]);
  });

  it('extracts multiple imports from the same file', () => {
    const content = `import A from './A';\nimport B from './B';`;
    const refs = extractRelativeImports(content);
    expect(refs.map((r) => r.specifier)).toEqual(['./A', './B']);
  });
});

describe('resolveRelativeImport', () => {
  const files = new Set(['/app/components/Button.tsx', '/app/components/icons/index.ts', '/app/styles.css']);
  const fileExists = (p: string) => files.has(p);

  it('resolves an exact match with an explicit extension', () => {
    expect(resolveRelativeImport('/app/components', './Button.tsx', fileExists)).toBe(true);
  });

  it('resolves an extension-less specifier by guessing extensions', () => {
    expect(resolveRelativeImport('/app', './components/Button', fileExists)).toBe(true);
  });

  it('resolves a directory import via its index file', () => {
    expect(resolveRelativeImport('/app', './components/icons', fileExists)).toBe(true);
  });

  it('resolves a parent-directory specifier', () => {
    expect(resolveRelativeImport('/app/components', '../styles.css', fileExists)).toBe(true);
  });

  it('returns false for a genuinely missing file', () => {
    expect(resolveRelativeImport('/app/components', './DoesNotExist', fileExists)).toBe(false);
  });

  it('does not extension-guess a specifier that already has an explicit (wrong) extension', () => {
    // Button.tsx exists, but Button.jsx does not, and the specifier already has an extension.
    expect(resolveRelativeImport('/app/components', './Button.jsx', fileExists)).toBe(false);
  });
});

describe('findMissingRelativeImports', () => {
  it('finds a broken import in a written file', () => {
    const missing = findMissingRelativeImports(
      [{ path: '/app/App.tsx', content: `import Foo from './Foo';` }],
      () => false,
    );
    expect(missing).toEqual([{ importerPath: '/app/App.tsx', specifier: './Foo', line: 1 }]);
  });

  it('returns nothing when every import resolves', () => {
    const missing = findMissingRelativeImports(
      [{ path: '/app/App.tsx', content: `import Foo from './Foo';` }],
      () => true,
    );
    expect(missing).toEqual([]);
  });

  it('skips non-source files entirely (e.g. package.json, .sql)', () => {
    const missing = findMissingRelativeImports(
      [{ path: '/app/schema.sql', content: `-- import './nonsense' as a comment` }],
      () => false,
    );
    expect(missing).toEqual([]);
  });

  it('can report more than one missing import from the same importer', () => {
    const content = `import A from './A';\nimport B from './B';`;
    const missing = findMissingRelativeImports([{ path: '/app/App.tsx', content }], () => false);
    expect(missing.map((m) => m.specifier)).toEqual(['./A', './B']);
  });
});

describe('formatMissingImportsAlert', () => {
  it('formats a singular message for exactly one missing import', () => {
    const { description } = formatMissingImportsAlert(
      [{ importerPath: '/work/app/App.tsx', specifier: './Foo', line: 3 }],
      '/work',
    );
    expect(description).toBe(`app/App.tsx에서 import한 './Foo' 파일이 없어요`);
  });

  it('formats a plural message for more than one missing import', () => {
    const { description } = formatMissingImportsAlert(
      [
        { importerPath: '/work/app/App.tsx', specifier: './Foo', line: 3 },
        { importerPath: '/work/app/Bar.tsx', specifier: './Baz', line: 1 },
      ],
      '/work',
    );
    expect(description).toBe('app/App.tsx 등에서 import한 파일 2개가 없어요');
  });

  it('includes the relative path and line number in the detailed content', () => {
    const { content } = formatMissingImportsAlert(
      [{ importerPath: '/work/app/App.tsx', specifier: './Foo', line: 3 }],
      '/work',
    );
    expect(content).toContain(`app/App.tsx:3 imports './Foo'`);
  });
});
