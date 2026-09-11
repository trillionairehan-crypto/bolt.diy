/**
 * 사진 등급기 — 브라우저 canvas만 쓰고 서버 호출 없음. 스펙: docs/deep-brief-spec.html "사진 등급".
 * 픽셀 계산(measurePixels)과 등급 판정(gradeMetrics)은 순수 함수라 vitest에서 합성 이미지로 고정한다.
 * 파일 → 픽셀은 gradePhotoFile(브라우저 전용)이 맡는다.
 *
 * 등급 = 최악 지표 기준. A: 그대로 사용, B: 쓸 수 있음(트리트먼트·디테일 크롭), C: 히어로·챕터 불가(증거 썸네일만).
 */
import type { PhotoGrade } from '~/lib/onboarding/brief-schema';

export interface PhotoMetrics {
  /** 원본 긴 변 px */
  longEdge: number;

  /** 그레이스케일 라플라시안 분산(긴 변 640px로 축소한 뒤) — 클수록 선명 */
  sharpness: number;

  /** 휘도 0~5 또는 250~255 픽셀 비율 중 큰 쪽(0..1) */
  clipping: number;

  /** R/G/B 채널 평균의 최대 차(0..255) — 형광등 누런끼 */
  colorCast: number;

  /** 중앙 60% 영역의 엣지 밀도(0..1) — 잡동사니 */
  clutter: number;

  /** 텍스트·워터마크·날짜 도장(서버 vision 1회, 선택) */
  hasText?: boolean;
}

export interface PixelImage {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
}

export interface PhotoVerdict {
  grade: PhotoGrade;

  /** 화면에 보여줄 한 줄 — "배경이 어수선해요 → 디테일 크롭으로 씁니다" */
  reason: string;

  /** 다시 찍기 팁(C·B일 때만) */
  tip?: string;

  /** 지표별 등급 — 가장 나쁜 것이 최종 */
  perMetric: Record<keyof Omit<PhotoMetrics, 'hasText'> | 'text', PhotoGrade>;
}

/** 분석 해상도 — 스펙의 선명도 임계(120/60)는 이 크기 기준 */
export const ANALYSIS_LONG_EDGE = 640;

const EDGE_THRESHOLD = 40;

function luminance(data: PixelImage['data'], i: number): number {
  return 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
}

/** 축소된 RGBA 픽셀 + 원본 긴 변 → 지표. 순수 함수. */
export function measurePixels(img: PixelImage, originalLongEdge: number): PhotoMetrics {
  const { data, width, height } = img;
  const n = width * height;
  const lum = new Float32Array(n);
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let dark = 0;
  let bright = 0;

  for (let p = 0; p < n; p++) {
    const i = p * 4;
    const l = luminance(data, i);
    lum[p] = l;
    sumR += data[i];
    sumG += data[i + 1];
    sumB += data[i + 2];

    if (l <= 5) {
      dark++;
    } else if (l >= 250) {
      bright++;
    }
  }

  const means = [sumR / n, sumG / n, sumB / n];
  const colorCast = Math.max(...means) - Math.min(...means);
  const clipping = Math.max(dark, bright) / n;

  // 라플라시안(4-이웃) 분산 — 경계 1px 제외
  let lapSum = 0;
  let lapSq = 0;
  let lapCount = 0;

  // 엣지 밀도 — 중앙 60% 영역에서 |gx|+|gy| > 임계 비율(Canny 대신 결정론적 소벨 근사)
  const cx0 = Math.floor(width * 0.2);
  const cx1 = Math.ceil(width * 0.8);
  const cy0 = Math.floor(height * 0.2);
  const cy1 = Math.ceil(height * 0.8);
  let edges = 0;
  let centerCount = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const p = y * width + x;
      const c = lum[p];
      const lap = lum[p - 1] + lum[p + 1] + lum[p - width] + lum[p + width] - 4 * c;
      lapSum += lap;
      lapSq += lap * lap;
      lapCount++;

      if (x >= cx0 && x < cx1 && y >= cy0 && y < cy1) {
        const gx = lum[p + 1] - lum[p - 1];
        const gy = lum[p + width] - lum[p - width];
        centerCount++;

        if (Math.abs(gx) + Math.abs(gy) > EDGE_THRESHOLD) {
          edges++;
        }
      }
    }
  }

  const mean = lapCount ? lapSum / lapCount : 0;
  const sharpness = lapCount ? lapSq / lapCount - mean * mean : 0;

  return {
    longEdge: originalLongEdge,
    sharpness: Math.round(sharpness * 10) / 10,
    clipping: Math.round(clipping * 1000) / 1000,
    colorCast: Math.round(colorCast * 10) / 10,
    clutter: centerCount ? Math.round((edges / centerCount) * 1000) / 1000 : 0,
  };
}

