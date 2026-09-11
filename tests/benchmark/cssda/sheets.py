"""frames/<id>-{0..7}.jpg 8장을 4x2 콘택트시트 1장으로 합친다 (사람이 스크롤 여정을 한눈에 보게).

  python tests/benchmark/cssda/sheets.py tests/benchmark/cssda/2026-09-11 [id ...]
출력: <out>/sheets/<id>.jpg
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw

out = Path(sys.argv[1] if len(sys.argv) > 1 else "tests/benchmark/cssda/2026-09-11")
only = set(sys.argv[2:])
frames = out / "frames"
sheets = out / "sheets"
sheets.mkdir(exist_ok=True)
titles = {e["id"]: (e.get("title") or "", e.get("finalScore")) for e in json.load(open(out / "entries.json", encoding="utf-8"))}
ids = sorted({p.name.split("-")[0] for p in frames.glob("*-0.jpg")})
W, H = 480, 300
made = 0

for sid in ids:
    if only and sid not in only:
        continue

    sheet = Image.new("RGB", (W * 4, H * 2 + 28), "black")
    draw = ImageDraw.Draw(sheet)
    title, score = titles.get(sid, ("", None))
    draw.text((8, 6), f"{sid}  {score or '-'}  {title[:80]}", fill="white")

    for i in range(8):
        p = frames / f"{sid}-{i}.jpg"

        if not p.exists():
            continue

        im = Image.open(p).convert("RGB").resize((W, H))
        sheet.paste(im, ((i % 4) * W, 28 + (i // 4) * H))

    sheet.save(sheets / f"{sid}.jpg", quality=70)
    made += 1

print(f"{made} sheets → {sheets}")
