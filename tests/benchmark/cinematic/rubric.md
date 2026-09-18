# 시네마틱 킷 채점표 (0단계 기준선)

작성 2026-09-11. 10항목 × 0~1점 = 10점 만점. 0.5점 허용. 데스크톱 1280×800 스크린샷 3지점(상단·50%·하단) + 실제 스크롤 조작으로 채점한다.

## 레퍼런스 사이트 3개

| # | 사이트 | 왜 이걸 기준으로 삼나 |
|---|---|---|
| R1 | landonorris.com (Awwwards Site of the Year 2025, OFF+BRAND) | 스크롤 연출 + 3D 오브젝트(헬멧) + 큰 타이포. "제품 소개형" 시네마틱의 현재 상한선 |
| R2 | lusion.co | WebGL 셰이더 배경·전환의 교과서. 스튜디오 사이트라 콘텐츠는 적고 연출이 전부 |
| R3 | apple.com 제품 페이지(아이폰 등) | 영상·이미지 스크럽 + 절제된 타이포. "비싸 보이는데 조용한" 쪽 기준. 과한 WebGL 없이도 영화 같을 수 있다는 증거 |

R1·R2는 2026-09-11 브라우저에서 직접 열어 3지점 스크롤하며 채점했다. R3(apple.com)은 Chrome 확장 사이트 권한에 막혀 미채점 — 확장 설정에서 apple.com 허용하면 같은 방식으로 채점 가능. 바꾸고 싶으면 이 표만 바꾸면 된다.

### 레퍼런스 점수 (상한선)

| # | 항목 | R1 landonorris | R2 lusion | 근거 |
|---|---|---|---|---|
| 1 | WebGL 배경 | 1 | 1 | R1 등고선 라인 배경 + 3D 헬멧, R2 물리 3D 오브젝트 무리 |
| 2 | 스크롤 연출 | 1 | 1 | R1 마키 텍스트·핀·사진 리빌, R2 스무스 스크롤 + 히어로 축소 핀 |
| 3 | 전면 미디어 | 1 | 1 | R1 인물 영상/사진 전면, R2 3D 캔버스 전면 |
| 4 | 3D·AR | 1 | 1 | 둘 다 실시간 3D. AR 버튼은 둘 다 없음(1점 기준은 3D만으로 충족) |
| 5 | 전환·커서·프리로더 | 1 | 1 | R1 시그니처 드로잉 프리로더·메뉴 전환, R2 커서·메뉴 전환 |
| 6 | 타이포 | 1 | 1 | R1 세리프+산세리프 혼용 120px+, R2 그로테스크 160px+ |
| 7 | 성능 | 0.5 | 0.5 | 데스크톱 첫 렌더 3~5초 체감. 모바일 미측정 |
| 8 | 모바일 | – | – | 미측정 |
| 9 | 카피 | 1 | 1 | 짧고 구체적, 자리표시 없음 |
| 10 | 일관성 | 1 | 1 | 색 2~3개, 서체 2개로 전 구간 통일 |
| | **합계(8항목 기준 환산)** | **9.5** | **9.5** | 모바일 제외 |

두 사이트의 공통 구조: **3D/영상 히어로 1개 + 거대 타이포 + 스크롤 연출 + 사진 몇 장**. 챕터 수 적음(4~6). 골격 7의 "히어로 + 챕터 3" 구조 자체는 맞고, 채워 넣는 재료가 0인 게 문제.

## 10항목

| # | 항목 | 1점 기준 | 0점 기준 |
|---|---|---|---|
| 1 | WebGL 배경·셰이더 | 히어로에 살아있는 배경(노이즈·파티클·디스플레이스먼트) | 단색/그라데이션 정지 배경 |
| 2 | 스크롤 연출 | 핀·패럴랙스·텍스트 리빌 중 2종 이상, 끊김 없음 | 페이드인 1종 이하 |
| 3 | 전면 미디어 | 히어로 영상 루프 또는 전면 이미지 + 챕터마다 이미지 | 플레이스홀더 박스 |
| 4 | 3D 오브젝트·AR | 회전 가능한 3D 1점 이상 | 없음 |
| 5 | 전환·커서·프리로더 | 3종 중 2종 | 없음 |
| 6 | 타이포 | 디스플레이 서체 56px+, 자간·행간 정돈, 위계 3단 | 기본 서체, 위계 불명 |
| 7 | 성능 | 모바일 LCP 3초 이하, JS 600KB 이하 | 둘 중 하나 초과 |
| 8 | 모바일 | 폴백 있고 레이아웃 깨짐 없음 | 데스크톱 그대로 축소 |
| 9 | 카피 | 업종에 맞는 구체 문장, 자리표시 문구 없음 | "사진을 보내주시면…" 류 안내 문구 노출 |
| 10 | 일관성 | 색·서체·간격이 4개 챕터 전부 같은 체계 | 챕터마다 다른 규칙 |

## 현재 골격 7 기준선 점수 (tests/fixtures/generated, mechanical-checks 적용 후 vite build 렌더)

스크린샷: `baseline-2026-09-11/{bakery,cafe,portfolio}-{top,mid,bottom}.png`

| # | 항목 | bakery | cafe | portfolio | 근거 |
|---|---|---|---|---|---|
| 1 | WebGL 배경 | 0 | 0 | 0 | 팔레트 단색 배경 |
| 2 | 스크롤 연출 | 0 | 0 | 0 | 챕터 진입 페이드+상승 1종만(프롬프트 규칙 7) |
| 3 | 전면 미디어 | 0 | 0 | 0 | 전부 플레이스홀더. 오늘 이미지 파이프라인 붙으면 0.5 |
| 4 | 3D·AR | 0 | 0 | 0 | 없음 |
| 5 | 전환·커서·프리로더 | 0 | 0 | 0 | 없음 |
| 6 | 타이포 | 0.5 | 0.5 | 0.5 | Noto Serif KR 56px 헤드라인은 됨. 자간·행간 미정돈, 본문 위계 약함 |
| 7 | 성능 | 1 | 1 | 1 | React+Vite 단순 페이지, 측정 없이도 통과 |
| 8 | 모바일 | 0.5 | 0.5 | 0.5 | 40px 폴백 규칙만, 실측 없음 |
| 9 | 카피 | 0.5 | 0.5 | 0.5 | 문장은 업종에 맞음. "사진을 보내주시면…" 히어로 노출 |
| 10 | 일관성 | 1 | 1 | 0.5 | 팔레트 토큰 체계 일관. portfolio는 mid 구간 빈 공간 과다 |
| | **합계** | **3.5** | **3.5** | **3.0** | |

한 줄: 현재 골격 7은 "깔끔한 정적 문서" — 항목 1~5(시네마틱의 본체)가 전부 0. 킷 없이는 프롬프트로 올릴 수 있는 상한이 4점 안팎.

## 시네마틱 킷 v0 데모 채점 (1단계 첫 슬라이스, 2026-09-11)

`kits/cinematic/demo` — 실생성 빵집 미디어(이미지 4장 + Kling 루프)로 손 조립. 스크린샷 `kit-2026-09-11/{desktop,mobile}-{0..3}.png`.

| # | 항목 | 점수 | 근거 |
|---|---|---|---|
| 1 | WebGL 배경 | 0.5 | HeroCanvas(노이즈·그레인·마우스 패럴랙스) 구현됐지만 데모는 영상 히어로라 미사용. 이미지 히어로 변형 데모 필요 |
| 2 | 스크롤 연출 | 0.5 | Lenis 스무스 + 리빌 + 미디어 패럴랙스. 핀·스크럽 장면 없음 |
| 3 | 전면 미디어 | 1 | 히어로 영상 루프(poster) + 챕터 4:3 사진, 모바일 폴백 |
| 4 | 3D·AR | 0 | Showcase3D 미구현 |
| 5 | 전환·커서·프리로더 | 1 | 프리로더(카운터) + 커서. 페이지 전환은 단일 페이지라 해당 없음 |
| 6 | 타이포 | 1 | Noto Serif KR 128px 상한 clamp, 눈썹 모노, 위계 3단 |
| 7 | 성능 | 1 | 기본 99KB gzip, three 청크 223KB는 데스크톱 WebGL 히어로에서만 lazy |
| 8 | 모바일 | 1 | 400px 스택, 가로 넘침 없음, 영상 대신 이미지 |
| 9 | 카피 | 1 | 실제 업종 문장, 자리표시 없음 |
| 10 | 일관성 | 1 | 토큰 1곳, 색 2개, 서체 2개 |
| | **합계** | **8.0** | 1단계 게이트(8) 턱걸이 — 1·2·4가 시네마틱 본체라 v0.1에서 채운다 |

수정 이력: 첫 렌더에서 코랄레드 라이트 팔레트를 상속해 히어로·연락처 글자가 검정으로 사진에 묻힘 → 사진 위 텍스트는 항상 흰색 + 검은 그라데이션으로 고정. 커서 `mix-blend-mode: difference`는 영상 페이지에서 프레임 드롭 → 액센트 단색.

## WebContainer WebGL 실측 (0단계 셋째 항목) — 2026-09-11, 통과

방법: 코드 수정 없이 실제 채팅 UI(dev :5180, 게스트, 온보딩 5문항 통과)에 아래 프롬프트를 보냈다.
"package.json에 three, @react-three/fiber, @react-three/drei를 추가하고, App.tsx를 R3F Canvas 안에서 천천히 회전하는 금속 질감 TorusKnot 하나와 OrbitControls만 보여주는 전체화면으로 바꿔줘."

| 시각 | 사건 | 경과 |
|---|---|---|
| 15:05:33 | 만들기 클릭 | 0s |
| 15:06:21 | 스트림 종료. 동시에 `Post-stream action stall — stream finished but action queue never settled` 에러 로그 + "마무리가 안 끝났어요" 알림 | 48s |
| 15:06:47 | npm install(three 포함) shell exit 0 | 74s |
| 15:06:49 | `[Preview] Server ready on port: 5173` | 76s |
| 15:07:01 | vite HMR /src/App.tsx, 미리보기에 금속 TorusKnot 렌더(`Environment preset="city"` HDR까지 로드) | 88s |

증거: `baseline-2026-09-11/webcontainer-r3f-torusknot.png`

결론
- WebGL은 WebContainer 미리보기 iframe에서 문제 없이 돈다. R3F + drei + Environment(외부 HDR fetch)까지 정상.
- three 설치 포함 npm install이 약 60초. 골격 1~6 baseline(lucide만)보다 길다 — 시네마틱 트랙만 deps를 넣고, 그 트랙에서는 설치 시간을 "준비 중" UI로 흡수해야 한다.
- 부작용: 설치가 길어지자 스트림 종료 후 26초 동안 action queue가 안 끝나 stall 감지기가 오탐했다(`stream-recovery.ts` 영역, feat/stall-fix 담당). 시네마틱 트랙에서는 install 진행 중일 때 stall 판정을 미루는 예외가 필요하다 — 그 세션에 전달할 것.
- 모바일 성능은 미측정. 1단계 킷에서 예산으로 다룬다.

## 번들 크기 실측 (2026-09-11)

스크래치 Vite 프로젝트(react 18 + three 0.170 + @react-three/fiber 8 + drei 9(Environment·OrbitControls만) + gsap 3 + lenis 1), `vite build` 프로덕션:

| 산출물 | minified | gzip |
|---|---|---|
| index-*.js (단일 청크) | 1,171 KB | 342 KB |

판단
- 항목 7의 "JS 600KB 이하"는 minified 기준으로는 시네마틱 킷이 못 지킨다. 기준을 **gzip 400KB 이하**로 바꾸고, three 계열을 별도 lazy 청크로 분리해 모바일 폴백 경로에서는 아예 안 받게 한다(모바일은 정지 이미지 + CSS 애니메이션이라 three 불필요).
- drei는 tree-shaking돼도 큰 편 — 킷에서 쓰는 헬퍼만 직접 구현하면 100KB 이상 줄어든다. 1단계에서 결정.

## 모바일 400px 기준선 (2026-09-11)

`baseline-2026-09-11/*-m400.png` (400×780, DPR 2). 가로 넘침 없음. 레이아웃 안 깨짐. 헤드라인 40px대로 축소됨.
문제: 플레이스홀더 박스와 챕터 사이 빈 공간이 화면의 절반 이상 — 사진이 없으니 모바일에서는 "빈 페이지"로 읽힌다. 항목 8은 0.5 유지(안 깨지지만 볼 게 없음).

## 시네마틱 킷 v0.2 데모 채점 (2026-09-11 밤) — CSSDA 90개 분석 반영

