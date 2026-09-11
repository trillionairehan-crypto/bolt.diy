"""CSSDA 크롤 결과 집계 — entries.json(점수·심사위원·태그) + sites.json(기술·타이포·색·구조) → 콘솔 표 + summary.json.

  python tests/benchmark/cssda/analyze.py tests/benchmark/cssda/2026-09-11
"""
import json
import re
import statistics as st
import sys
from collections import Counter, defaultdict
from pathlib import Path

out = Path(sys.argv[1] if len(sys.argv) > 1 else "tests/benchmark/cssda/2026-09-11")
entries = json.load(open(out / "entries.json", encoding="utf-8"))
sites = {s["id"]: s for s in json.load(open(out / "sites.json", encoding="utf-8"))}
rows = [dict(e, **sites.get(e["id"], {})) for e in entries]
# 3차 패스(tech.json)가 있으면 1차의 느슨한 정규식 결과를 덮어쓴다
tech_path = out / "tech.json"
if tech_path.exists():
    strict = {t["id"]: t for t in json.load(open(tech_path, encoding="utf-8")) if t.get("ok")}
    for r in rows:
        if r["id"] in strict:
            r["tech"] = strict[r["id"]]["tech"]
            r["hasWebGLCanvas"] = strict[r["id"]].get("hasWebGLCanvas")
    print(f"strict tech merged for {len(strict)} sites")
ok = [r for r in rows if r.get("ok")]
scored = [r for r in rows if r.get("finalScore")]


def mean(xs):
    xs = [x for x in xs if isinstance(x, (int, float))]
    return round(st.mean(xs), 2) if xs else None


def pct(n, d):
    return f"{100 * n / d:.0f}%" if d else "-"


def parse_rgb(s):
    m = re.findall(r"\d+(?:\.\d+)?", s or "")
    if len(m) < 3:
        return None
    r, g, b = (float(x) for x in m[:3])
    a = float(m[3]) if len(m) > 3 else 1
    if a == 0:
        return None
    return (r + g + b) / 3


summary = {}
print(f"entries {len(entries)} | visited ok {len(ok)} | scored {len(scored)}")

# 1. 점수
fs = [r["finalScore"] for r in scored]
summary["score"] = {
    "n": len(fs),
    "mean": mean(fs),
    "min": min(fs) if fs else None,
    "max": max(fs) if fs else None,
    "ui": mean([r.get("ui") for r in scored]),
    "ux": mean([r.get("ux") for r in scored]),
    "innovation": mean([r.get("innovation") for r in scored]),
}
print("\n## 점수", summary["score"])
by_award = defaultdict(list)
for r in scored:
    by_award[(r.get("award") or "?").split(" 20")[0]].append(r["finalScore"])
print("award별:", {k: (len(v), mean(v)) for k, v in by_award.items()})

# 2. 심사위원
judge = defaultdict(list)
for r in scored:
    for j in r.get("judges") or []:
        if "FINAL JUDGE" in j["name"].upper():
            continue
        # 같은 사람이 직함 토큰이 잘려 다른 이름으로 잡히는 경우 합치기(앞 두 단어)
        key = " ".join(j["name"].split()[:2])
        judge[key].append((j["avg"], j["ui"], j["ux"], j["inn"]))
summary["judges"] = {
    k: {"n": len(v), "avg": mean([x[0] for x in v]), "ui": mean([x[1] for x in v]), "ux": mean([x[2] for x in v]), "inn": mean([x[3] for x in v]), "sd": round(st.pstdev([x[0] for x in v]), 2) if len(v) > 1 else 0}
    for k, v in sorted(judge.items(), key=lambda kv: -len(kv[1]))
}
print("\n## 심사위원 (n, avg, ui, ux, inn, sd)")
for k, v in summary["judges"].items():
    print(f"  {k:28s} {v}")

# 3. 태그·카테고리·국가
tags = Counter(t for r in entries for t in (r.get("tags") or []))
cats = Counter((r.get("category") or "?").strip() for r in entries)
countries = Counter((r.get("country") or "?") for r in entries)
summary["tags"] = tags.most_common(20)
summary["categories"] = cats.most_common(15)
summary["countries"] = countries.most_common(15)
print("\n## 태그", tags.most_common(15))
print("## 카테고리", cats.most_common(10))
print("## 국가", countries.most_common(10))

