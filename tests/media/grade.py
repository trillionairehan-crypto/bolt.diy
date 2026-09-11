"""후처리 그레이딩 — 생성 이미지의 'render-look / plastic' 지적을 줄이는 결정론적 필름 룩.
그레인(휘도 노이즈, 그림자에 더) + 할레이션(하이라이트 번짐) + 미세 소프트 + S커브 + 비네트 + 채도 -8%.

  python tests/media/grade.py <in.jpg> <out.jpg> [--strength 1.0] [--look documentary|noir|luxury|editorial-food]
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

args = sys.argv[1:]
src, dst = Path(args[0]), Path(args[1])
strength = float(args[args.index("--strength") + 1]) if "--strength" in args else 1.0
look = args[args.index("--look") + 1] if "--look" in args else "documentary"

im = Image.open(src).convert("RGB")
w, h = im.size
a = np.asarray(im).astype(np.float32) / 255.0

# 1) 채도 -8%, 룩별 톤 커브
lum = a @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
a = a * 0.92 + lum[..., None] * 0.08
if look == "noir":
    a = np.clip((a - 0.06) / 0.94, 0, 1) ** 1.08  # 블랙 크러시
elif look == "luxury":
    a = a ** 1.03
else:
    a = 0.02 + a * 0.98  # 블랙 살짝 리프트(필름)
# S커브
a = np.clip(a, 0, 1)
a = a * a * (3 - 2 * a) * 0.35 + a * 0.65

# 2) 할레이션: 밝은 영역 블러를 따뜻하게 더함
bright = np.clip((lum - 0.72) / 0.28, 0, 1)
halo = Image.fromarray((bright * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius=max(4, w // 160)))
halo = np.asarray(halo).astype(np.float32) / 255.0
a += halo[..., None] * np.array([0.06, 0.035, 0.015], dtype=np.float32) * strength

# 3) 미세 소프트(디지털 날카로움 제거) — 원본 92% + 블러 8%
soft = np.asarray(Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius=1.1))).astype(np.float32) / 255.0
a = a * 0.92 + soft * 0.08

# 4) 그레인: 휘도 노이즈, 그림자/중간톤에 더 강하게, 약간 굵게
rng = np.random.default_rng(7)
noise = rng.normal(0, 1, (h // 2, w // 2)).astype(np.float32)
noise = np.asarray(Image.fromarray(((noise * 32) + 128).clip(0, 255).astype(np.uint8)).resize((w, h), Image.BILINEAR)).astype(np.float32)
noise = (noise - 128) / 32
weight = (1 - np.clip(lum, 0, 1)) * 0.6 + 0.4
a += (noise * 0.028 * strength * weight)[..., None]

# 5) 비네트
yy, xx = np.mgrid[0:h, 0:w]
r = np.sqrt(((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2)
vig = 1 - np.clip((r - 0.65) / 0.75, 0, 1) ** 2 * 0.18 * strength
a *= vig[..., None]

Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).save(dst, quality=93)
print(dst, im.size)
