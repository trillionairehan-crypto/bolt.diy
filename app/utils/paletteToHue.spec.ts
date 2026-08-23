import { describe, expect, it } from 'vitest';
import { hexToOklchHue, designSchemeToHue } from './paletteToHue';

describe('hexToOklchHue', () => {
  it('decodes the coralred brand hex to its documented hue (~33)', () => {
    expect(hexToOklchHue('#FF5330')).toBe(33);
  });

  it('decodes the trust hex to its documented hue (~222)', () => {
    expect(hexToOklchHue('#0891B2')).toBe(222);
  });

  it('accepts a hex without a leading #', () => {
    expect(hexToOklchHue('FF5330')).toBe(hexToOklchHue('#FF5330'));
  });

  it('is case-insensitive', () => {
    expect(hexToOklchHue('#ff5330')).toBe(hexToOklchHue('#FF5330'));
  });

  it('returns null for pure white (achromatic)', () => {
    expect(hexToOklchHue('#FFFFFF')).toBeNull();
  });

  it('returns null for pure black (achromatic)', () => {
    expect(hexToOklchHue('#000000')).toBeNull();
  });

  it('returns null for a mid gray (achromatic)', () => {
    expect(hexToOklchHue('#808080')).toBeNull();
  });

  it('returns null for a malformed hex string', () => {
    expect(hexToOklchHue('not-a-hex')).toBeNull();
  });

  it('returns null for a 3-digit shorthand hex (not supported)', () => {
    expect(hexToOklchHue('#F53')).toBeNull();
  });

  it('returns an integer in [0, 360)', () => {
    const hue = hexToOklchHue('#3366FF');
    expect(hue).not.toBeNull();
    expect(Number.isInteger(hue)).toBe(true);
    expect(hue as number).toBeGreaterThanOrEqual(0);
    expect(hue as number).toBeLessThan(360);
  });
});

describe('designSchemeToHue', () => {
  it('falls back to the brand default (33) when no palette is given', () => {
    expect(designSchemeToHue(undefined)).toBe(33);
  });

  it('falls back to the brand default when the palette has no primary color', () => {
    expect(designSchemeToHue({})).toBe(33);
  });

  it('derives the hue from a valid primary color', () => {
    expect(designSchemeToHue({ primary: '#0891B2' })).toBe(222);
  });

  it('falls back to the brand default when primary is an unparseable value', () => {
    expect(designSchemeToHue({ primary: 'not-a-color' })).toBe(33);
  });

  it('falls back to the brand default when primary is achromatic (gray)', () => {
    expect(designSchemeToHue({ primary: '#808080' })).toBe(33);
  });
});