변경: 서체 프리셋 3벌(기본 Pretendard+Familjen Grotesk 400 / .ck-type-serif / .ck-type-compact) + 한글 조판 규칙(keep-all·행간·자간·본문 폭), 헤딩 스케일 44~112px 굵기 400, `PinnedChapters`(pin+scrub, 인덱스 + 크로스페이드, 모바일은 스택 폴백), `TextReveal`(어절/글자 스크럽 리빌), `MediaTreatment`(mono·duotone·halftone·grain·blur·detail·circle), `BigNumber`(카운트업), `Marquee`, `Wordmark`(화면 폭 자동 맞춤) + Contact wordmark. 데모 헤드라인 전부 한글. 스크린샷 `kit-v0.2-2026-09-11/{desktop,mobile}-{0..7}.jpg`, `sheet-*.jpg`.

| # | 항목 | 점수 | 근거 |
|---|---|---|---|
| 1 | WebGL 배경 | 0.5 | 데모는 영상 히어로. HeroCanvas 변형 데모 여전히 없음 |
| 2 | 스크롤 연출 | 1 | Lenis + 핀/스크럽 챕터 + 어절 리빌 + 미디어 스케일 스크럽 + 마퀴 |
| 3 | 전면 미디어 | 1 | 영상 히어로 + 핀 챕터 4:5 + 트리트먼트(grain/mono) |
| 4 | 3D·AR | 0 | 미구현 |
| 5 | 전환·커서·프리로더 | 1 | 프리로더 + 커서 |
| 6 | 타이포 | 1 | h1 104px/400(실측), 한글 keep-all 2줄, 모노 라벨, 강조 굵기 대비 |
| 7 | 성능 | 1 | three 미로드 경로 |
| 8 | 모바일 | 1 | 400px 스택, overflowX false(실측), 핀 → 일반 챕터 폴백 |
| 9 | 카피 | 1 | 한글 실제 문장, 자리표시 없음 |
| 10 | 일관성 | 1 | 토큰 1곳, 표면 2종(배경+사진), 서체 2벌 |
| | **합계** | **8.5** | v0 8.0 → 8.5. 남은 것 = 1(WebGL 히어로 데모)·4(Showcase3D) |

CSSDA 스크립트로 데모 실측(`motion.mjs`/`tech.mjs`, 127.0.0.1:5190) vs 수상작 중앙값:

| 지표 | 데모 v0.2 | 수상작 중앙값 | 판정 |
|---|---|---|---|
| idle 앰비언트 | 0.03 | 0.034 | 통과(영상 루프) |
| hover 반응 | 0.028 | >0.01 이면 47% | 통과 |
| inertia 관성 | 0.63 | >0.02 이면 78% | 통과 |
| journey 장면 전환 | 0.47 | 0.37 (목표 0.35~0.6) | 통과 |
| h1 | 104px / 400 | 90px / 400 | 통과 |
| 기술 검출 | gsap, lenis, react | gsap 36%·lenis 28% | 수상작 표준 세트 |
| 쿠키 배너 | 0 | — | 통과 |

남은 문제: 데모 미디어(jmtwp1apg 세트)에 AI 인물이 들어 있다(v0 시절 생성). 인물 금지 규칙 위반 — 인물 없는 세트로 재생성 필요($0.37 + 영상 $0.15).

## 시네마틱 킷 v0.3 데모 채점 (2026-09-12) — 남은 항목 1·4 채움

변경
- 항목 1: `HeroCanvas`가 영상도 받는다(VideoTexture). 데스크톱·WebGL이면 사진이든 영상이든 셰이더를 통과한다 —
  노이즈 일렁임 + 필름 그레인 + 비네트 + 마우스 패럴랙스. 데모 히어로는 이제 `<video>` 0개, 캔버스 1개.
- 항목 4: `Showcase3D` 신설 — 드래그로 돌리는 오브젝트 1점(LatheGeometry 도자 단지 + 액센트 밴드,
  RoomEnvironment PMREM 조명, 외부 HDR 다운로드 없음). 손을 떼면 관성으로 이어 돌고, 놓아두면 천천히 자전.
  데스크톱 + WebGL + 뷰포트 500px 접근일 때만 three 청크를 내려받는다. 모바일·WebGL 불가는 같은 장면을 찍어둔
  스틸 1장(`demo/public/showcase-jar.jpg`, `makeShowcasePoster.mjs`로 생성).
- 같이 고친 것(전부 이번 배선에서 드러난 실제 버그)
  1. R2 공개 버킷(pub-*.r2.dev)에 `Access-Control-Allow-Origin`이 없어 `useLoader(TextureLoader)`가 던지면
     **페이지 전체가 빈 화면**이 됐다(서스펜스 throw가 트리를 날림). 텍스처를 직접 로드하고 실패하면
     `onError` → `<video>`/`<img>` 폴백으로 내려가게 바꿨다. 데모는 dev 프록시(`/r2`)로 같은 오리진에서 받는다.
  2. `--ck-accent`는 `oklch()`라 three가 못 읽어 밴드가 흰색이 됐다 — 1×1 캔버스로 sRGB hex 변환 후 전달.
  3. LatheGeometry 단면 점이 성겨 실루엣에 각이 졌다 — SplineCurve로 120점 보간.

스크린샷 `kit-v0.3-2026-09-12/{desktop,mobile}-{0..7}.jpg`, `sheet-{desktop,mobile}.jpg` (`shotKit.mjs`).

| # | 항목 | v0.2 | v0.3 | 근거 |
|---|---|---|---|---|
| 1 | WebGL 배경 | 0.5 | **1** | 히어로 캔버스 1 / `<video>` 태그 0(`check3d.mjs`). 영상 텍스처 실측: 셰이더 경로 soft 0.0134 vs `<video>` 0.0038 vs 정지 사진 0(`heroMotionCompare.mjs`) |
| 2 | 스크롤 연출 | 1 | 1 | 핀/스크럽 + 어절 리빌 + 마퀴(변화 없음) |
| 3 | 전면 미디어 | 1 | 1 | 히어로 영상(셰이더 통과) + 핀 챕터 4:5 |
| 4 | 3D·AR | 0 | **1** | `[data-ck-3d]="live"`, 유휴 프레임차 2.77, 드래그 직후 3.01(정지면 0). 모바일은 스틸 + three 요청 0 |
| 5 | 전환·커서·프리로더 | 1 | 1 | 프리로더 + 커서 |
| 6 | 타이포 | 1 | 1 | h1 104px/400, 한글 keep-all |
| 7 | 성능 | 1 | 1 | 기본 106.68KB gzip + three 222.74KB(lazy) = 데스크톱 최대 약 330KB < 400KB 기준. 모바일은 106.68KB만 |
| 8 | 모바일 | 1 | 1 | 400px overflowX false, three 요청 0, 3D는 스틸 폴백 |
| 9 | 카피 | 1 | 1 | 한글 실문장 |
| 10 | 일관성 | 1 | 1 | 토큰 1곳, 색 2개, 서체 2벌 |
| | **합계** | 8.5 | **10.0** | 1단계 10항목 전부 채움 |

안 됨 / 주의 (점수에 반영된 한계)
- 실측은 전부 헤드리스 Chromium + swiftshader다. 실기기 GPU 프레임률·모바일 LCP는 여전히 미측정 — 항목 7의
  "모바일 LCP 3초 이하"는 예산 논리로만 통과시켰다.
- AR은 없다. `<model-viewer>` + USDZ는 스크립트만 300KB대라 항목 7 예산을 깬다. 채점 기준(1점 = 회전 가능한 3D
  1점 이상)은 충족하지만 "AR 버튼"을 원하면 별도 결정이 필요하다.
- 3D 오브젝트는 GLB 자산이 아니라 코드로 만든 회전체다. 업종별 실제 제품 모델을 쓰려면 GLB 로더가 추가로 필요하다.
- `motion.mjs`의 idle 지표는 v0.3이 0으로 나오는데, v0.2와 같은 구성(`?hero=video`)을 같은 스크립트로 재측정해도
  0이다 — 회귀가 아니라 임계(픽셀 RGB 합 72 초과)가 셰이더 히어로의 미세 변화를 못 잡는 것. 그래서 항목 1 근거는
  같은 임계에 soft(24) 값을 덧붙인 `heroMotionCompare.mjs` 쪽을 쓴다.
- 운영 조건: R2 공개 버킷에 CORS 규칙이 없으면 생성물에서는 히어로가 `<video>` 폴백으로 내려간다(빈 화면은 아니다).
  WebGL 히어로를 실제 사이트에서 쓰려면 버킷에 `Access-Control-Allow-Origin` 허용 규칙이 필요하다 — 사용자 액션.

## 2단계 1차 — 생성물에 킷 주입 (2026-09-12, 실생성 2회)

경로: 시네마틱 트랙(골격 7 = 소개·홍보형 판정)이면 baseline이 킷 의존성(three·@react-three/fiber·gsap·lenis)·서체·
`src/kit/tokens.css` import를 달고, 킷 소스 21파일은 WebContainer에 직접 시드된다(대화 기록에는 API 요약만).
증거 `gen-2026-09-12/hero-generated.jpg`.

| 항목 | 골격 7 기준선(09-11) | 킷 트랙 생성물(09-12) | 근거 |
|---|---|---|---|
| 1 WebGL 배경 | 0 | 0 | HeroScene이 `<video>` 폴백으로 내려감 — R2 CORS 허용 오리진에 WebContainer 프리뷰(`*.webcontainer-api.io`)가 없어 텍스처 로드 실패(실측: 프리뷰에서 `fetch` CORS 오류) |
| 2 스크롤 연출 | 0 | 0.5 | Lenis 스무스 + 리빌. 모델이 `PinnedChapters` 대신 구형 `ScrollChapter`를 골라 핀·스크럽 없음 |
| 3 전면 미디어 | 0 | 1 | 히어로 영상 루프 + 챕터 실사진 4장(예약 URL 그대로) |
| 4 3D·AR | 0 | 0 | 모델이 `Showcase3D`를 안 씀(프롬프트가 "실제 사물이 있을 때만"이라 적음) |
| 5 전환·커서·프리로더 | 0 | 0 | `Preloader`·`Cursor` 미사용 |
| 6 타이포 | 0.5 | 1 | ck-display--xl 한글 헤드라인, 킷 스케일 그대로 |
| 9 카피 | 0.5 | 1 | 실제 한글 문장, 자리표시 없음 |
| 10 일관성 | 1 | 1 | ck- 클래스·토큰만 사용(cr- 혼용 없음) |
| 7 성능 / 8 모바일 | 1 / 0.5 | 미측정 | 이번 런에서 번들·LCP·모바일 레이아웃 측정 안 함 |

같이 확인된 것
- 킷 시드 실측: `/home/project/src/kit/` 21파일 생성(콘솔 로그). baseline 아티팩트 크기는 13.8KB → 14.4KB로만 증가 — 킷 소스는 컨텍스트에 안 들어간다.
- 1차 런 실패 원인: 모델이 "npm install과 개발 서버는 이미 실행 중"이라고 쓰고 설치를 건너뛰어 미리보기가 아예 안 떴다.
  → baseline 아티팩트가 시네마틱 트랙에서 `npm install` + `npm run dev`를 직접 실행하도록 고침. 2차 런에서 미리보기 정상.
- 2차 런에서 "마무리가 안 끝났어요" 스톨 오탐이 다시 떴다(0단계에서 예고된 three 설치 지연 문제). 화면은 정상 렌더 — feat/stall-fix 영역.

남은 것(2단계 2차)
- 프롬프트에 장면 순서를 고정: Preloader → Cursor → Nav → HeroScene → TextReveal → PinnedChapters ×3 → BigNumber → Marquee → Contact. `ScrollChapter`는 이 트랙에서 쓰지 말라고 명시.
- R2 CORS 허용 오리진 확대(아래 사용자 액션) 후 WebGL 히어로 재측정.
- 생성물 기준 성능·모바일 측정, 그리고 같은 채점표로 재채점.

## 2단계 2차 — 장면 순서 고정 (2026-09-12, 실생성 1회)

### 1차의 진짜 원인: 프롬프트끼리 충돌

1차 결과를 "모델이 구형 컴포넌트를 골랐다"로 적었지만, 원인은 모델이 아니라 서로 반대되는 지시 3벌을
동시에 받은 것이었다. 이번에 셋 다 정리했다.

