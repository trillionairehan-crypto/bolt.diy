"""리포트 빌드 — report.template.html 의 __ROWS__/__SUMMARY__ 자리에 table.json/summary.json 을 심어 report-<date>.html 을 만든다.

  python tests/benchmark/cssda/report.py tests/benchmark/cssda/2026-09-11
"""
import json
import sys
from pathlib import Path

out = Path(sys.argv[1] if len(sys.argv) > 1 else "tests/benchmark/cssda/2026-09-11")
here = Path(__file__).parent
rows = json.load(open(out / "table.json", encoding="utf-8"))
summary = json.load(open(out / "summary.json", encoding="utf-8"))

keep = [
    "id", "title", "url", "score", "ui", "ux", "inn", "award", "agency", "country", "category", "tags", "tech", "webgl", "video",
    "dark", "headPx", "headW", "headUp", "vh", "jsKB", "imgMB", "cursor", "preloader", "marquee", "loadMs", "ok",
    "m_idleMotion", "m_hoverDiff", "m_inertia", "m_journeyChange", "m_elements", "m_scrollTriggers", "m_lenis", "m_gsap", "m_rafPerSec",
]
slim = [{k: r.get(k) for k in keep} for r in rows]
html = (here / "report.template.html").read_text(encoding="utf-8")
html = html.replace("__ROWS__", json.dumps(slim, ensure_ascii=False, separators=(",", ":")))
html = html.replace("__SUMMARY__", json.dumps(summary, ensure_ascii=False, separators=(",", ":")))
target = here / f"report-{out.name}.html"
target.write_text(html, encoding="utf-8")
print(f"{target} ({target.stat().st_size // 1024} KB)")