# 4. 기술
tech = Counter(t for r in ok for t in (r.get("tech") or []))
summary["tech"] = [(k, v, pct(v, len(ok))) for k, v in tech.most_common()]
print("\n## 기술 (n, share of visited)")
for k, v, p in summary["tech"]:
    print(f"  {k:14s} {v:3d} {p}")


def tech_score(name):
    with_ = [r["finalScore"] for r in ok if r.get("finalScore") and name in (r.get("tech") or [])]
    without = [r["finalScore"] for r in ok if r.get("finalScore") and name not in (r.get("tech") or [])]
    return (len(with_), mean(with_), len(without), mean(without))


summary["tech_vs_score"] = {t: tech_score(t) for t, _, _ in summary["tech"][:12]}
print("\n## 기술 유무별 평균 점수 (n_with, mean_with, n_without, mean_without)")
for k, v in summary["tech_vs_score"].items():
    print(f"  {k:14s} {v}")

# 5. 구조·미디어
canvas = sum(1 for r in ok if (r.get("canvas") or 0) > 0)
video = sum(1 for r in ok if (r.get("video") or 0) > 0)
cursor = sum(1 for r in ok if r.get("cursorEl"))
pre = sum(1 for r in ok if r.get("preloaderEl"))
snap = sum(1 for r in ok if r.get("scrollSnap"))
marq = sum(1 for r in ok if r.get("marquee"))
blend = sum(1 for r in ok if r.get("blend"))
webgl = sum(1 for r in ok if r.get("hasWebGLCanvas"))
summary["structure"] = {
    "webglCanvas(실측)": pct(webgl, len(ok)),
    "canvas": pct(canvas, len(ok)),
    "video": pct(video, len(ok)),
    "cursorEl": pct(cursor, len(ok)),
    "preloaderEl": pct(pre, len(ok)),
    "scrollSnap": pct(snap, len(ok)),
    "marquee": pct(marq, len(ok)),
    "mixBlend": pct(blend, len(ok)),
    "viewportsTall_median": st.median([r["viewportsTall"] for r in ok if r.get("viewportsTall")]) if ok else None,
    "sections_median": st.median([r["sections"] for r in ok if r.get("sections") is not None]) if ok else None,
    "jsKB_median": round(st.median([r["jsBytes"] for r in ok if r.get("jsBytes")]) / 1024) if ok else None,
    "imgKB_median": round(st.median([r["imgBytes"] for r in ok if r.get("imgBytes") is not None]) / 1024) if ok else None,
    "requests_median": st.median([r["requests"] for r in ok if r.get("requests")]) if ok else None,
    "loadMs_median": st.median([r["loadMs"] for r in ok if r.get("loadMs")]) if ok else None,
}
print("\n## 구조·미디어", summary["structure"])

# 6. 색·타이포
dark = sum(1 for r in ok if (parse_rgb(r.get("bodyBg")) or parse_rgb(r.get("htmlBg")) or 255) < 100)
light = sum(1 for r in ok if (parse_rgb(r.get("bodyBg")) or parse_rgb(r.get("htmlBg")) or 255) > 200)
heads = [r["largestHeading"] for r in ok if r.get("largestHeading")]
sizes = [h["size"] for h in heads if h.get("size")]
weights = Counter(str(h.get("weight")) for h in heads)
transforms = Counter(h.get("transform") for h in heads)
families = Counter(h.get("family") for h in heads)
body_fonts = Counter(r.get("bodyFont") for r in ok)
summary["visual"] = {
    "darkBg": pct(dark, len(ok)),
    "lightBg": pct(light, len(ok)),
    "headingPx_median": st.median(sizes) if sizes else None,
    "headingPx_p75": sorted(sizes)[int(len(sizes) * 0.75)] if sizes else None,
    "headingPx_max": max(sizes) if sizes else None,
    "headingWeights": weights.most_common(6),
    "headingTransform": transforms.most_common(3),
    "headingFamilies": families.most_common(12),
    "bodyFonts": body_fonts.most_common(12),
    "uppercaseEls_median": st.median([r["uppercaseCount"] for r in ok if r.get("uppercaseCount") is not None]) if ok else None,
}
print("\n## 색·타이포", json.dumps(summary["visual"], ensure_ascii=False, indent=1))

