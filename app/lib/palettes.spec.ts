import { describe, it, expect } from 'vitest';
import { PALETTES } from './palettes';

/*
 * WCAG 2.x 상대 휘도/대비비 공식(표준 정의, 0.03928 브레이크포인트 — WebAIM 등 대부분의 대비
 * 체커가 쓰는 값). 값을 임의로 조정하지 않는다 — 미달 조합은 테스트 실패 상태로 남겨서 리포트만
 * 하고, 실제 값 변경은 확인 후 사람이 정한다.
 */
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const int = parseInt(full, 16);

  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

function srgbToLinear(c: number): number {
  const cs = c / 255;
  return cs <= 0.03928 ? cs / 12.92 : ((cs + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(srgbToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(hexA: string, hexB: string): number {
  const lA = relativeLuminance(hexA);
  const lB = relativeLuminance(hexB);
  const lighter = Math.max(lA, lB);
  const darker = Math.min(lA, lB);

  return (lighter + 0.05) / (darker + 0.05);
}

interface Combo {
  paletteId: string;
  label: string;
  fg: string;
  fgHex: string;
  bg: string;
  bgHex: string;
  minRatio: number;
}

function buildCombos(): Combo[] {
  const combos: Combo[] = [];

  for (const p of PALETTES) {
    const buttonText = p.accentTextOverride ?? '#FFFFFF';
    combos.push(
      {
        paletteId: p.id,
        label: 'textMain vs bgBase',
        fg: 'textMain',
        fgHex: p.textMain,
        bg: 'bgBase',
        bgHex: p.bgBase,
        minRatio: 4.5,
      },
      {
        paletteId: p.id,
        label: 'textMain vs bgSurface',
        fg: 'textMain',
        fgHex: p.textMain,
        bg: 'bgSurface',
        bgHex: p.bgSurface,
        minRatio: 4.5,
      },
      {
        paletteId: p.id,
        label: 'textSub vs bgBase',
        fg: 'textSub',
        fgHex: p.textSub,
        bg: 'bgBase',
        bgHex: p.bgBase,
        minRatio: 4.5,
      },
      {
        paletteId: p.id,
        label: 'buttonText vs accent',
        fg: 'buttonText',
        fgHex: buttonText,
        bg: 'accent',
        bgHex: p.accent,
        minRatio: 4.5,
      },
      { paletteId: p.id, label: 'ok vs bgBase', fg: 'ok', fgHex: p.ok, bg: 'bgBase', bgHex: p.bgBase, minRatio: 3 },
      {
        paletteId: p.id,
        label: 'warn vs bgBase',
        fg: 'warn',
        fgHex: p.warn,
        bg: 'bgBase',
        bgHex: p.bgBase,
        minRatio: 3,
      },
      { paletteId: p.id, label: 'err vs bgBase', fg: 'err', fgHex: p.err, bg: 'bgBase', bgHex: p.bgBase, minRatio: 3 },
    );
  }

  return combos;
}

describe('palette contrast report (전체 91개 조합, 통과/미달 전부 출력)', () => {
  it('prints the full pass/fail table', () => {
    const combos = buildCombos();
    const rows = combos.map((c) => {
      const ratio = contrastRatio(c.fgHex, c.bgHex);
      const pass = ratio >= c.minRatio;

      return {
        palette: c.paletteId,
        combo: c.label,
        fg: c.fgHex,
        bg: c.bgHex,
        ratio: `${ratio.toFixed(2)}:1`,
        min: `${c.minRatio}:1`,
        result: pass ? 'PASS' : 'FAIL',
      };
    });

    console.table(rows);

    const failCount = rows.filter((r) => r.result === 'FAIL').length;

    console.log(`총 ${rows.length}개 조합 중 미달 ${failCount}개`);

    // 이 테스트 자체는 리포트용이라 항상 통과한다 — 실제 게이트는 아래 개별 it()들이다.
    expect(rows.length).toBe(combos.length);
  });
});

describe('palette contrast (WCAG, 개별 게이트)', () => {
  for (const palette of PALETTES) {
    describe(`${palette.id} (${palette.name})`, () => {
      const buttonText = palette.accentTextOverride ?? '#FFFFFF';

      it('textMain vs bgBase >= 4.5:1', () => {
        const ratio = contrastRatio(palette.textMain, palette.bgBase);
        expect(ratio, `${palette.textMain} vs ${palette.bgBase} = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
      });

      it('textMain vs bgSurface >= 4.5:1', () => {
        const ratio = contrastRatio(palette.textMain, palette.bgSurface);
        expect(ratio, `${palette.textMain} vs ${palette.bgSurface} = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
          4.5,
        );
      });

      it('textSub vs bgBase >= 4.5:1', () => {
        const ratio = contrastRatio(palette.textSub, palette.bgBase);
        expect(ratio, `${palette.textSub} vs ${palette.bgBase} = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
      });

      it('button text vs accent >= 4.5:1', () => {
        const ratio = contrastRatio(buttonText, palette.accent);
        expect(ratio, `${buttonText} vs ${palette.accent} = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
      });

      it('ok vs bgBase >= 3:1', () => {
        const ratio = contrastRatio(palette.ok, palette.bgBase);
        expect(ratio, `${palette.ok} vs ${palette.bgBase} = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
      });

      it('warn vs bgBase >= 3:1', () => {
        const ratio = contrastRatio(palette.warn, palette.bgBase);
        expect(ratio, `${palette.warn} vs ${palette.bgBase} = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
      });

      it('err vs bgBase >= 3:1', () => {
        const ratio = contrastRatio(palette.err, palette.bgBase);
        expect(ratio, `${palette.err} vs ${palette.bgBase} = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
      });
    });
  }
});
