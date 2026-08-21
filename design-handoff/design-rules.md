# Coralred Design Logic v2

생성 파이프라인용 시스템 프롬프트 + 컴포넌트 킷. 빌더가 하는 일은 두 가지뿐:
`coralred-ui.css`를 모든 생성 페이지에 주입하고, `<body>`에 `--hue`(0–360)를 치환한다.

**v2 변경 요약**: 채움 위 텍스트 자동 대비(`--on-accent`, 노랑·라임에서 자동 흑색 전환) ·
텍스트용 액센트 분리(`--accent-text`, 링크/배지 가독성 보장) · `.cr-btn.danger` 추가(파괴적 액션) ·
한국어 폰트 스택(Pretendard 폴백) · focus-visible/disabled 상태 · `.cr-nav-item` ·
`.cr-eyebrow` · `textarea.cr-input` · tabular-nums · `color-scheme` · reduced-motion.
요구 브라우저: 2024+ 에버그린(relative color syntax).

## 폰트 프리로드 (빌더가 head에 주입)

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
```

## 시스템 프롬프트 블록 (매 생성 요청에 prepend — 캐싱 가능한 고정 구간에 배치)

```
You are generating production-grade UI. coralred-ui.css is preloaded. Follow these rules
with no exceptions. Never redefine cr- classes or the kit's CSS variables.

COLOR: never write raw color values (hex/rgb/oklch) or arbitrary px sizes. Everything comes
  from the kit's variables and cr- classes. Brand color = --hue on <body> (builder sets it).
  Dark mode = data-theme="dark" on <body>. Text contrast on solid fills is handled by the
  kit automatically. Semantic colors exist ONLY as .cr-badge.ok/.warn/.err and .cr-btn.danger
  — never as section or card backgrounds.

TYPE: .cr-display 44 / .cr-h1 28 / .cr-h2 20 / .cr-body 15 / .cr-caption 13 / .cr-mono 12.5
  / .cr-eyebrow (mono micro-label). No other font sizes anywhere.
  Korean: word-break keep-all is global — never override it.

LAYOUT: .cr-page (max 1120) > .cr-section (96px vertical rhythm). Inside:
  .cr-stack-{4,8,16,24} for vertical, .cr-row-{8,16} for horizontal, .cr-grid-{2,3,4} for grids.
  All spacing comes from these helpers — no improvised margin/padding.
  Structure with 1px borders (.cr-card), never shadows on cards. Shadows only on .cr-overlay.

COMPONENTS: .cr-btn (solid) / +outline / +ghost / +lg / +danger. Exactly ONE solid button
  per view (.danger counts as the solid). Destructive actions: .cr-btn.danger for the final
  confirm; anywhere else use .outline with .cr-caption warning text.
  .cr-input (+ textarea.cr-input), .cr-label, .cr-badge(+ok/warn/err), .cr-table,
  .cr-nav-item(+.active) for sidebars/tabs, .cr-overlay for modals/popovers.

ICONS: lucide-react in React output; otherwise inline SVG with stroke="currentColor",
  stroke-width 1.5, size 16 or 20. Icons only when they carry function — never decoration.

CHARTS: one accent color for the emphasized series only; all other series use border/muted
  tones. Never multicolor palettes, never gradients.

FORBIDDEN: raw color values, arbitrary px sizes, gradients on backgrounds, emoji in UI,
  font families beyond the two loaded, drop shadows on cards, border-left accent bars,
  border-radius > 12px, centered body text longer than 2 lines, pure #000/#fff in body
  text (kit-rendered text on solid fills is the one sanctioned exception — the kit sets it).

SELF-CHECK before finishing every file:
  (1) zero raw color values anywhere in your output
  (2) zero px sizes outside kit classes
  (3) exactly one solid button per view
  (4) works in both themes (mentally toggle data-theme)
  (5) Korean strings wrap cleanly (keep-all intact)
```

## 대비 보증 방식 (문서화 — LLM에게는 노출 불필요)

- **채움 위 텍스트**: `--on-accent`가 YIQ 휘도(임계 150)로 흑/백을 자동 선택.
  파랑·보라·레드 계열 → 흰 텍스트, 노랑·라임·민트 계열 → 검정 텍스트.
  다크 모드는 전 hue에서 `--bg`(어두운 텍스트)로 통일 — L 0.66 채움 위에서 항상 안전.
- **밝은 배경 위 액센트 텍스트**(링크, 기본 배지, eyebrow): `--accent-text`가 L을 0.5로
  클램프 — 노랑 브랜드에서도 링크가 읽힌다. 채움용 `--accent`와 분리된 이유.
- 이 두 토큰은 CSS가 계산한다. LLM이 색을 고르는 일 자체가 없으므로 대비 실수가
  구조적으로 발생하지 않는다.

## Recipes by output type (토큰은 공유, 스켈레톤만 다름)

여기서 "gaps"는 `.cr-stack-*`/`.cr-grid-*` 스케일을 뜻한다. `.cr-section`(96px)은 섹션 리듬이고
별개 — 둘을 혼동하지 말 것.

- **Landing**: centered hero, `.cr-display`, 섹션 리듬은 `.cr-section` 그대로,
  CTA = solid 1 + ghost 1, eyebrow 배지로 오프닝
- **SaaS dashboard**: 240px sidebar(`.cr-nav-item` 목록) + 56px header;
  stat cards(`.cr-grid-3` + `.cr-card`) → chart → `.cr-table`; 내부는 `.cr-stack-16/24` 밀도
- **E-commerce**: 제품 이미지가 주인공 — UI는 중립으로 후퇴; `.cr-grid-4`; 가격은 `.cr-mono`
- **Blog/content**: 본문 680px, 18px/1.7은 예외적으로 허용되는 유일한 커스텀 스케일;
  장식 최소 — 타이포가 전부
- **Portfolio**: 최대 여백, full-bleed 작업물; 텍스트는 caption 스케일
- **Admin**: table-first; 44px 행; 줄무늬 금지, hover 행 하이라이트만

## 한계 (정직하게)

이 킷이 구조적으로 제거하는 오류: 임의 색상, 대비 실패, 간격/크기 불일치, 테마 깨짐,
포커스 상태 누락. 제거하지 못하는 오류: LLM이 import를 빠뜨리거나 존재하지 않는 데이터
필드를 참조하는 류의 **로직 오류** — 이건 생성 후 빌드 검증 단계(별도 작업)가 맡는다.
"오류 0"은 이 킷 + 빌드 검증 둘이 합쳐져야 완성된다.
