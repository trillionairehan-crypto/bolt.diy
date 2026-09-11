import { describe, expect, it } from 'vitest';
import { gradeMetrics, measurePixels, type PhotoMetrics, type PixelImage } from './photo-grade';

function image(width: number, height: number, fill: (x: number, y: number) => [number, number, number]): PixelImage {
  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = fill(x, y);
      const i = (y * width + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }

  return { data, width, height };
}

const good: PhotoMetrics = { longEdge: 3000, sharpness: 200, clipping: 0.005, colorCast: 4, clutter: 0.03 };

describe('photo-grade: measurePixels (합성 이미지)', () => {
  it('균일한 회색 — 선명도 0, 클리핑 0, 색 편차 0, 엣지 0', () => {
    const m = measurePixels(
      image(64, 48, () => [128, 128, 128]),
      4000,
    );
    expect(m).toEqual({ longEdge: 4000, sharpness: 0, clipping: 0, colorCast: 0, clutter: 0 });
  });

  it('2px 체커보드 — 라플라시안 분산이 크고(선명), 중앙 엣지 밀도가 높다(잡동사니)', () => {
    const m = measurePixels(
      image(64, 64, (x, y) => ((Math.floor(x / 2) + Math.floor(y / 2)) % 2 ? [255, 255, 255] : [0, 0, 0])),
      4000,
    );
    expect(m.sharpness).toBeGreaterThan(120);
    expect(m.clutter).toBeGreaterThan(0.16);
  });

  it('부드러운 그라데이션 — 선명도는 낮지만 엣지는 없다', () => {
    const m = measurePixels(
      image(64, 64, (x) => [x * 4, x * 4, x * 4]),
      4000,
    );
    expect(m.sharpness).toBeLessThan(60);
    expect(m.clutter).toBe(0);
  });

  it('클리핑 — 왼쪽 10%가 순백이면 clipping ≈ 0.1', () => {
    const m = measurePixels(
      image(100, 10, (x) => (x < 10 ? [255, 255, 255] : [120, 120, 120])),
      4000,
    );
    expect(m.clipping).toBeCloseTo(0.1, 2);
  });

  it('색 편차 — R 우세(형광등 누런끼)면 colorCast = R−B 평균 차', () => {
    const m = measurePixels(
      image(20, 20, () => [180, 160, 140]),
      4000,
    );
    expect(m.colorCast).toBe(40);
  });
});

describe('photo-grade: gradeMetrics (스펙 임계값)', () => {
  it('전 지표 A → A, 이유 "그대로 씁니다"', () => {
    expect(gradeMetrics(good)).toMatchObject({ grade: 'A', reason: '그대로 씁니다' });
  });

  it('해상도 1600~2399 → B, 1599 → C', () => {
    expect(gradeMetrics({ ...good, longEdge: 2399 }).grade).toBe('B');
    expect(gradeMetrics({ ...good, longEdge: 1600 }).grade).toBe('B');
    expect(gradeMetrics({ ...good, longEdge: 1599 }).grade).toBe('C');
  });

  it('선명도 60~119 → B(트리트먼트), <60 → C(흐림 팁)', () => {
    expect(gradeMetrics({ ...good, sharpness: 80 })).toMatchObject({
      grade: 'B',
      reason: expect.stringContaining('초점'),
    });
    expect(gradeMetrics({ ...good, sharpness: 30 })).toMatchObject({
      grade: 'C',
      reason: expect.stringContaining('증거 썸네일'),
      tip: expect.stringContaining('초점'),
    });
  });

  it('클리핑 2~6% → B, ≥6% → C', () => {
    expect(gradeMetrics({ ...good, clipping: 0.03 }).grade).toBe('B');
    expect(gradeMetrics({ ...good, clipping: 0.06 }).grade).toBe('C');
  });

  it('색 편차는 C가 없다 — 12 이상은 B(트리트먼트로 잡음)', () => {
    expect(gradeMetrics({ ...good, colorCast: 60 })).toMatchObject({
      grade: 'B',
      reason: expect.stringContaining('트리트먼트'),
    });
  });

  it('잡동사니 0.08~0.16 → B(디테일 크롭), >0.16 → C', () => {
    expect(gradeMetrics({ ...good, clutter: 0.1 })).toMatchObject({
      grade: 'B',
      reason: expect.stringContaining('디테일 크롭'),
    });
    expect(gradeMetrics({ ...good, clutter: 0.2 }).grade).toBe('C');
  });

  it('텍스트·워터마크 → C, 다른 지표가 좋아도', () => {
    expect(gradeMetrics({ ...good, hasText: true })).toMatchObject({
      grade: 'C',
      reason: expect.stringContaining('글자'),
    });
  });

  it('최종 등급은 최악 지표 — B 지표와 C 지표가 섞이면 C, 이유는 C 지표로', () => {
    const v = gradeMetrics({ ...good, colorCast: 40, longEdge: 1000 });
    expect(v.grade).toBe('C');
    expect(v.reason).toContain('해상도');
  });
});
