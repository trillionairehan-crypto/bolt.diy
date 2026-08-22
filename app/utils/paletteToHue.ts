/**
 * Converts a hex color to its OKLCH hue (0-359 integer) using the CSS Color 4 OKLab matrices.
 * Used to derive the design kit's single `--hue` token from a user-picked palette color,
 * instead of letting the LLM interpret raw hex values.
 */
export function hexToOklchHue(hex: string): number | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());

  if (!match) {
    return null;
  }

  const int = parseInt(match[1], 16);
  const srgb = [(int >> 16) & 255, (int >> 8) & 255, int & 255].map((c) => c / 255);

  const linear = srgb.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const [r, g, b] = linear;

  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const bLab = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;

  if (Math.abs(a) < 1e-6 && Math.abs(bLab) < 1e-6) {
    // Achromatic (grayscale) color — hue is undefined, fall back to the brand default.
    return null;
  }

  const hueRad = Math.atan2(bLab, a);
  const hueDeg = (hueRad * 180) / Math.PI;

  return Math.round((hueDeg + 360) % 360);
}

const CORALRED_DEFAULT_HUE = 34; // measured OKLCH hue of #FF5A36 (Coralred's actual brand accent)

/**
 * Derives the design kit's --hue value from a DesignScheme palette's primary color.
 * Falls back to the Coralred brand default (34) when no palette/primary color is present
 * or the color can't be parsed — this is also the free-tier default.
 */
export function designSchemeToHue(palette?: { [key: string]: string }): number {
  const primary = palette?.primary;

  if (!primary) {
    return CORALRED_DEFAULT_HUE;
  }

  const hue = hexToOklchHue(primary);

  return hue ?? CORALRED_DEFAULT_HUE;
}