| 충돌원 | 1차에 모델이 받은 지시 | 킷 지시와 부딪힌 부분 | 조치 |
|---|---|---|---|
| `new-prompt.ts` 골격 7 체크리스트 | `data-slot="hero"/"ch1~3"` 4개, `height: 100vh` 리터럴, 이미지 16:9·4:3, 페이드+상승, **"패럴랙스를 쓰지 않는다"** | 핀·스크럽·패럴랙스 자체를 금지 | CINEMATIC_KIT_PROMPT 머리에 "이 지시가 골격 7 체크리스트를 대체한다" 절을 넣고 무효 항목을 하나씩 명시 |
| `skeleton7Images.ts`의 사진 지시줄 | "히어로는 이미지를 전면(objectFit cover, 100vh)으로 깔고 그 위에 그라데이션", "챕터 1~3은 4:3으로 캡션 옆에", raw `<video ... matchMedia>` | HeroScene·PinnedChapters를 손으로 다시 만들게 함. **히어로가 `<video>`로 내려간 것도 여기 지시대로 한 결과일 수 있다**(CORS 단독 원인이 아님) | 배치 지시를 킷 props로 바꿔 다시 씀(`skeleton7PromptLines.ts`로 분리) |
| CINEMATIC_KIT_PROMPT 자체 | 컴포넌트 목록만 나열, Showcase3D는 "실제 사물이 있을 때만" | 순서·필수 여부가 없어 모델이 취사선택 | 번호 절차 11항목으로 고정, `ScrollChapter` 금지 명시, Showcase3D 필수화(BigNumber만 조건부) |

### 실생성 1회 결과 (claude-sonnet-5, 빵집 소개, 32.1초)

`gen-2026-09-12-round2/screens.tsx`. 게이트 `tests/benchmark/cinematic/sceneOrderCheck.ts`가
UI와 같은 프롬프트를 보내고 생성물 원문을 기계 판정한다.

| 항목 | 1차 | 2차 |
|---|---|---|
| 장면 순서 | ScrollChapter 사용, Preloader·Cursor·Marquee·Showcase3D 누락 | Preloader → Cursor → Nav → SceneNav → HeroScene → TextReveal → PinnedChapters → Showcase3D → Marquee → Contact **전부 순서대로** |
| 챕터 수 | — | 3 |
| `<ScrollChapter>` | 사용 | 없음 |
| `data-slot=` | 있음 | 없음 |
| raw `<img>`·`<video>` | 있음 | 없음(히어로 영상은 `<HeroScene video>` prop) |

PASS. 다만 이건 "킷을 제대로 조립했나"만 본다 — 채점표의 시각 항목(1·2·4·5·7·8)은 실제 렌더가 필요하다.

### R2 CORS
사용자가 `*.webcontainer-api.io`를 허용 오리진에 추가했다. 확인:
`curl -I -H "Origin: https://…webcontainer-api.io" <R2 스틸 URL>` → `Access-Control-Allow-Origin`이 그 오리진으로 돌아온다.
WebGL 히어로 재측정은 실제 렌더에서 한다.

### 생성물 실제 렌더 채점 (2026-09-12)

같은 생성물을 `tests/benchmark/cinematic/renderGenerated.mjs`로 진짜 빌드해서 잰다. 생성물을
`kits/cinematic/.render-tmp`에 임시 vite 프로젝트로 깔고(킷 node_modules 재사용) `vite build` →
정적 서버 → Playwright. 결과·스크린샷 `render-2026-09-12/`.

| # | 항목 | 골격 7 기준선 | 2단계 1차 | **2단계 2차** | 실측 근거 |
|---|---|---|---|---|---|
| 1 | WebGL 배경 | 0 | 0 | **1** | 히어로에 `<canvas>`, `<video>` 폴백 없음, 픽셀 변화량 2.18(셰이더가 매 프레임 갱신) |
| 2 | 스크롤 연출 | 0 | 0.5 | **1** | sticky 자식의 top이 핀 유효 구간 3표본에서 모두 0, 활성 챕터 인덱스가 스크롤에 따라 바뀜(스크럽), Lenis 스무스 + TextReveal |
| 3 | 전면 미디어 | 0 | 1 | 1 | 히어로 전면 + 챕터 사진 3장 |
| 4 | 3D·AR | 0 | 0 | **1** | Showcase3D 캔버스(544×624)를 180px 드래그 → 픽셀 변화량 56~114 |
| 5 | 전환·커서·프리로더 | 0 | 0 | **1** | 로드 직후 `[data-ck="preloader"]` 노출, `[data-ck="cursor"]` 존재 |
| 6 | 타이포 | 0.5 | 1 | 1 | ck-display 한글 헤드라인 |
| 7 | 성능 | 1 | 미측정 | **0.5** | FCP 504ms(로컬 정적 서버), 메인 293KB + three 808KB(gzip 222KB). three는 별도 청크라 모바일은 안 받는다. 실제 회선·GPU 측정은 아직 없음 |
| 8 | 모바일 | 0.5 | 미측정 | **0.5** | 400px에서 가로 스크롤 없음(scrollWidth 400 = clientWidth), three 청크 미로드(canvas 0개). 남은 결함은 아래 |
| 9 | 카피 | 0.5 | 1 | 1 | 한글 실문장 |
| 10 | 일관성 | 1 | 1 | 1 | ck- 토큰만 사용 |
| | **합계** | **3.5/10** | (8항목 3.5) | **9.0/10** | |

측정 조건(과대평가 방지):
- Chromium + SwiftShader(소프트웨어 GL). 실제 GPU가 아니다 — 성능 수치는 상한이 아니라 하한 쪽으로 봐야 한다.
- 로컬 정적 서버 + 같은 오리진 미디어. 실제 WebContainer 프리뷰나 배포 사이트에서의 재현은 별도.
- 생성 1건 기준. 여러 업종·모델로 반복하면 달라질 수 있다.

같이 고친 것
- `Nav`가 400px에서 링크 3개를 글자 단위로 세로로 쪼개 쌓았다(모바일 스크린샷으로 발견). 좁은 화면에서는
  링크를 접고 브랜드 + CTA만 남긴다(섹션 이동은 SceneNav). 항목 8은 이 수정 뒤 점수다.
- `Cursor`에 `data-ck="cursor"`를 붙였다 — 클래스도 data 속성도 없어 존재 여부를 잴 수 없었다.

### 남은 결함
- 히어로 서브 카피가 어절 중간에서 줄바꿈된다("빵을 굽 / 고 있어요"). 모바일에서는 eyebrow가 우측에서 잘린다.
- 모바일에서 히어로가 이미지 폴백이라 항목 1의 연출이 데스크톱 전용이다(설계대로지만 점수는 데스크톱 기준).
- `injectSkeleton7Images`(정규식 폴백)는 `data-slot`을 찾는다. 시네마틱 생성물에는 이제 `data-slot`이 없으므로 이 트랙에서 폴백은 사실상 동작하지 않는다 — 모델이 URL을 직접 쓰는 프롬프트 경로에만 의존한다.

### R2 CORS 허용 오리진 (2026-09-12 curl 재확인)

| Origin | ACAO 응답 |
|---|---|
| `https://…webcontainer-api.io` | 허용 |
| `https://coralred.kr` | 허용 |
| `https://coralred.pages.dev` · `https://<sub>.coralred.pages.dev` · `https://<any>.pages.dev` | 허용 |
| `https://www.coralred.kr` | **없음** |
| `http://localhost:*` | 없음(로컬 측정은 같은 오리진으로 미디어를 준다) |

프리뷰도 배포도 열려 있다. 앞선 기록에서 "배포 오리진이 막혀 있다"고 적은 건 존재하지 않는 도메인
(`coralred.app`)으로 찔러본 오판이었다 — 실제 도메인은 `coralred.kr`이다.
남은 구멍은 `www.coralred.kr` 하나. 지금 www로 서비스하지 않으면 문제 없고, 나중에 www를 쓰면 그때 추가한다.

## 쇼룸(딥 브리프 B1 카드) 미디어 — 2026-09-11 밤

`kits/cinematic/demo/?showroom`. 가상 브랜드 밀도 × 세계관 6종(`app/lib/media/style-locks.ts`). 세계관당 스틸 3장 생성 → 육안 선별 1장 → Seedance 5초 루프. 스크린샷 `showroom-2026-09-11/`.

| 세계관 | 선별 | 재생성 | 영상 판정 | 비고 |
|---|---|---|---|---|
| 실사 에디토리얼 | 2/3 | 0 | 통과(김·빛 이동) | 프레임 간 빵 위치 미세 변동 — 루프 이음새에서 보일 수 있음 |
| 신고전주의 회화 | 2/3 | 0 | 통과(미세 움직임, 붓질 유지) | 정면 얼굴 2명 — 회화라 허용. 60프레임 시퀀스로 ScrollSequence |
| 수채 일러스트 | 1/3 | 0 | 통과(종이 숨쉬기) | 1차 2장은 "bakery" 글자 노출 → 탈락. 흰 종이라 잉크 검정 글자로 |
| 제품 오브젝트 3D | 2/3 | 0 | 통과(1/4 회전+부유) | 3번은 오른쪽 주황 번짐 탈락 |
| 흑백 브루탈 | 재생성 2/3 | 1회($0.27) | 통과(망점 흔들림) | 1차 "price tag"가 글자 없는 주황 덩어리 → 피사체를 "빵 하나 크러스트 색"으로 |
| 단색 컬러 월드 | 1/3 | 0 | 통과(회전·발광) | — |

비용: 스틸 21장 $1.94 + 영상 6개 $0.90 = **$2.84**. 선별 탈락률 7/21(33%) — 브리프 카드는 이 선별본을 캐시로 쓰므로 사용자당 비용 0.
9.0 기준 자체 판정: 결함 0, 세계관 문법 충실, 헤드라인 자리 확보 — 6종 전부 통과. 사용자 승인 대기.

## AD 루프 v1~v4 + 베이크오프 — 미디어 상한 실측 (2026-09-11 밤)

심사 = Fable 5.1 + GPT-6 Astra vision 이중 심사 최소값(캘리브레이션: 실제 수상작 사진 9.0, 우리 1차 스틸 5~6.5). 같은 이미지 3회 재심사 편차 ±0.5/모델, 모델 간 견해차는 최대 2점(min 규칙 유지).

| 버전 | 추가된 레버 | 실사 최고 | 회화 최고 | 비고 |
|---|---|---|---|---|
| v1 | LLM AD 브리프(4) | 8.0 | 8.0 | 라운드2 악화(브리프 복잡화) |
| v2 | 오브젝트 ≤3, 빼기만, N=8 | 8.0 | 8.0 | 결함이 구조(클론·글자·손)→질감(컷면·알갱이)으로 |
| 베이크오프 | flash/pro/sunburst/flare/gpt-image-2 | 7.5~7.7 | 7.5 | 모델 간 차 < 생성 편차. 회화 인물은 flare/gpt-image-2 +1 |
| v3 | 앵커 2장 + 3생성기 + 편집 루프 | 8.0 (Astra 단독 9.0은 재심사 7.7) | 8.0 | 편집 루프 전부 하락(8.4→7.5) → 폐기. 앵커+flare edits 조합이 육안 최고 |
| v4 | 룩 바이블 + 샤르댕 앵커 | 7.8 | 7.5 | 규격이 브리프를 복잡하게 → 하락. 룩은 조명·구도만 남기고 소품 지시 제거 |

결론: 현재 생성기(gemini-3.1-flash / gemini-3-pro / gpt-image-2.5)로 **실사·회화 모두 8.0이 상한**. 남은 후보 = Seedream 5.0 Pro(ARK 계정에서 모델 활성화 필요), FLUX.2 Pro(키 필요). 영상은 Seedance 2.0이 이미 1위(Veo 3.1 비교 후보). 상한이 안 깨지면 실사 세계관은 사용자 실사진 우선, 생성은 8.0 보조로 확정.

### Seedream 5.0 Pro 추가 후 (2026-09-11 심야, 사용자가 ModelArk에서 활성화 — `dola-seedream-5-0-pro-260628`)

| 비교 | Seedream 5.0 Pro | 기존 최선 |
|---|---|---|
| 실사 베이크오프(같은 2브리프) | 7.5 / 8.0 | flash 6.5 / 7.0 |
| 실사 v5(×8, 앵커, 16:9) | 최고 8.0 (8/8.2, 8/8.5), 평균 7.6 | flash v3 최고 8.0, 평균 7.0 |
| 회화(16:9) | 7.0 | flash 8.0 |

