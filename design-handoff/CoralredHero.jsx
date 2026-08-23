// CoralredHero — 인터랙티브 로고 히어로 (React)
// 사용법: <CoralredHero onNavigate={(href) => router.push(href)} />
// 폰트: IBM Plex Sans KR 로드 필요. 배경 #FF5330 위에서 사용.

const TILES = [
  {
    "x": 153,
    "y": 63,
    "s": 104,
    "rx": 30,
    "bg": "#FAF7F0",
    "ink": "#FF5330",
    "label": "AI 빌더",
    "href": "#ai",
    "dur": 3.6,
    "delay": 0
  },
  {
    "x": 63,
    "y": 153,
    "s": 104,
    "rx": 30,
    "bg": "#FAF7F0",
    "ink": "#FF5330",
    "label": "템플릿",
    "href": "#templates",
    "dur": 4.2,
    "delay": 0.6
  },
  {
    "x": 63,
    "y": 255,
    "s": 104,
    "rx": 30,
    "bg": "#FAF7F0",
    "ink": "#FF5330",
    "label": "데이터",
    "href": "#data",
    "dur": 3.9,
    "delay": 1.2
  },
  {
    "x": 153,
    "y": 345,
    "s": 104,
    "rx": 30,
    "bg": "#FAF7F0",
    "ink": "#FF5330",
    "label": "배포",
    "href": "#deploy",
    "dur": 4.4,
    "delay": 0.3
  },
  {
    "x": 289,
    "y": 84,
    "s": 84,
    "rx": 26,
    "bg": "#FFB5A3",
    "ink": "#8F2410",
    "label": "연동",
    "href": "#integrations",
    "dur": 4,
    "delay": 0.9
  },
  {
    "x": 289,
    "y": 344,
    "s": 84,
    "rx": 26,
    "bg": "#FFB5A3",
    "ink": "#8F2410",
    "label": "협업",
    "href": "#team",
    "dur": 3.7,
    "delay": 1.5
  }
];

const KEYFRAMES = `@keyframes cr-float { from { transform: translateY(-6px); } to { transform: translateY(6px); } }`;

export default function CoralredHero({ onNavigate, scale = 1 }) {
  return (
    <div style={{ position: 'relative', width: 512 * scale, height: 512 * scale, fontFamily: "'IBM Plex Sans KR', Helvetica, sans-serif" }}>
      <style>{KEYFRAMES}</style>
      {TILES.map((t) => (
        <div key={t.label} style={{ position: 'absolute', left: t.x * scale, top: t.y * scale, animation: `cr-float ${t.dur}s ease-in-out ${t.delay}s infinite alternate` }}>
          <a
            href={t.href}
            onClick={(e) => { if (onNavigate) { e.preventDefault(); onNavigate(t.href); } }}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 * scale,
              width: t.s * scale, height: t.s * scale, borderRadius: t.rx * scale, background: t.bg, color: t.ink,
              fontSize: (t.s === 84 ? 13 : 15) * scale, fontWeight: 700, letterSpacing: '-0.01em', textDecoration: 'none',
              transition: 'transform .25s cubic-bezier(.34,1.56,.64,1), box-shadow .25s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.1) translateY(-6px)'; e.currentTarget.style.boxShadow = '0 20px 40px rgba(23,16,14,.25)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
          >
            <span style={{ width: 12 * scale, height: 12 * scale, borderRadius: 6 * scale, background: 'currentColor' }} />
            {t.label}
          </a>
        </div>
      ))}
    </div>
  );
}