const worse = (a: PhotoGrade, b: PhotoGrade): PhotoGrade => (a > b ? a : b);

/** 지표 → 등급 + 이유 한 줄. 스펙 표의 임계값과 1:1. */
export function gradeMetrics(m: PhotoMetrics): PhotoVerdict {
  const perMetric: PhotoVerdict['perMetric'] = {
    longEdge: m.longEdge >= 2400 ? 'A' : m.longEdge >= 1600 ? 'B' : 'C',
    sharpness: m.sharpness >= 120 ? 'A' : m.sharpness >= 60 ? 'B' : 'C',
    clipping: m.clipping < 0.02 ? 'A' : m.clipping < 0.06 ? 'B' : 'C',
    colorCast: m.colorCast < 12 ? 'A' : 'B',
    clutter: m.clutter < 0.08 ? 'A' : m.clutter <= 0.16 ? 'B' : 'C',
    text: m.hasText ? 'C' : 'A',
  };
  const grade = (Object.values(perMetric) as PhotoGrade[]).reduce(worse, 'A');

  const reasons: Array<[keyof typeof perMetric, string, string]> = [
    ['text', '글자나 날짜 도장이 있어요 → 증거 썸네일로만 써요', '글자·워터마크 없는 원본으로 다시 올려 주세요'],
    ['longEdge', '해상도가 낮아요', '카메라 원본 크기로 보내 주세요(카톡 전송은 줄어들어요)'],
    ['sharpness', '초점이 흐려요', '피사체를 한 번 탭해 초점을 맞추고, 양손으로 잡고 찍어 주세요'],
    ['clipping', '너무 밝거나 어두운 부분이 커요', '창가 자연광에서, 역광은 피하고 찍어 주세요'],
    ['clutter', '배경이 어수선해요', '배경을 비우고 피사체 하나만 남겨 주세요'],
    ['colorCast', '형광등 색이 끼었어요', '낮에 창가 자연광으로 찍으면 좋아요'],
  ];

  if (grade === 'A') {
    return { grade, reason: '그대로 씁니다', perMetric };
  }

  const first = reasons.find(([k]) => perMetric[k] === grade) ?? reasons[reasons.length - 1];
  const fix =
    grade === 'B'
      ? first[0] === 'clutter'
        ? ' → 디테일 크롭으로 씁니다'
        : first[0] === 'colorCast'
          ? ' → 트리트먼트로 잡습니다'
          : ' → 트리트먼트를 얹어 씁니다'
      : first[0] === 'text'
        ? ''
        : ' → 증거 썸네일로만 써요';

  return { grade, reason: `${first[1]}${fix}`, tip: first[2], perMetric };
}

/**
 * 브라우저 전용: 파일 → 긴 변 640px canvas → 지표 → 등급. jsdom에는 canvas 픽셀이 없으므로 테스트하지 않는다.
 * 실패(디코드 불가 등)하면 C + 이유를 돌려주고 throw 하지 않는다.
 */
export async function gradePhotoFile(
  file: Blob,
): Promise<PhotoVerdict & { metrics: PhotoMetrics; width: number; height: number }> {
  const url = URL.createObjectURL(file);

  try {
    const bitmap = await loadImage(url);
    const width = bitmap.naturalWidth || bitmap.width;
    const height = bitmap.naturalHeight || bitmap.height;
    const scale = Math.min(1, ANALYSIS_LONG_EDGE / Math.max(width, height));
    const w = Math.max(3, Math.round(width * scale));
    const h = Math.max(3, Math.round(height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (!ctx) {
      throw new Error('canvas 2d unavailable');
    }

    ctx.drawImage(bitmap, 0, 0, w, h);

    const metrics = measurePixels(ctx.getImageData(0, 0, w, h), Math.max(width, height));

    return { ...gradeMetrics(metrics), metrics, width, height };
  } catch {
    const metrics: PhotoMetrics = { longEdge: 0, sharpness: 0, clipping: 1, colorCast: 0, clutter: 0 };

    return {
      grade: 'C',
      reason: '이미지를 읽지 못했어요 → 증거 썸네일로만 써요',
      tip: 'JPG·PNG·HEIC 원본으로 다시 올려 주세요',
      perMetric: { longEdge: 'C', sharpness: 'C', clipping: 'C', colorCast: 'A', clutter: 'A', text: 'A' },
      metrics,
      width: 0,
      height: 0,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('decode failed'));
    img.src = url;
  });
}