결정: 실사·제품·브루탈 생성기 = **Seedream 5.0 Pro**(평균 +0.7, 상한 동일 8.0). 회화·수채·잉크 = 기존(flash/flare). 목표 8.5(실사)·9.0(회화)는 **현 세대 생성기로 미달** — 실사 세계관은 사용자 실사진 우선, 생성은 8.0 보조로 확정. FLUX.2 Pro는 키 확보 시 추가 검증.

### 8.0 벽 넘기 — 레버 ②③④ 실측 (2026-09-12 새벽)

| 레버 | 결과 | 판정 |
|---|---|---|
| ② 필름 그레이딩(grade.py) | 8.0→8.0/7.7, 심사가 "후처리 필터"로 식별 | 효과 없음 |
| ③ 심사 기반 크롭(crop.py) | 7.5→7.0, 크롭이 "원본과 동일 후보"로 판정. 남은 결함은 질감이라 프레이밍 무관 | 효과 없음 |
| ④ 마스크 inpaint(inpaint.ts: Fable가 결함 bbox → gpt-image-2.5-flare 마스크 재생성) | 원본 6.5/7.0 → **8.5/8.0** (min 8.0, Fable 8.5), 육안 "뭉개진 롤 → 결 살아있는 크루아상", 조명·배경 무변 | **유일하게 효과** — 1라운드 +1.5~2.0 |

결론: 병목은 "피사체의 물리적 사실성"(빵 결·단면)이고, 이를 건드리는 건 국소 재생성(④)과 실사 기반(①, 미실행)뿐. 파이프라인 후보 = Seedream 생성 → 이중 심사 → 결함 bbox → 마스크 재생성 ×2~3라운드 → 재심사. 2라운드 결과로 8.5(min) 도달 여부 확인 중.

재현 확인(2026-09-12): 두 번째 스틸 r1-4도 원본 6.0 → inpaint 1라운드 **8.0**. 2라운드는 하락(7.5→6.5/7.5) — inpaint는 1회만. 확정 파이프라인: Seedream N=8 → 이중 심사 → 상위 1~2장 결함 bbox(Fable) → gpt-image-2.5-flare 마스크 재생성 1회 → 재심사.

통합 실행(director.ts --repair 2, Seedream ×8, 2026-09-12 00:04): 생성 8장 최고 8.0(2장), 수리 대상이 이미 8.0인 장(결함 = 소금 알갱이·단면)이라 수리 후 6.5/7.0으로 **하락** (Astra는 8.0/8.7로 상승 — 모델 견해차). 결론: inpaint는 6~7점대 "큰 결함" 이미지를 8로 끌어올리는 데는 확실(+2), 8.0을 8.5로 미는 데는 무효. min-of-two 상한 8.0 유지, Fable 단독 8.5·Astra 단독 8.7. 남은 경로 = ① 하이브리드(실사 기반).


## 2026-09-12 — 잉크 그래픽 노블 쇼룸 미디어

| 세계관 | 생성기 | 스틸 | 루프 | 원가 |
|---|---|---|---|---|
| 잉크 그래픽 노블 | gpt-image-2.5-flare ×3 → 1장 채택(still-mtx3xrl6-1) | 오븐 앞 제빵사 뒷모습, 스팟 컬러 = 오븐 불 | Seedance 2.0 fast hero-mtx43iz0.mp4 (130s) | $0.57 + $0.15 |

단색 컬러 월드 카드는 showroom.json 에서 제거(사용자 판정 최악). 심사 점수는 내일 실사·회화 목표 세션에서 같이 측정.

## 2단계 2차 — 후속 (2026-09-12 저녁)

### (b) 골격 7 체크리스트를 서버에서 끈다

2차 1편에서는 킷 프롬프트 머리에 "이 지시가 체크리스트를 대체한다"를 넣어 **덮어쓰기**만 했다.
이제 체크리스트 자체를 시네마틱 트랙에서 빼낸다.

판정은 클라이언트 상태가 아니라 **파일맵**으로 한다 — `src/kit/tokens.css`가 있으면 시네마틱 트랙
(`app/lib/cinematic/isCinematicProject.ts`). 채팅 요청 body의 `files`가 이미 서버까지 오므로
(`api.chat.ts` → `stream-text.ts`) 새 배선이 필요 없고, 새로고침·재접속·이어하기 뒤에도 판정이 유지된다.
`new-prompt.ts`는 골격 7의 첫 화면 문법만 갈아끼운다(골격 1~6, 나열 금지, spacious는 그대로).

킷 프롬프트의 덮어쓰기 절은 3줄로 줄였다 — 판정이 실패하는 경우(파일맵이 비어 오는 호출)를 위한 보험으로만 남긴다.

테스트 8건(`isCinematicProject.spec.ts`): 시네마틱 프롬프트에는 `data-slot="hero"`·"패럴랙스를 쓰지
않는다"·`'Noto Serif KR'` 인라인 지정이 없고, 기본 트랙에는 그대로 있다. 골격 1~6은 두 트랙 동일.

### (c) 업종·모델 반복 — 5건 전부 PASS

`sceneOrderCheck.ts`에 `--case` / `--model` / `--recheck`를 넣고 돌렸다. 하네스도 이제 `files`에
킷 마커를 실어 보낸다(서버 판정을 UI와 같게 맞추려고).

| 업종 | 모델 | 장면 순서 | 챕터 | 소요 |
|---|---|---|---|---|
| 빵집 | claude-sonnet-5 | 10종 순서대로 | 3 | 37.3초 |
| 포트폴리오 | claude-sonnet-5 | 10종 순서대로 | 3 | 37.1초 |
| 요가원 | claude-sonnet-5 | 10종 순서대로 | 3 | 35.9초 |
| 포트폴리오 | claude-opus-5 | 10종 순서대로 | 3 | 50.9초 |
| 요가원 | claude-fable-5-1 | 10종 순서대로 | 3 | 81.5초 |

5건 모두 `ScrollChapter`·`data-slot`·raw `<img>/<video>` 없음.

실렌더도 5건 전부 다시 쟀다(`renderGenerated.mjs <디렉터리>`):

| 케이스 | 히어로 캔버스 | video 폴백 | 히어로 모션 | 핀·스크럽 | 3D 드래그 | FCP | 모바일 가로 |
|---|---|---|---|---|---|---|---|
| 빵집/sonnet | O | 없음 | 2.17 | O·O | 107.8 | 500ms | 400 |
| 포트폴리오/sonnet | O | 없음 | 2.21 | O·O | 90.0 | 460ms | 400 |
| 요가원/sonnet | O | 없음 | 2.18 | O·O | 98.8 | 484ms | 400 |
| 포트폴리오/opus | O | 없음 | 2.21 | O·O | 88.7 | 484ms | 400 |
| 요가원/fable | O | 없음 | 2.18 | O·O | 99.5 | 488ms | 400 |

### 판정 하네스에서 고친 것 (생성물 문제가 아니라 측정 문제였다)
- `chapters={CHAPTERS}`처럼 배열을 밖으로 뺀 생성물(opus-5)을 챕터 0개로 오판했다 → 식별자 선언을 찾아가 센다.
- 스냅이 섹션 시작점으로 되끌어 Showcase3D 캔버스가 화면에 159px만 걸린 생성물(fable)에서 드래그 변화량이
  0.36으로 나왔다 → 3D 측정 단계에서만 뷰포트를 1280×1400으로 키운다(데스크톱 판정은 가로 기준이라 불변).
- `export default function App()`로 쓴 생성물에 `export default App;`을 덧붙여 빌드가 깨졌다 → 이미 default export가 있으면 안 붙인다.

### 여전히 남은 것
- (a) 실제 WebContainer 프리뷰·배포 사이트에서의 재측정. CORS는 열려 있음이 확인됐다(위 표) — 남은 건 측정뿐.
- 실제 GPU·WebContainer 프리뷰에서의 재현(측정은 여전히 SwiftShader + 로컬 정적 서버).
- 히어로 서브 카피 어절 중간 줄바꿈.

## 실제 WebContainer 프리뷰 실측 (2026-09-12 밤) — 백지 버그 발견

여태 측정은 전부 로컬 정적 서버였다. 실제 제품 경로(채팅 UI → 온보딩 → 생성 → WebContainer 프리뷰)로
빵집 1건을 만들어 프리뷰 URL을 직접 열었다.

결과: **화면이 백지**. 콘솔:

```
TypeError: Cannot read properties of undefined (reading 'split')
    at src/kit/TextReveal.tsx:23
The above error occurred in the <TextReveal> component
```

생성물이 `<TextReveal>문장</TextReveal>`(children)로 썼고 `text`가 undefined가 됐다. 킷이 던진 예외를
받아줄 에러 경계가 없어 App 트리 전체가 언마운트됐다. CORS나 WebGL과 무관한, 프롬프트 준수 실패 +
킷의 취약함이 겹친 버그다. R2 CORS는 정상이었다(프리뷰 도메인 허용 확인됨).

조치 두 겹
1. 킷: `TextReveal`이 `children` 문자열도 받고, 문장이 비면 예외 대신 `null`을 그린다. 호출부를 LLM이
   쓰는 이상 prop 하나 빠졌다고 페이지 전체가 죽어서는 안 된다.
2. 게이트: `checkCinematicSceneOrder`가 `<TextReveal ... text=...>`가 아니면 잡는다.

검증: 문제의 children 형태를 재현한 픽스처(`repro/textreveal-children/screens.tsx`)를 고친 킷으로 빌드해
렌더 — 히어로 캔버스 O, 핀·스크럽 O, 3D 드래그 106.1로 정상이다(고치기 전에는 백지). 게이트는 이 픽스처를
FAIL로, 실제 생성물 5건은 모두 PASS로 판정한다.

이 실측이 말해주는 것: 소스 게이트(sceneOrderCheck)와 로컬 렌더(renderGenerated)만으로는 프롬프트를 벗어난
호출을 못 잡는다. 실제 프리뷰를 한 번은 열어봐야 한다.

## Q3 "브랜드 소개·포트폴리오" 실생성 (2026-09-12 밤, 사진 스튜디오)

격자 항목을 새로 넣고 제품 경로 그대로 1건 생성했다. 킷은 제대로 붙었다 — 프리뷰에 `<canvas>` 1개
(히어로 WebGL, `<video>` 폴백 0), `[data-ck="preloader"]`·`[data-ck="cursor"]`·`[data-ck="chapter"]`
모두 존재, 마키·TextReveal 스크럽 동작. 백지 없음.

그런데 **사진이 전부 Unsplash URL이었다**(4장). 예약된 R2 URL은 한 장도 안 쓰였다.

원인: `isSkeleton7File()`이 `data-slot="hero"` 또는 `100vh` 리터럴 개수로 골격7을 판정한다. 시네마틱
생성물에는 둘 다 없다(킷이 내부에서 처리). 그래서 생성 직후 콘솔에 이렇게 찍힌다:

```
Skeleton7Images  generated app is not skeleton 7 — discarding pre-started image set
```

결과가 나쁜 쪽으로 세 겹이다.
1. 미리 시작한 이미지 세트(4장)가 버려진다 — 이미 생성됐고 원가도 나갔다(`api.media-images image set generated`).
2. 히어로 영상도 계속 만들어져 완료된다(`video ready`) — 역시 아무도 안 쓴다.
3. 정규식 주입 폴백(`injectSkeleton7Images`)도 `data-slot`을 찾으므로 사실상 무효다.
   → 모델이 예약 URL을 안 쓰면 복구 경로가 아예 없다.

같은 런에서 나온 다른 문제
- `Showcase3D`가 빠졌다(캔버스 1개, "DRAG TO ROTATE" 없음) — 채점표 항목 4가 0이다. 헤드리스 게이트
  5건은 전부 통과했는데 UI 경로에서만 빠졌다. UI 경로에는 baseline 아티팩트·온보딩 지시문·자동 검토
  재작성(이 런에서 Marquee items 수정 1회)이 더 붙는다 — 그 차이를 봐야 한다.
- 히어로 사진이 밝은 하늘 배경이라 흰 헤드라인이 거의 안 읽힌다(overlay 0.45로 부족). 그리고 사람 손이
  크게 나온다 — 실사 인물 금지 규칙에 걸린다(Unsplash 사진이라 우리 생성 파이프라인 밖이긴 하다).
- 색 단계에서 "다크"를 골랐는데 생성물은 킷 기본(밝은 톤)으로 나왔다. 킷 토큰이 팔레트를 대체하므로
  의도된 동작이지만, 사용자가 고른 색이 무시된 것처럼 보인다.