# 7. 상위 10 / 하위 10
top = sorted(scored, key=lambda r: -r["finalScore"])[:10]
bottom = sorted(scored, key=lambda r: r["finalScore"])[:10]
summary["top10"] = [(r["finalScore"], r.get("title"), r.get("url"), r.get("tech")) for r in top]
summary["bottom10"] = [(r["finalScore"], r.get("title"), r.get("url"), r.get("tech")) for r in bottom]
print("\n## 상위 10")
for r in top:
    print(f"  {r['finalScore']} {r.get('title')} | {r.get('url')} | {r.get('tech')} | tags={r.get('tags')}")
print("## 하위 10")
for r in bottom:
    print(f"  {r['finalScore']} {r.get('title')} | {r.get('url')} | {r.get('tech')} | tags={r.get('tags')}")

# 8. 움직임(2차 패스)
motion_path = out / "motion.json"
if motion_path.exists():
    motion = {m["id"]: m for m in json.load(open(motion_path, encoding="utf-8")) if m.get("ok")}
    mrows = [dict(r, **motion[r["id"]]) for r in rows if r["id"] in motion]

    def share(pred):
        return pct(sum(1 for m in mrows if pred(m)), len(mrows))

    summary["motion"] = {
        "n": len(mrows),
        "idleMotion>0.02 (앰비언트 모션)": share(lambda m: (m.get("idleMotion") or 0) > 0.02),
        "hoverDiff>0.01 (호버 반응)": share(lambda m: (m.get("hoverDiff") or 0) > 0.01),
        "inertia>0.02 (스무스/관성 스크롤)": share(lambda m: (m.get("inertia") or 0) > 0.02),
        "parallax>=2 (패럴랙스 요소)": share(lambda m: (m.get("elements") or {}).get("parallax", 0) >= 2),
        "pinned>=1 (핀/스티키 장면)": share(lambda m: (m.get("elements") or {}).get("pinned", 0) >= 1),
        "scrollHijack/snap": share(lambda m: "note" in (m.get("elements") or {})),
        "lenis": share(lambda m: m.get("lenis")),
        "gsap": share(lambda m: m.get("gsap")),
        "scrollTriggers_median": st.median([m["scrollTriggers"] for m in mrows if m.get("scrollTriggers")]) if any(m.get("scrollTriggers") for m in mrows) else None,
        "journeyChange_median": st.median([m["journeyChange"] for m in mrows if m.get("journeyChange") is not None]) if mrows else None,
        "idleMotion_median": st.median([m["idleMotion"] for m in mrows if m.get("idleMotion") is not None]) if mrows else None,
    }
    print("\n## 움직임", json.dumps(summary["motion"], ensure_ascii=False, indent=1))

    def bucket(key, thr):
        hi = [m["finalScore"] for m in mrows if m.get("finalScore") and (m.get(key) or 0) > thr]
        lo = [m["finalScore"] for m in mrows if m.get("finalScore") and (m.get(key) or 0) <= thr]
        return (len(hi), mean(hi), len(lo), mean(lo))

    summary["motion_vs_score"] = {
        "idleMotion>0.02": bucket("idleMotion", 0.02),
        "inertia>0.02": bucket("inertia", 0.02),
        "hoverDiff>0.01": bucket("hoverDiff", 0.01),
        "journeyChange>0.15": bucket("journeyChange", 0.15),
    }
    print("## 움직임 유무별 평균 점수 (n_hi, mean_hi, n_lo, mean_lo)", summary["motion_vs_score"])

failed = [r for r in rows if not r.get("ok")]
summary["failed"] = [(r.get("title"), r.get("url"), r.get("error")) for r in failed]
print(f"\n## 방문 실패 {len(failed)}")
for r in failed:
    print(f"  {r.get('title')} | {r.get('url')} | {r.get('error')}")

json.dump(summary, open(out / "summary.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("\nsummary.json saved")
