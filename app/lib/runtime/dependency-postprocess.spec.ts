import { describe, expect, it } from 'vitest';
import { extractKnownPackageImports, addMissingDependencies, KNOWN_PACKAGE_VERSIONS } from './dependency-postprocess';

describe('extractKnownPackageImports', () => {
  it('finds a known package imported with a named import', () => {
    const found = extractKnownPackageImports(`import { createClient } from '@supabase/supabase-js';`);
    expect(found).toEqual(new Set(['@supabase/supabase-js']));
  });

  it('finds a known package imported via require()', () => {
    const found = extractKnownPackageImports(`const { createClient } = require("@supabase/supabase-js");`);
    expect(found).toEqual(new Set(['@supabase/supabase-js']));
  });

  it('ignores unknown packages', () => {
    const found = extractKnownPackageImports(`import React from 'react';\nimport { z } from 'zod';`);
    expect(found.size).toBe(0);
  });

  it('finds multiple distinct known packages across a file, deduping repeats', () => {
    const content = `
      import { createClient } from '@supabase/supabase-js';
      import { loadTossPayments } from '@tosspayments/tosspayments-sdk';
      import { createClient as createClient2 } from '@supabase/supabase-js';
    `;
    const found = extractKnownPackageImports(content);
    expect(found).toEqual(new Set(['@supabase/supabase-js', '@tosspayments/tosspayments-sdk']));
  });

  it('returns an empty set for content with no imports', () => {
    expect(extractKnownPackageImports('const x = 1;').size).toBe(0);
  });

  it('matches a dynamic import() of a known package', () => {
    const found = extractKnownPackageImports(`const mod = await import('@supabase/supabase-js');`);
    expect(found).toEqual(new Set(['@supabase/supabase-js']));
  });
});

describe('addMissingDependencies', () => {
  it('adds a missing dependency at the pinned version', () => {
    const result = addMissingDependencies('{"name":"app","dependencies":{}}', ['@supabase/supabase-js']);
    const parsed = JSON.parse(result);
    expect(parsed.dependencies['@supabase/supabase-js']).toBe(KNOWN_PACKAGE_VERSIONS['@supabase/supabase-js']);
  });

  it('leaves package.json untouched (same string) when nothing is missing', () => {
    const original = '{"name":"app","dependencies":{"@supabase/supabase-js":"^2.45.0"}}';
    expect(addMissingDependencies(original, ['@supabase/supabase-js'])).toBe(original);
  });

  it('does not duplicate a dependency already present in devDependencies', () => {
    const original = '{"name":"app","devDependencies":{"@supabase/supabase-js":"^2.0.0"}}';
    const result = addMissingDependencies(original, ['@supabase/supabase-js']);
    expect(result).toBe(original);
  });

  it('creates a "dependencies" key when the package.json has none', () => {
    const result = addMissingDependencies('{"name":"app"}', ['@tosspayments/tosspayments-sdk']);
    const parsed = JSON.parse(result);
    expect(parsed.dependencies).toEqual({
      '@tosspayments/tosspayments-sdk': KNOWN_PACKAGE_VERSIONS['@tosspayments/tosspayments-sdk'],
    });
  });

  it('returns the original text unchanged for invalid JSON', () => {
    const original = 'not json at all';
    expect(addMissingDependencies(original, ['@supabase/supabase-js'])).toBe(original);
  });

  it('adds only the packages that are actually missing, preserving existing ones', () => {
    const original = '{"name":"app","dependencies":{"react":"^18.3.1"}}';
    const result = addMissingDependencies(original, ['@supabase/supabase-js']);
    const parsed = JSON.parse(result);
    expect(parsed.dependencies.react).toBe('^18.3.1');
    expect(parsed.dependencies['@supabase/supabase-js']).toBe(KNOWN_PACKAGE_VERSIONS['@supabase/supabase-js']);
  });

  it('returns the original text unchanged when the JSON is valid but not an object (e.g. null)', () => {
    const original = 'null';
    expect(addMissingDependencies(original, ['@supabase/supabase-js'])).toBe(original);
  });

  it('returns the original text unchanged when the JSON parses to a primitive (e.g. a bare string)', () => {
    const original = '"just a string"';
    expect(addMissingDependencies(original, ['@supabase/supabase-js'])).toBe(original);
  });
});