고칠 방향(미착수)
1. `isSkeleton7File`이 시네마틱 트랙도 골격7로 인정하게 한다(예: `from './kit'` + `<HeroScene`).
2. 시네마틱 트랙용 주입 경로 — `data-slot` 대신 킷 props(`<HeroScene image=`, `chapters`의 `image:`)를 갈아끼운다.
3. `checkCinematicSceneOrder`가 외부 이미지 호스트(unsplash 등)를 잡는다 — 예약 URL을 안 쓴 생성물을 게이트에서 걸러낸다.

### 조치 (2026-09-12 밤, 위 3가지 전부)

1. `isCinematicTrackFile()` 추가 — 킷 import + `<HeroScene>`이면 시네마틱 트랙이다. `isSkeleton7File()`이
   이걸 골격7로 인정하므로 예약 이미지 세트가 더는 버려지지 않는다. 단 `runSkeleton7DataSlotCheck`는
   이 트랙을 건너뛴다 — 안 그러면 자동 검토가 "data-slot 컨테이너가 4개가 아니다"를 남겨 모델을 다시
   골격7 체크리스트 쪽으로 되돌린다.
2. `injectCinematicImages()` 추가 — 마크업을 넣는 대신 외부 이미지 URL 문자열만 예약 URL로 바꾼다.
   상수로 빼든(`const HERO = '...'`) prop에 직접 쓰든 같이 걸리고, 킷 레이아웃은 안 건드린다. 파일에
   나타난 순서대로 첫 URL이 히어로, 그다음 셋이 챕터 1~3이며, 그보다 많으면 ch1~ch3을 돌려 쓴다.
   영상(.mp4)과 로컬 경로는 제외. 멱등(이미 예약 URL이면 0건).
3. `checkCinematicSceneOrder`가 외부 이미지 호스트를 잡는다. 이미지로 보이는 URL만 본다(확장자 또는
   스톡 호스트) — 처음엔 모든 http URL을 봤다가 bakery 생성물의 카카오맵 링크를 오탐했다.

테스트 207건 통과(신규: injectCinematicImages 7건, 외부 이미지 게이트 3건, isCinematicTrackFile 3건).
저장된 생성물 5건 재판정도 전부 PASS.

## 예약 이미지 수정 검증 + 남은 결함 정리 (2026-09-12 심야, 도자기 공방 실생성)

Q3 "브랜드 소개·포트폴리오"로 한 건 더 생성해 앞선 수정이 제품 경로에서 실제로 먹는지 봤다.

**검증됨 — 예약 사진이 실제로 들어간다.** 생성물의 외부 URL은 `pf.kakao.com`(채널 링크) 하나뿐이고
이미지 URL은 전부 R2다. 프리뷰에서 `<img>` 5장이 전부 로드됐다(`naturalWidth > 0`, 깨진 이미지 0).
Unsplash는 한 장도 없다. 어제 런에서 이미지 세트가 통째로 버려지던 문제는 해소됐다.

**Showcase3D는 이번엔 소스에 있다** — 어제 누락은 모델 편차였지 UI 경로의 구조적 문제가 아니었다.

### 이번 런에서 새로 드러난 것: WebGL이 통째로 꺼진다

프리뷰에서 `<canvas>`가 0개였다. 히어로는 `<video>` 폴백, Showcase3D는 `data-ck-3d="still"`(정지 이미지).
두 컴포넌트의 공통 조건은 `useWebGL()`뿐이다 — 그런데 **같은 페이지 콘솔에서 직접
`canvas.getContext('webgl2')`를 부르면 성공한다**. 즉 컨텍스트를 만들 수 있는 환경인데 첫 마운트의
probe만 false로 떨어졌다. 생성 직후는 npm install·번들·이미지 업로드가 겹치는 구간이다.

조치 두 가지(원인 확정 전 견고성 보강)
- `useWebGL`이 실패하면 0·400·1500·4000ms에 다시 본다. 한 번 실패로 정지 이미지에 굳지 않는다.
- `HeroScene`이 `image`/`video`가 바뀌면 `canvasFailed`를 푼다. 예약 사진은 생성 직후 아직 R2에 없다가
  1~2분 뒤 올라오는데, 첫 로드의 404로 실패 상태가 굳으면 사진이 도착해도 영영 폴백으로 남았다.

둘 다 이번 프로젝트에는 적용되지 않는다(킷은 생성 시점에 시드된 사본이다) — 다음 생성부터 적용된다.
로컬 렌더 하네스는 수정 후에도 정상(캔버스 2개, 핀·스크럽 O, 드래그 27.4).

### 같이 고친 것
- **검토 대상에서 `src/kit/` 제외**(`selectReviewableEntries`). 킷 21파일 86KB가 매 생성마다 자동 검토
  LLM 입력에 실려 나갔고, cr- 트랙 기준 체크리스트가 "수정 금지"인 킷을 고치라고 할 수 있었다. 더 나쁜 건
  기계 검사의 색 리터럴 자동수정이다 — Showcase3D는 three에 넘길 색을 `'#ff5330'` 문자열로 들고 있는데
  (`var(...)`는 three가 못 읽는다) 그게 치환되면 3D가 조용히 깨진다.
- **히어로 한글 줄바꿈**: 헤드라인·서브에 `word-break: keep-all`. "빵을 굽 / 고 있어요" 같은 어절 중간
  줄바꿈이 사라진다.
- **밝은 사진 대비**: 그라데이션 하단 최소값을 0.72로 올리고 텍스트에만 그림자를 깐다. 오버레이를 더
  올리면 사진이 죽어서 글자에만 건다(실측: 하늘 배경 히어로에서 흰 헤드라인이 안 읽혔다).
- **다크 팔레트가 무시되던 문제**: 팔레트는 여태 `--hue` 숫자 하나로만 생성물에 전달됐다. 다크·미니멀은
  hue가 아니라 배경·글자 밝기로 구별되므로 그 숫자에 아무것도 안 담겼다. 어두운 팔레트면 baseline
  index.html의 `<html>`에 `data-theme="dark"`를 붙인다 — 킷 토큰도 `var(--bg)`·`var(--text)`를 받으므로
  같이 어두워진다.

### 가죽 공방 실생성 (2026-09-12 심야, 다크 팔레트 선택)

| 확인 항목 | 결과 |
|---|---|
| 예약 사진 사용 | O — 외부 이미지 URL 0개, R2만. `<img>` 5장 전부 로드 |
| 다크 팔레트 | O — `<html data-theme="dark">`, body 배경 `oklch(0.15 0.015 34)` |
| 장면 구성 | preloader·cursor·nav·scene-nav·hero·chapter·scene·marquee·contact |
| 히어로 WebGL | **X** — `<video>` 폴백. 원인 아래 |
| Showcase3D | `data-ck-3d="still"` — 스크롤 전이라 정상(IntersectionObserver rootMargin 500px) |

히어로 WebGL이 안 뜬 진짜 원인(이번에 특정했다): **CORS 캐시 충돌**이다.
히어로는 같은 URL을 먼저 평범한 `<img>`로 받는다(폴백용). 그 응답은 Origin 헤더 없이 받은 것이라,
뒤이어 `crossOrigin='anonymous'`로 같은 URL을 요청하면 브라우저가 그 캐시 항목을 재사용하고 CORS 검사에서
떨어진다. 프리뷰에서 실측: 서버는 정확히 그 오리진으로 `Access-Control-Allow-Origin`과 `Vary: Origin`을
돌려주는데(curl 확인) `new Image(crossOrigin='anonymous')`는 `onerror`였다. R2는 `Cache-Control:
public, max-age=31536000, immutable`이라 재사용이 공격적이다.

조치: `HeroCanvas`가 텍스처를 받을 때 쿼리(`?ck=tex`)를 붙여 캐시 항목을 분리한다. 로컬 렌더 하네스는
수정 후에도 정상(히어로 캔버스 O, video 폴백 없음, 드래그 241.0).

앞선 "probe가 false였다" 가설은 틀렸다 — `useWebGL` 재시도는 그대로 두되(무해한 보강), 실제 원인은 이쪽이다.

## 2단계 종료 확인 — 유리 공방 실생성 (2026-09-12 심야, 다크 팔레트)

CORS 캐시 수정 뒤 제품 경로로 한 건 더 만들어 전부 다시 봤다.

| 항목 | 결과 |
|---|---|
| 히어로 WebGL | **O — `<canvas>` 1개, `<video>` 폴백 0.** 프리뷰에서 처음으로 셰이더가 떴다 |
| 예약 사진 | O — 외부 이미지 URL 0개, `<img>` 4/4 로드 |
| 다크 팔레트 | O — `<html data-theme="dark">` |
| 한글 줄바꿈 | O — 헤드라인 "불과 숨으로 / 빚는 유리", 어절 중간 끊김 없음 |
| 사진 위 대비 | O — 밝은 창가 사진 위에서도 흰 헤드라인·서브가 읽힌다 |

증거: `render-2026-09-12/`의 로컬 측정과 별개로, 이번 건은 실제 WebContainer 프리뷰 스크린샷으로 확인했다.

남은 것(2단계 밖)
- "마무리가 안 끝났어요" 스톨 오탐이 이번에도 떴다 — feat/stall-fix 영역이다.
- 실 GPU·배포 도메인 측정. 배포는 auto mode에서 막혀 사용자가 직접 돌려야 한다.

## 프로덕션(coralred.kr) 첫 실생성 — 2026-09-13, 목공방

머지·푸시·배포 뒤 실제 프로덕션에서 처음 돌렸다. 지금까지 검증은 전부 로컬 dev + WebContainer 프리뷰였다.

먼저 막힌 것들(제품 자체 문제는 아님)
- 계정 무료 생성 한도 소진(`무료 생성 횟수를 모두 사용했어요`). generation_usage_v2에서 month_count 7,
  day_count 3이었다. PostgREST(service_role)로 0으로 리셋해 진행했다. Supabase 대시보드는 Chrome 자동
  번역이 React DOM을 깨뜨려(`removeChild`) 접속이 안 됐다 — 대시보드 대신 PostgREST를 쓰면 우회된다.
- 네트워크 로그의 `/api/health` 503은 배포 직후 콜드스타트 잔여 기록이었다. 이후 GET·HEAD 모두 200,
  마이그레이션 5개 전부 true.

생성 결과: **화면 백지.** 콘솔:

```
Error: Objects are not valid as a React child (found: object with keys {label, emphasis})
```

생성물이 `<Marquee items={[{ label, emphasis }]}>`로 객체 배열을 넘겼고, 킷이 그대로 children으로
렌더하다 예외가 났다. 에러 경계가 없어 App 트리째 언마운트 — 09-12의 TextReveal 사고와 **완전히 같은 형태**다.

조치(두 겹, 그때와 동일한 방식)
1. 킷: `normalizeMarqueeItems()`가 문자열·숫자·`{ label, emphasis }`를 모두 받고, 렌더할 글자가 없는
   항목은 버린다. 항목이 하나도 없으면 예외 대신 `null`.
2. 게이트: `checkCinematicSceneOrder`가 `<Marquee items={[{ … }]}` 형태를 잡는다.

확인된 것(백지와 별개로 정상 동작)
- `data-theme="dark"` — 다크 팔레트가 프로덕션에서도 생성물에 전달된다.
- App.tsx의 이미지 URL 5개 전부 R2, 외부 이미지 0 — 예약 사진 주입이 프로덕션에서도 작동한다.
- Q3 격자의 "브랜드 소개·포트폴리오"로 골격 7 → 시네마틱 트랙 진입, 색 단계에서 다크·미니멀 추천 배지.

교훈(반복 확인): 킷 컴포넌트는 LLM이 호출부를 쓰는 이상 **어떤 prop 모양이 와도 페이지를 죽이면 안 된다.**
리스트를 받는 컴포넌트를 새로 만들 때는 정규화 + 빈 값 방어를 기본으로 넣는다. Contact(rows)·Nav(links)·
Showcase3D(specs)는 값을 필드로 꺼내 쓰므로 같은 사고가 나지 않는다(확인함).

## 프로덕션 2차 (2026-09-13, 가죽 공방) — Marquee 수정 검증 + 새 버그

재배포 후 다시 생성했다.

**Marquee 수정 검증됨.** 백지 없음. 섹션 10개(preloader·cursor·nav·scene-nav·hero·chapter·scene·
marquee·contact) 전부 렌더, 마퀴 텍스트 정상 출력(`#핸드메이드 · 식물성 탄닌 가죽 · 주문 제작 …`),
`data-theme="dark"` 유지. 시드된 킷에 `normalizeMarqueeItems` 포함 확인.

