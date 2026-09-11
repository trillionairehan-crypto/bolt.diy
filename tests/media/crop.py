"""③ 심사 기반 크롭 — 구도 지적(피사체 과대·정중앙·헤드라인 여백 없음)을 크롭만으로 고친다. 픽셀은 손대지 않는다.
원본 16:9에서 3가지 리프레이밍: (a) 피사체를 오른쪽 하단 3분할점으로, (b) 왼쪽 하단, (c) 살짝 당겨 여백 확보(패딩 없이 최대 크롭).
피사체 위치는 밝기·채도 대비로 추정(가장 '눈에 띄는' 영역의 무게중심).

  python tests/media/crop.py <in.jpg> <out-prefix>
출력: <out-prefix>-a.jpg, -b.jpg, -c.jpg
"""
import sys

import numpy as np
from PIL import Image, ImageFilter

src, prefix = sys.argv[1], sys.argv[2]
im = Image.open(src).convert("RGB")
W, H = im.size
a = np.asarray(im).astype(np.float32) / 255.0
lum = a @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
sat = a.max(axis=2) - a.min(axis=2)
# 관심도 = 채도 + 국소 대비(라플라시안 근사)
blur = np.asarray(Image.fromarray((lum * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius=max(2, W // 200)))).astype(np.float32) / 255.0
contrast = np.abs(lum - blur)
sal = sat * 0.6 + contrast * 2.0
sal = np.asarray(Image.fromarray((np.clip(sal, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius=max(4, W // 60)))).astype(np.float32)
yy, xx = np.mgrid[0:H, 0:W]
cx = float((sal * xx).sum() / sal.sum())
cy = float((sal * yy).sum() / sal.sum())
# 피사체 반경(관심도 상위 15% 영역의 퍼짐)
thr = np.quantile(sal, 0.85)
ys, xs = np.where(sal >= thr)
rx = max(W * 0.12, (xs.max() - xs.min()) / 2)
ry = max(H * 0.12, (ys.max() - ys.min()) / 2)


def crop_at(tx: float, ty: float, scale: float) -> Image.Image:
    """피사체 중심(cx,cy)이 프레임의 (tx,ty) 비율 위치에 오도록, 원본의 scale 배 폭으로 16:9 크롭."""
    cw = W * scale
    ch = cw * 9 / 16
    x0 = cx - tx * cw
    y0 = cy - ty * ch
    x0 = min(max(0, x0), W - cw)
    y0 = min(max(0, y0), H - ch)
    return im.crop((int(x0), int(y0), int(x0 + cw), int(y0 + ch))).resize((1600, 900), Image.LANCZOS)


scale = min(1.0, max(0.62, (rx * 2) / (W * 0.42)))  # 피사체가 프레임 폭의 ~40% 차지하도록
crop_at(0.68, 0.64, scale).save(f"{prefix}-a.jpg", quality=93)
crop_at(0.32, 0.64, scale).save(f"{prefix}-b.jpg", quality=93)
crop_at(0.66, 0.6, min(1.0, scale * 1.18)).save(f"{prefix}-c.jpg", quality=93)
print(f"subject ({cx:.0f},{cy:.0f}) r=({rx:.0f},{ry:.0f}) scale {scale:.2f}")