**새 버그: 사진 URL 조립이 틀린다.** 이미지 4장 전부 404.

```
실제:  https://pub-….r2.dev/hero.jpg
정상:  https://pub-….r2.dev/media/<jobId>/hero.jpg
```

모델이 `MEDIA_BASE`를 버킷 루트로 잡고 파일명만 붙여 `media/<jobId>/`를 통째로 빠뜨렸다.
(skeleton7Images.ts 주석의 "LLM은 URL을 통째로 안 쓰고 MEDIA_BASE + 템플릿 리터럴로 조립한다"가
이번엔 잘못된 base로 조립된 경우다.)

이게 방어를 전부 통과한 이유 — **"호스트가 r2.dev면 정상"이라는 가정**이 두 곳에 있었다.
- `injectCinematicImages`: 외부 호스트만 교체 대상으로 봤다 → R2 도메인이면 손대지 않았다.
- `checkCinematicSceneOrder`: r2.dev면 통과시켰다.

조치
1. `injectCinematicImages`가 **예약 URL 그 자체**(쿼리 무시 비교)만 남기고 나머지 이미지 URL은 전부
   갈아끼운다. 호스트가 아니라 URL 일치로 판정한다. 캐시버스터(`?v=`)가 붙은 예약 URL은 그대로 둔다.
2. 게이트가 `r2.dev`인데 `/media/` 경로가 없는 이미지 URL을 잡는다.

테스트 71건 통과(신규 3건). 저장된 생성물 5건 재판정도 전부 PASS.

## 프로덕션 3차 (2026-09-13, 도자기 공방) — URL 수정 검증, 프리뷰는 런타임 사망

**URL 수정 검증됨.** 생성물의 이미지 URL이 전부 정상 형태다:

```
https://pub-….r2.dev/media/jmtzok8ix-34871df51785/hero.jpg?v=1789295919994
```

`media/<jobId>/` 경로 포함, `?v=` 캐시버스터까지 붙었다(= 이미지가 실제로 R2에 올라가 적용됐다는 뜻).
히어로 영상도 `hero-seedance.mp4`로 들어갔다. 2차의 버킷 루트 404는 재현되지 않았다.

**하지만 프리뷰가 안 떴다.** WebContainer 쪽 런타임 사망이다:

```
[vite] Pre-transform error: The service was stopped (x17)
```

esbuild 서비스가 죽고 이후 transform이 전부 실패했다. "다시 시도", 페이지 새로고침, 프리뷰 직접 열기
모두 회복 실패. 킷·프롬프트와 무관한 인프라 문제다(three 포함 큰 의존성 + 오래 열린 탭들의 메모리 압박이
유력하지만 확정은 못 했다).

그래서 생성된 소스를 그대로 로컬 하네스(`renderGenerated.mjs gen-2026-09-13-prod/`)로 재현해 측정했다:

| 항목 | 결과 |
|---|---|
| 히어로 WebGL | 캔버스 O, `<video>` 폴백 없음, 모션 1.94 |
| 프리로더·커서 | O |
| 핀·스크럽 | O·O |
| 3D 드래그 | 86.0 |
| FCP | 460ms |
| 모바일 400px | 가로 넘침 없음 |

이 생성물은 `<TextReveal …>문장</TextReveal>`(children 형태)로 썼는데 정상 렌더됐다 — 09-12에 넣은
방어가 실제 생성물에서 먹은 사례다.

### 새로 눈에 띈 것: 모델이 없는 prop을 지어낸다
- `<Showcase3D description=…>` — 킷은 `body`다. 설명 문장이 조용히 안 나온다.
- `<Contact eyebrow=… description=…>` — 킷에 없는 prop. 같은 방식으로 사라진다.
크래시는 아니지만 카피가 통째로 유실된다. 다음 차수 후보: 킷이 흔한 별칭(description→body)을 받아주거나,
게이트가 미지의 prop을 잡는다.

## 프로덕션 4차 (2026-09-17, 원목 가구 공방) — 처음으로 프로덕션 프리뷰에서 전부 눈으로 확인

`1a0db3f4`(지어낸 prop 별칭 + 모르는 prop 게이트) 배포 후 생성. WebContainer 정상 기동(`VITE ready in 1549 ms`).

| 항목 | 결과 |
|---|---|
| 히어로 WebGL | `<canvas>` 1, `<video>` 폴백 0 — 셰이더 위 흰 헤드라인, 밝은 창가 사진에서도 읽힘 |
| 예약 사진 | `<img>` 5/5 로드, 외부·경로 빠진 URL 0, `?v=` 캐시버스터 적용 |
| 다크 팔레트 | `data-theme="dark"` |
| 핀 챕터 | 01 원목 선별 → 02 손끝의 마감 → 03 완성과 전달, 인덱스 전환 확인 |
| 3D 쇼케이스 | 볼이 실제 렌더, 라벨 "DRAG TO ROTATE"(3D 모드) |
| 별칭 카피 | Contact eyebrow "VISIT & CONTACT", description→note "주문 제작은 평균 4~6주 소요돼요", Showcase description→body 모두 화면에 나옴 |
| 한글 줄바꿈 | 어절 단위 정상 |

측정 함정 기록: 프리뷰 URL을 **새 탭**으로 열면 그 탭은 `visibilityState: hidden`이라 IntersectionObserver가
돌지 않고, Showcase3D가 "360° · 데스크톱"(정지)로 남는다. 킷 버그로 오인하기 쉽다 — 3D는 보이는 탭
(워크벤치 안 프리뷰)에서 확인해야 한다.

남은 관찰(2단계 밖)
- 워크벤치 프리뷰에서 3D 위 드래그가 회전 대신 페이지를 다음 스냅 지점(Contact)으로 넘겼다. 로컬 하네스에서는
  드래그 회전이 측정되므로(81.6) 스냅 + iframe 조합의 상호작용 문제로 보인다. 미조사.
- 채팅 패널에 "마무리가 안 끝났어요"/"고치지 못했어요" 알림 — 화면은 정상. feat/stall-fix 영역.

## 3D 드래그 중 페이지가 밀리던 문제 (2026-09-18)

09-17 프로덕션 프리뷰에서 3D 볼을 가로로 끌었더니 오브젝트가 도는 대신 페이지가 다음 장면(Contact)으로
넘어갔다.

원인: 드래그 자체는 스크롤을 만들지 않지만, 직전 스크롤의 **스냅 트윈이 아직 날아가는 중**이면 그게
드래그 도중에 착지한다. ScrollTrigger의 스냅 트윈은 Lenis를 거치지 않고 스크롤러를 직접 움직이므로
`lenis.stop()`만으로는 막히지 않는다.

조치 — 드래그하는 동안만 스크롤을 잠근다(`setCinematicScrollLock`).
1. 날아가는 스냅 트윈을 죽인다(`snapTrigger.tween` / `getTween(true)` 둘 다 시도).
2. 스냅 트리거 자체를 끈다 — 잠금 중에 새 스냅이 시작되지도 않게.
3. `lenis.stop()` + 위치 고정(스크롤 이벤트에서 원위치로 되돌림).
4. 잠금 중에는 `snapTo`가 현재 진행도를 그대로 돌려준다(이동 거리 0).
놓으면 전부 되돌린다. 컴포넌트가 드래그 도중 언마운트돼도 잠금을 푼다.

**잠금 상태는 globalThis에 둔다.** 모듈 스코프 변수로 두면 안 된다 — Showcase3DScene은 three 청크를 늦게
받으려고 lazy로 불리는데, 번들러가 hooks를 그 청크에도 복제하면 모듈 인스턴스가 둘이 되어 잠금을 건 쪽과
Lenis를 쥔 쪽이 다른 변수를 본다(실측: 첫 구현에서 잠금이 걸렸다고 기록되는데 페이지는 계속 움직였다).

검증: 캔버스 위에서 1초 드래그 — 잠금 depth 1 유지, `scrollY`가 드래그 내내 고정, 놓은 뒤 휠 스크롤 정상.
하네스 `dragScrollDelta` 3회 연속 0, `scrollAliveAfterDrag` true.

### 하네스 측정 결함 3건도 같이 고침
- 기준점을 pointerdown **이후**로 옮겼다. 그 전에는 직전 스크롤의 스냅이 착지하는 중이라 드래그와 무관한
  이동까지 재서 56~190px로 들쭉날쭉했다.
- 3D 측정 직전 뷰포트를 키우면 ScrollTrigger가 핀 구간을 다시 계산하며 스크롤이 더 움직인다 —
  `waitForScrollIdle()`로 멎을 때까지 기다린 뒤 잰다.
- `dragDelta`(픽셀 변화)는 회전 판정으로 약하다. jar·bowl은 LatheGeometry라 Y축 회전이 이미지를 거의
  안 바꾼다(실측 2.78). 예전에 크게 나오던 81.6은 **회전이 아니라 페이지가 밀린 것**을 재고 있었다.
  이제 판정은 "페이지가 안 밀렸고, 놓은 뒤 스크롤이 살아난다"로 본다.

## 프로덕션 사고 기록 — "Worker exceeded resource limits" (2026-09-18)

3D 드래그 잠금(`e962e83f`) 배포 12분 뒤, 로그인 브라우저에서 `coralred.kr/`이 Cloudflare 오류 페이지를 반복
반환했다. curl(비로그인)은 200. `d10c3cde`(1a0db3f)로 롤백하자 즉시 회복.

조사 결과 **코드 회귀가 아니다.**
- 두 커밋 차이는 클라이언트 킷 파일과 테스트 하네스뿐. 서버 번들(`build/server`)에 킷 코드 0줄.
- 문제 배포 URL을 tail 하며 59요청 전부 `ok`. 쿠키 요청 CPU 11~24ms. 롤백본과 프로파일 동일.
- 플랜 `usage_model: standard`(CPU 30s) → `/`(최대 610ms)가 CPU 한도에 걸릴 수 없다. 남는 원인은 격리체
  메모리 128MB. 같은 시각 생성 1건이 돌고 있었고(`/api/chat` 스트리밍 + 자동검토 + `/api/media-images`가
  이미지 바이트를 3벌로 들고 4장 순차 생성 + 영상 폴링), 한 격리체가 터지면 그 격리체의 모든 요청이 실패한다.
  브라우저는 커넥션 재사용으로 같은 격리체를 탔고 curl은 새 격리체를 탔다. 롤백 = 격리체 전부 교체.
- 메모리 수치는 직접 못 봤다(tail에 없음). 추정임을 명시한다.

악화 요인(확정): `public/_routes.json`이 없어 정적 에셋 47건/페이지가 전부 Function을 거친다(CSS 하나 CPU 220ms).

결론: `e962e83f`는 재배포해도 된다. 진짜 조치는 `_routes.json` 추가, 이미지 라우트 메모리 절감, 미디어 생성의
Worker 분리다 — 이건 2단계 밖이라 별도 작업으로 넘긴다.

## 2026-09-18 12:05 — `_routes.json` 배포 후 재발 확인, 원인 범위 좁힘

- `public/_routes.json` 추가(정적 에셋 Function 제외) → 커밋 4de85278, main 동기화, `npm run deploy` → 9fbd99c8. `/assets/*`·`/favicon.svg`·`/robots.txt` 전부 200 REVALIDATED(정적 서빙), `/`·`/pricing` DYNAMIC(Function). 의도대로 동작.
- 생성 1건 실행(가죽 공방·다크). `/api/chat` 200(35s)이었으나 `/api/media-images` 503, `/api/health` 503 반복, "마무리가 안 끝났어요" 경고. **`_routes.json`은 사고를 막지 못했다.**
- 재현 실험(브라우저 콘솔 fetch, 같은 HTTP/2 커넥션):
  - `/api/health` 쿠키 포함 9/20 503, `credentials:'omit'` 0/20 → 처음엔 쿠키로 보였으나, 쿠키를 전부 지워도 6/20 503. `omit`은 Chrome이 **별도 소켓 풀**을 써서 다른 엣지 머신에 붙는 것뿐.
  - `/pricing`(SSR) 12/12 503, 각 ~190ms. `/api/models` 1/12. 503 응답 ray는 전부 `…d045-SJC`, 같은 머신.
  - curl(매번 새 커넥션)은 `/pricing` 12/12 200, ray 접미사 전부 다른 머신. `/api/health` keep-alive 30/30 200(다른 머신).
  - Chrome을 example.com으로 30초 보냈다 돌아와도 여전히 d045 → 재로그인 페이지(`/`)조차 503.
- 판정: **엣지 머신 d045의 우리 Worker 격리체가 병들었고 브라우저는 그 머신에 핀 고정**. 생성(스트리밍+미디어) 요청을 받은 머신이 그 후 SSR을 한 번도 못 돌린다(15분 이상 지속). 코드 회귀 아님(curl은 어느 배포본에서도 정상).
- 남은 분기: 메모리 누수(격리체 128MB, 생성 후 잔존 상태) vs CPU 한도(Free 플랜 10ms — SSR 웜 11~24ms가 이미 초과, 관대한 집행이 머신별로 다를 수 있음). 어제 tail에서 CSS 요청 CPU 220ms가 `ok`였던 것은 Paid(30s) 쪽 정황. **플랜 확인이 결정적** — API 토큰에 구독 읽기 권한 없음, 대시보드 로그인 필요.
- GraphQL `workersInvocationsAdaptive`는 0행(Pages Function은 이 데이터셋에 안 잡히거나 토큰 범위 밖). `wrangler pages deployment tail 9fbd99c8`은 "does not have a Pages Function"이라며 거부 — `_routes.json` 유무와 관련 있는지 미확인(Function 자체는 동작).
- 드래그 검증: 이 브라우저는 d045에 묶여 생성 불가. Chrome 재시작(또는 `chrome://net-internals/#sockets` → Flush socket pools) 후 재시도해야 한다.

## 2026-09-18 12:20 — 재배포로 d045 리셋, 프로덕션 드래그 검증 통과, 재주입 버그 발견·수정

- 사용자 확인: **Workers Paid 플랜** → CPU 10ms 가설 기각, 남는 건 격리체 메모리(128MB) 쪽.
- Chrome 재시작 후에도 d045에 붙음(h2, h3 아님). curl에 브라우저 헤더를 붙여 8회 → 1회가 d045에 떨어져 503. **머신 자체가 병든 것, 브라우저·쿠키·헤더 무관.** 같은 코드를 `npm run deploy`로 재배포(e2c78b8b) → d045에서 `/pricing` 8/8 200. 새 버전 = 새 격리체.
- 생성 1건(가죽 공방·다크): `/api/chat` 200(43s), `/api/llmcall` 자동 검토·수정 2회, 영상 폴링 7회. 오류 없음. 생성 직후 브라우저 커넥션이 cf23으로 옮겨가 "생성이 d045를 병들게 하는가"는 이번엔 판정 못 함.
- **3D 드래그(프로덕션, 보이는 작업 화면)**: Showcase3D에서 가로·세로·대각 드래그 3회 — 장면 그대로, Contact로 안 튐. 이후 휠 스크롤은 살아 있음(다음 장면으로 갔다가 스냅). 통과.
- **새 결함**: 모델이 예약 URL을 무시하고 Pexels 4장을 씀(히어로에 실사 인물 스톡 — 하드 룰 위반). 자동 검토 뒤 주입은 됐는데(12:13:16 `applied (injected)`) BigNumber 크래시 자동 수정 턴이 App.tsx를 통째로 다시 써서(12:13:37) Pexels가 복귀. 자동 검토는 1회성이라 재주입 없음.
  - 수정: `skeleton7Images.ts`에 `lastApplied` 기억 → pending 없고 lastApplied 있으면 새 잡 없이 재주입(`mode: 'reinjected'`, 멱등). `Chat.client.tsx`에 자동 수정 턴 종료 감지(armed→loading→apply) effect. spec 1건 추가(주입→되돌림→재주입, fetch 추가 호출 0).
  - 미해결: 모델이 예약 URL을 왜 무시했는지("URL이 준비된 게 없어서"라고 말하며 Pexels 사용). 프롬프트 줄은 들어갔다(영상 체인이 돌았으므로 prepare 성공). 다음 생성에서 재확인.
  - `BigNumber`는 킷에 있지만 `KIT_COMPONENT_PROPS`·11장면 순서에 없다 — 모델이 `items` 배열을 넘겨 크래시. 게이트 확장 후보.

## 2026-09-18 12:40 — 재생성(도예 공방·다크): 예약 사진 프롬프트 모드로 들어감, 격리체 범인 범위 좁힘

- 생성물 `App.tsx`: `HERO_IMAGE`/`CH1~3` 전부 `pub-…r2.dev/media/jmu6ep4iq-…/` 예약 URL, `HERO_VIDEO`도 `hero-seedance.mp4`. **모델이 예약 URL을 그대로 씀(prompted 모드)** — 직전 런의 Pexels는 모델 편차였다.
- R2 실제 파일: hero.jpg·ch1.jpg·ch2.jpg 200, **ch3.jpg 404**, hero-seedance.mp4 404(영상은 아직 생성 중일 수 있음). ch3 누락은 별도 조사 필요(이미지 세트 4장 중 3장만 업로드?).
- 프리뷰 미확인: `/api/chat` 200(30s) 후 "마무리가 안 끝났어요"(Post-stream action stall) — 액션 하나(App.tsx write)가 running에서 안 내려옴, 프리뷰는 스타터 그대로. 오늘 3런 중 2런(1·3) 재현, 2런은 정상. "다시 시도"(액션 재실행) → `/api/chat` 503 "Worker exceeded resource limits" HTML이 채팅에 덤프.
- 격리체 실험:
  - 생성 직전 같은 커넥션(머신 17d1) `/pricing` 200 → 생성 뒤 7/8 503. **생성 플로우가 격리체를 병들게 한다(확정).**
  - 재배포로 리셋 후 브라우저에서 `/api/media-images` reserve+generate만 실행(41s, 200) → `/pricing` 8/8 200, `/api/health` 6/6 200. **이미지 생성 단독은 무죄.**
  - 남은 용의자: `/api/chat`(스트리밍 30~45s), `/api/llmcall`(자동 검토), `/api/media-video`(폴링), `/api/onboarding`. curl `--next`는 커넥션을 안 이어서(ray 매번 다름) 브라우저 핀 커넥션으로만 실험 가능.
  - 다음 실험: 브라우저에서 `fetch` 몽키패치로 `/api/chat` 요청 본문을 캡처 → 재배포 → 같은 본문만 재생 → `/pricing` 프로브.

## 2026-09-18 13:10 — 실험 2(chat 본문 재생) 결과: 단독은 무죄, 동시 실행이 격리체를 죽인다

브라우저 `fetch` 몽키패치로 실제 `/api/chat` 본문(112KB) 캡처 → 같은 핀 커넥션(머신 cd6e)에서 재생.
- `/api/chat` 단독 재생: 200, 33s, 24.7KB → 직후 `/pricing` 8/8 200.
- `/api/media-images` 단독: 41s, 200 → 8/8 200.
- 실생성(UI, cd6e): 통과(8/8 200) — 겹쳐도 살아남는 경우 있음.
- **chat 재생 + media 동시**: chat "network error"(스트림 절단) + media 503 `Worker exceeded resource limits`(19s). 직후 8/8 200(격리체 교체됨).
- 메모리 다이어트(9565357a: base64 원문 레퍼런스, previous bytes 해제, R2 복사 제거) 배포 후 재실험: chat 200(34s) 완료 → **media 503(40s, 4번째 이미지 즈음)** → `/pricing` 8/8 503 지속. 다이어트로는 부족.
- 해석: chat이 끝난 뒤에도 격리체 힙이 높게 남아 media의 후반 이미지에서 넘친다. chat 단독으론 안 넘치지만 잔류가 있다. 잔류 후보: Sentry(@sentry/cloudflare consoleIntegration·fetchIntegration·opentelemetry 스팬), AI SDK 스트림, LLMManager.
- 다음 실험(사용자 결정 필요): (a) `functions/_middleware.ts`의 Sentry 플러그인을 임시로 끈 빌드 배포 → 동시 실험 반복. 자동 모드 분류기가 "로깅 변조"로 차단해 실행 못 함. (b) chat → 완료 후 media(겹침 없음) 순차 실험 — 잔류 여부 판정.
- 현재 프로덕션: 머신 cd6e가 병든 상태, 재배포 필요(`npm run deploy`) — 이것도 분류기가 차단.

## 2026-09-18 13:40 — ① 구현·검증: 이미지 세트를 chat 스트림 종료 뒤 시작

- 7ce5e54f: `prepareSkeleton7Images`는 예약만, 생성 POST는 `startSkeleton7ImageSet()`(Chat.client, `isLoading` false 시) 또는 `applySkeleton7Images`가 시작. 배포 18ca4dbe.
- 실생성(목공예·다크, 머신 ee01) 타임라인: reserve(-5s) → chat(-4s~37s) → **media-images 37s~78s(200)** → llmcall 37s·42s → media-video 폴링 78s~. 겹침 없음. 직후 `/pricing` 8/8 200, `/api/health` 4/4 200. **머신 건강.**
- 프리뷰: 히어로·챕터 전부 R2 생성 사진(목공 작업실, 인물 없음). R2 hero/ch1/ch2/ch3 200.
- 새 결함: 모델이 영상 URL만 `https://images.coralred.app/woodcraft/hero-seedance.mp4`로 지어냄(404) — 주입기·게이트가 영상은 무시했다. 수정: `injectCinematicImages(content, urls, video)`가 외부 영상 URL을 예약 영상 URL로 치환(`slots: 'video'`), 게이트에 `예약된 영상 대신 외부 영상 URL을 지어냈다` 추가, 주입 경로에도 영상 준비 시 bustUrls. spec 3건 추가(77 통과).
- 남은 것: "마무리가 안 끝났어요"(post-stream stall) 경고가 오늘 6런 중 4런 — 프리뷰는 정상 렌더된 경우도 있어 액션 상태 표시 문제로 보임. 별도 조사.

## 2026-09-18 14:10 — "마무리가 안 끝났어요"(post-stream stall) 원인 조사

- 증상(6런 중 4런): 마지막 파일 액션(App.tsx)이 `running`에 남음(Artifact.tsx의 "화면을 만들고 있어요" = running file action). 파일은 써져 프리뷰 정상. 콘솔에 다른 오류 없음.
- 경로 추적: 스트리밍 중 `actionStreamSampler → _runAction(streaming) → runner(파일 부분 쓰기, status running)`. 닫힘 시 `onActionClose → addToExecutionQueue(_runAction) → editor update → filesStore.saveFile → runner.runAction(complete)`. `complete`는 마지막 runner 호출에서만 찍힌다.
- 결함 2개(둘 다 saveFile 경로):
  1. `FilesStore.saveFile`: `webcontainer.fs.writeFile` await에 타임아웃이 없다 — 291cacdb가 액션 러너 쪽에서 관측한 "파일은 써지는데 응답이 유실" 케이스가 여기서 나면 `_runAction`이 영영 멈추고 complete 표시가 안 온다. 파일은 스트리밍 쓰기로 이미 반영돼 프리뷰는 정상 — 관측과 정확히 일치.
  2. `saveFile`이 워처가 아직 못 올린 새 파일에 `unreachable('Expected content to be defined')`를 던지고, `WorkbenchStore.addToExecutionQueue`에 catch가 없어 거부 하나가 전역 큐를 죽인다(이후 모든 close 실행 건너뜀). 콘솔에 'Failed to update file content'가 남아야 하는데 이번 런에선 없었음 → 1번이 주범, 2번은 잠재.
- 수정: saveFile에 20s 타임아웃(타임아웃 시 던지지 않고 진행 — 바로 뒤 러너 쓰기가 자체 타임아웃·failed 표시로 두 번째 기회), 새 파일은 oldContent ''로 처리, 전역 큐 catch, stall Sentry extra에 `type:status:executed` 추가(다음 발생 때 경로 확정용). spec 2건(files.spec.ts).
- 근본(WebContainer writeFile 응답 유실)은 미해결 — 계측이 Sentry에 쌓이면 빈도·파일 크기 상관 확인.

## 2026-09-18 14:50 — 스톨 수정 배포·검증 시도 (2개 경로 확정, 나머지 계측)

**원인 분해:** "마무리가 안 끝났어요"(post-stream stall)는 단일 버그가 아니라 증상. complete 표시는 `onActionClose → WorkbenchStore._runAction → filesStore.saveFile → runner.runAction` 순서의 맨 끝에서만 찍힌다. 이 사슬을 끊는 경로 3개:
1. **saveFile의 webcontainer.fs.writeFile 무응답** — 타임아웃 없었음(291cacdb는 액션 러너 쪽만 막음). 파일은 스트리밍 쓰기로 이미 반영돼 프리뷰는 정상 → 관측과 일치. **수정: 20s 타임아웃, 던지지 않고 진행.**
2. **새 파일 unreachable → 전역 큐 사망** — 스트리밍 직후 워처가 못 올린 파일에 saveFile이 `unreachable`을 던졌고 `addToExecutionQueue`에 catch가 없어 이후 close 실행 전부 스킵. **수정: 새 파일 처리 + 큐 catch.**
3. **WebContainer 자체 사망** — `The service was stopped (x17)`, 브라우저 탭이 한 세션에서 ~7회 생성 후 자원 소진. 서버 버그 아님, 새 탭이면 리셋. 계측만.

fd8c210a 배포(5a614bec). files.spec.ts 2건.

**검증 2회 다 다른 이유로 막힘:**
- 금속공예 런(기존 탭): stall 떴으나 터미널 `The service was stopped (x17)` = 경로 3(WebContainer 사망). 내가 고친 1·2가 아님. App.tsx가 ScrollChapter·ImagePlaceholder(킷에 없음)·BigNumber를 써서 Vite pre-transform 에러도 겹침.
- 가다페 런(새 탭, WebContainer 정상): stall 안 뜸, 프리뷰 정상. 그러나 `/api/chat`이 **Anthropic 크레딧 잔액 부족**("Your credit balance is too low")으로 실패 → App.tsx 생성 자체가 안 됨. 코드로 검증 불가.

**막힌 것 — 사용자 액션:** Anthropic API 크레딧(플랫폼 키) 충전해야 생성이 돌고, 그래야 1·2 경로를 end-to-end로 확인 가능. 지금은 스톨 수정 2건이 유닛 테스트로만 검증됨.

## 2026-09-18 15:20 — 게이트 구멍 2개 메움 (큐 3번)

- **발견: `checkCinematicSceneOrder`는 벤치마크 하네스에서만 돌고 프로덕션 자동 검토(`runMechanicalChecks`)에 연결된 적이 없었다.** 오늘 실측에서 Pexels 4장·지어낸 prop·지어낸 영상 호스트·`ImagePlaceholder` import가 전부 통과한 근본 이유. 자동 수정이 돈 건 런타임 크래시(BigNumber) 알림뿐.
- 수정 1: `mechanical-checks.ts`에 `runCinematicSceneOrderCheck` — `isCinematicTrackFile`인 파일에 게이트를 돌려 `rule: 'cinematic-scene-order'` 힌트 finding으로 LLM 검토에 넘긴다(자동수정 없음). spec 2건.
- 수정 2: `sceneOrder.ts`에 `KIT_EXPORTS`(index.ts와 1:1) + `킷에 없는 컴포넌트를 import했다 — …` 문제. type import·`as` 별칭 처리. spec 3건(그중 하나는 `kits/cinematic/src/index.ts`를 읽어 목록 동기화 검증).
- `BigNumber`는 이미 `KIT_COMPONENT_PROPS`에 있었음(value·prefix·suffix·label·decimals·group).
- 검증은 유닛(188 통과)까지. 실생성 검증은 Anthropic 크레딧 뒤.

## 2026-09-18 15:45 — `/api/llmcall` 400 원인 (큐 4번)

- 가다페 런의 `/api/llmcall:400`은 우리 검증 400이 아니라 **Anthropic upstream 400 "Your credit balance is too low"**가 catch fallback(`status: errorResponse.statusCode`)으로 그대로 통과한 것. chat 실패와 같은 뿌리(크레딧 소진). 자동 검토 로그엔 "llmcall failed 400"만 남아 형식 오류처럼 보였다.
- 수정: `app/lib/.server/llm/provider-error.ts` `isProviderBillingError`(Anthropic·OpenAI 결제 문구) → api.llmcall이 **402 `provider_billing`, isRetryable false**로 갈라 냄, Sentry tag `kind: provider_billing`. reviewGeneratedApp은 402면 "skipped — provider billing"로 로그. spec 3건.
- 사용자 액션 그대로: Anthropic 크레딧 충전 전엔 chat·자동 검토 둘 다 못 돈다.

## 2026-09-18 16:20 — WebContainer/dev 서버 사망 대응 (큐 5번)

- 실측 증상: 한 탭에서 생성 ~7회 뒤 터미널 `[vite] Pre-transform error: The service was stopped (x17)`, 프리뷰 "미리볼 화면이 없어요", 액션 영영 running(stall 경로 3). esbuild 서비스 프로세스가 컨테이너 안에서 죽은 것 — 코드 문제가 아니라 LLM 자동 수정 대상이 아님.
- 구현:
  - `app/lib/stores/devServerHealth.ts`: 볼트 셸 출력 스트림(`shell.ts` streamA)에서 `The service was stopped|Pre-transform error` 감지, 10s dedupe, `devServerCrashAtom`(count·sample). spec 3건.
  - `ActionRunner.restartStartAction`: 마지막 `start` 액션을 러너 경로로 재실행 — 옛 실행 abort → 셸 executionState의 옛 abort 콜백 비움(안 비우면 executeCommand가 다시 불러 새 실행을 'aborted'로 덮음) → 새 AbortController로 'running'. `WorkbenchStore.restartDevServer()`가 호출. spec 2건(재시작 후 status running 유지, 명령 재발행).
  - `Chat.client`: atom 구독 → 2회까지 자동 재시작 + toast "미리보기 서버가 멈춰서 다시 시작하고 있어요", 그 뒤엔 `actionAlert`(source 'terminal' → runAutoFix 대상 아님) "이 브라우저 탭의 자원이 소진됐어요. 저장 기능을 켠 뒤 새 탭에서…". Sentry `dev_server_crash`(count·restarts·sample).
- 검증: 유닛만. 실제 esbuild 사망은 프로덕션 UI에 터미널 입력이 없어 임의 유발 불가 — 다음 실사용에서 Sentry 이벤트·토스트로 확인. 재시작으로 회복되는지(컨테이너 메모리 자체가 소진됐으면 안 될 수 있음)는 미확인.

## 2026-09-18 17:30 — 킷 v0.4 구도 패스 (품질 감사 → 수정)

**감사 방법:** `AUDIT=1 node tests/benchmark/cinematic/renderGenerated.mjs gen-2026-09-13-prod/` — 1440×900에서 장면마다 뷰포트 샷 + 타이포 수치(`audit/metrics.json`). 보조: `shotScenes.mjs`(뷰포트 단위 샷), `probeSection.mjs`(박스 수치). 미디어는 하네스 스틸(크루아상) — 구도·타이포만 본다.

**감사 결과(v0.3, 수정 전):** 히어로 104px 세리프 4줄 + 문단 + 주황 알약 버튼 2개 + 내비 링크 3개 + 알약 CTA = SaaS 히어로 템플릿. 전면 검은 스크림이 사진을 죽임. 챕터: 액자 사진 + 66px 제목 + 위 빈 공간 + "01 01" 번호 중복 버그. 쇼케이스: 40px 제목 + 둥근 액자 박스 = 제품 카드. 컨택트: 위 절반 공백 + 4열 표 + 알약 버튼 = 푸터 템플릿(1098px, 한 화면 초과). 한글 눈썹에 0.18em 자간("가 온 도 자"). 스크롤 후 내비 블러 띠가 풀블리드 사진을 가로지름.

**v0.4 수정(킷만, 프롬프트·LLM 무관):**
- tokens: 디스플레이 300/-0.03em/1.02, xl 136·lg 96(1440에서 130·92px). `.ck-btn` → 밑줄 텍스트 링크(알약은 `--solid`로 격하). `.ck-grain` 필름 그레인. `box-sizing: border-box` 리셋. 한글 눈썹 자동(`hasHangul`/`eyebrowClass`).
- Nav: 상호 16/500, 링크 13px, CTA 밑줄 링크, 배경 띠 없음 + `mix-blend-mode: difference`.
- HeroScene: 헤드라인 16ch 3줄 이내가 왼쪽 아래 압도, 보조 문장은 우하단 캡션(30ch·15px), 대각 그라데이션+비네트+그레인, SCROLL 라벨 제거.
- PinnedChapters: 미디어가 오른쪽 절반을 화면 끝까지(풀블리드, 액자 없음), 텍스트 3단(세로 인덱스/92px 제목 13ch/진행선), `stripLeadingIndex`로 번호 중복 제거.
- Showcase3D: 한 화면 장면, 스테이지 풀블리드, 제목 --lg, 스펙 표 하단.
- Contact: 제목 위·정보 행 바닥(auto 1fr auto), 정확히 100svh.
- SceneNav 36px 투명.

**수정 후 실측(1440):** 히어로 h1 130px w300 3줄, 챕터 h3 92px 2줄, 쇼케이스 92px, 컨택트 130px 2줄·섹션 900px. 샷: `render-2026-09-12/kit-v0.4-audit/{hero,chapter,showcase3d,contact}.png`.

**남은 것(미착수):** 모션 감사(스크럽 패럴랙스·스태거 수치), 라이트 팔레트 검수, 모바일 400px 재감사, TextReveal·Marquee 장면 `data-ck` 부여(감사 캡처 누락), 실생성 확인은 크레딧 뒤.

## 2026-09-18 18:30 — 모션 감사 (CSSDA motion.mjs를 킷 빌드에 적용)

**방법:** `renderGenerated.mjs`로 빌드 → `serveDist.mjs 4188` → `node tests/benchmark/cssda/motion.mjs --out <tmp>`(수상작 90개와 같은 측정: 1280×800, 700ms 프레임 차이·호버·휠 400·여정). 비교 기준 = 수상작 중앙값/p75.

| 지표 | 수상작 중앙값 / p75 | v0.4 전 | v0.4 후 |
|---|---|---|---|
| idleMotion(앰비언트) | 0.036 / 0.173 | **0.001** | **0.044** |
| hoverDiff | 0.018 / 0.158 | **0** | **0.033** |
| inertia | 0.196 / 0.423 | 0.327 | 0.795(스냅 이동 포함) |
| journeyChange | 0.367 / 0.615 | 0.52 | 0.51 |
| scrollDelta(휠 400 → 실제 이동) | 394 | **112** | **767** |

**원인·수정:**
- 앰비언트 0.001: 히어로 셰이더 변위 0.006·속도 0.08은 정지 사진과 구별 불가 → 0.013·0.16, 그레인 0.06→0.09, CSS `.ck-kenburns`(22s 1→1.07) 미디어 레이어에, `.ck-grain` 0.1.
- 호버 0: 선 하나 링은 측정 불가 → 호버 시 링 2.4배·액센트 채움·`difference` 블렌드, 내비 링크 `.ck-navlink` 밑줄 그리기.
- scrollDelta 112: "가장 가까운 지점" 스냅이 뷰포트 44% 휠을 삼키고 히어로로 되돌림 → 방향 스냅(`self.direction`, 12% 넘으면 다음 장면). GSAP snapTo는 `(naturalEnd, self)`만 넘긴다 — 세 번째 인자 없음.
- 부수: `difference` 내비가 흰 벽 위에서 탁해짐 → 히어로 상단 14% 그라데이션.

증거: `render-2026-09-12/kit-v0.4-audit/{motion.json,motion-frame-0.jpg,hero.png}`. 보조 스크립트 `serveDist.mjs`.
**남은 것:** 챕터 핀 구간의 앰비언트(스크럽 외 유휴 모션 없음), 라이트 팔레트·모바일 감사, 실생성 확인(크레딧 뒤).

## 2026-09-18 19:10 — 라이트 팔레트 검수 (coral: bg #FBF5EE / text #1A1A1A / accent #FF5330)

- 하네스 `PALETTE=light AUDIT=1 renderGenerated.mjs` 추가 — 코랄레드 라이트 변수를 :root에 깔고 렌더.
- 통과: 히어로(사진 위 흰 글자, 팔레트 무관), 챕터(크림 배경·92px 검정 세리프·B&W 풀블리드), 컨택트, 내비(`difference` → 크림 위에서 검정).
- 결함 3개 → 수정:
  1. 커서 링 `difference` 블렌드가 액센트를 보색(시안)으로 뒤집음 → 블렌드 제거(호버 채움은 그대로).
  2. SceneNav 흰 화살표가 크림 위에서 사라짐 → 흰색+`difference`(내비와 동일).
  3. Showcase3D 스테이지의 회색 세로 그라데이션이 제품 사진 기본 배경처럼 읽힘 → 바닥 그림자(radial) + `--ck-bg`→`--ck-surface` 미세 그라데이션.
- 증거: `kit-v0.4-audit/light-{chapter,showcase3d,contact}.png`. 미확인: 마퀴·TextReveal 장면(캡처 누락, `data-ck` 없음).
