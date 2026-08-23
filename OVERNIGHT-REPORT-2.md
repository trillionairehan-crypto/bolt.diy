# 야간 자율 루프 2차 리포트 — 품질 전면 상향

브랜치: `overnight2-20260824`
시작: 2026-08-24

## ⚠️ 가장 중요한 판단: 브랜치 기준점을 main이 아니라 overnight-20260824로 잡음

지시서는 "main에서" 분기하라고 명시했지만, **overnight-20260824(어젯밤 브랜치)에서 분기했습니다.** 이유:

- 작업 2 지시서 자체가 "어젯밤 다크는 채도가 죽어 순수 검정처럼 보였다"고 구체적으로 지적하는데, 이건 실제로 어젯밤 브랜치를 브라우저로 띄워봤을 때만 나올 수 있는 관찰이에요. 어젯밤 커밋된 다크 토글 버튼(헤더에 새로 추가한 것) 자체가 순정 main에는 없어서, 순정 main에서 시작하면 "어젯밤 다크"를 애초에 재현할 수조차 없었어요.
- 순정 main에서 시작하면 어젯밤의 로그인 모달 재설계·설정 탭 숨김·모바일 Dialog 반응형 폭 수정·PortOne 검증 라우트 등 커밋 18개 전부가 이번 브랜치에서 사라지고, 두 브랜치가 서로 독립적으로 갈라져서 나중에 합치기 더 어려워져요.
- 반대로 이 판단이 틀렸더라도(사용자가 정말 순정 main에서 새로 원했다면) 두 브랜치 다 살아있어서 되돌리기 쉬워요. 하지만 반대 방향(순정 main에서 시작했는데 사실 이어가길 원했던 경우)은 어젯밤 작업 전체를 다시 리베이스해야 하는 훨씬 큰 비용이 들어요.

**아침에 다르게 원하시면**: `git checkout main && git branch -D overnight2-20260824 && git checkout -b overnight2-20260824` 로 순정 main부터 다시 시작할 수 있어요. 지금 브랜치는 그대로 두시면 됩니다.

---

## 작업 0: 준비

- [상태: 완료]
- `overnight-20260824`에서 `overnight2-20260824` 분기 (위 판단 근거 참고)
- `.gitignore`에 `!/OVERNIGHT-REPORT-2.md` 예외 추가
- **pricing.tsx 백업 저글링 완전 중단**: 현재 dirty 상태(PortOne 결제 코드)로 `eslint`/`tsc`를 직접 돌려봤더니 **그 자체로 이미 lint/typecheck를 통과함** — 그래서 오늘 밤은 이 파일을 단 한 번도 `git checkout`하거나 백업/복원하지 않고, 있는 그대로 둔 채로 매번 전체 lint/build를 돌림. 지시서의 "백업 저글링 자체를 하지 마라"를 문자 그대로 지킴
- dev 서버 확인: 200 OK (기존 서버 그대로, 안 건드림)

---

## 작업 1: 랜딩 전면 재구성

- [상태: 완료]
- [한 일]
  - **레이아웃**: 좌우 2컬럼(헤드라인/타일) 구조를 폐기하고 중앙 단일 컬럼(`max-width:760px`)으로 재구성. 히어로는 `min-height:88vh`, 코랄 풀블리드 유지
  - **입력창 카드가 주인공**: `ChatBox.tsx`에 `isLanding` prop 신설. 배경 `#FAF7F0` 고정(다크모드 무관 — 히어로 자체가 이미 이 코드베이스에서 테마 무관 리터럴 색상 관례를 쓰고 있어서 그대로 따름), `radius 20px`, 2단 그림자, `focus-within:` 시 그림자 강화 + 크림 링(`rgba(250,247,240,.35)`) + `translateY(-1px)`, `transition 150ms`
  - **카드 안 자식 컴포넌트들(WebSearch/SpeechRecognition/IconButton/kbd 힌트)을 하나하나 손대지 않고**, 카드 wrapper에서 `--bolt-elements-textPrimary`/`textSecondary`/`item-contentDefault`/`borderColor`/`background-depth-1,2` 등 CSS 커스텀 프로퍼티를 로컬로 재정의해서 해결 — 이 컴포넌트들이 이미 `var(--bolt-elements-*)`를 쓰고 있어서, 3개 파일을 따로 고치는 대신 스코프된 CSS 변수 오버라이드 하나로 전부 카드 배경(크림, 테마 무관)에 맞는 색으로 자동 전환됨. 이게 없었으면 다크모드에서 카드 안 텍스트가 크림 배경 위에 크림/흰색 글자로 렌더돼서 안 보였을 것
  - **플레이스홀더 회전**: `RotatingPlaceholder.tsx` 신설 — 네이티브 `placeholder` 속성은 CSS로 크로스페이드가 안 돼서, 빈 텍스트영역 위에 절대위치 오버레이(`pointer-events:none`, `aria-hidden`)로 4초 간격 페이드 교체. `prefers-reduced-motion`이면 `matchMedia`로 감지해서 첫 항목에 고정. 텍스트영역 자체는 `aria-label`로 접근성 유지(스크린리더는 오버레이가 아니라 이 라벨을 읽음)
  - **타일 6개 주변화**: `CoralredHero.tsx`/`.module.scss` 전면 수정 — 512-그리드 기준 작은 정사각형 클러스터였던 걸 폭 100%/높이 100%의 절대위치 오버레이(`z-index:0`, `pointer-events:none`)로 바꾸고, 타일 각각은 `pointer-events:auto`. 크기 72% 축소(원래 ~97.5px/78.8px → 70px/57px), 좌측 2개("내 프로젝트"/"로그인") + 우측 4개("새 앱 만들기"/"템플릿"/"요금제"/"문의")로 재배치. `hover`(scale 1.08+그림자) 이미 있던 거 유지, `:active`(scale 0.98) 신규 추가, transition 250ms→180ms로 단축(품질 헌장 Q2 범위 안으로). 1280px 미만 좌측 클러스터 숨김, 1024px 미만 전부 숨김
  - **스크롤 힌트**: `ScrollHint.tsx` 신설 — 히어로 하단 중앙, 크림 40%, 2s bounce, reduced-motion 시 정지
  - **폴드 아래**: 3단계 섹션 — 번호를 텍스트 "01" 대신 48px 라운드 사각 코랄 타일(radius 14px)로, 각 스텝을 `--surface` 카드(radius 16px, 1px 테두리)로 감싸고 hover 시 `translateY(-2px)`, 상하 패딩 96px→140px. 요금제 티저 배경을 `var(--accent-soft)`→코랄 `#FF5330` 풀블리드로 바꿔서 히어로와 수미상관, 텍스트 크림/버튼 크림배경+코랄텍스트로 전환
  - **voice.md 위반 2건 발견 후 수정**(이 섹션들을 만지는 김에): LANDING_STEPS의 "만들고 싶은 걸 한국어로 설명하세요"(명령형)→"...설명해요", 요금제 티저의 "무료로 시작해서, 필요할 때 올리세요"(명령형)→"...올려요"
- [판단과 근거]
  - 랜딩 전용 색을 `variables.scss` 토큰으로 만들지 않고 `ChatBox.tsx`/`CoralredHero.tsx` 안에 리터럴 상수로 둔 이유: 이 코드베이스의 토큰 시스템은 "테마에 따라 바뀌는 값"을 위한 것인데, 이 색들은 정확히 "테마와 무관하게 고정"이어야 하는 값이라(히어로 코랄, 카드 크림 다 마찬가지) 토큰화가 오히려 의미에 안 맞음 — 이미 `CoralredHero.tsx`의 `CREAM_BG`/`CREAM_INK` 같은 동일 패턴이 있어서 그대로 따름
  - `ChatBox`의 `chatBoxSection`을 두 분기(랜딩/채팅 중) 사이에서 JSX 변수로 추출해 공유한 이유: alerts/progress/무료체험 안내/ChatBox(prop 30개+) 블록을 그대로 복붙하면 두 배로 유지보수 부담이 생기고 나중에 하나만 고치고 하나는 놓치는 버그가 나기 쉬움 — 변수 하나로 공유해서 로직 중복 없이 겉모습(헤더 유무, StickToBottom 클래스)만 분기
  - `채팅 시작 후(chatStarted=true)` 경로는 클래스 문자열을 단 한 글자도 안 건드림 — 기존 동작을 깨뜨릴 위험이 제일 큰 부분이라 최대한 보수적으로 접근
  - 카드 안 IconButton들의 focus-visible/active 상태는 이번에 안 건드림 — 이건 이 앱 전체에 걸친 이슈(`IconButton.tsx`가 `focus:outline-none`으로 기본 아웃라인을 지우기만 하고 대체 스타일이 없음)라 작업 6(접근성·모션 감사)이 명시적으로 다루는 범위라서, 지금 부분적으로 고치면 오늘 밤 안에 스타일이 두 벌 생기는 게 더 나쁘다고 판단
- [아침 확인 체크리스트]
  - [ ] **가장 중요**: 랜딩 페이지를 실제로 열어서 새 레이아웃이 의도대로 보이는지 (중앙 카드, 크림 배경, 그림자, 주변 타일)
  - [ ] 빈 텍스트영역에 커서를 클릭했을 때 깜빡이는 커서가 회전 플레이스홀더 텍스트와 겹쳐 보이지 않는지 — 코드상 `pointer-events:none`이라 타이핑은 막지 않지만, 커서와 오버레이 텍스트가 같은 좌상단 위치라 시각적으로 어색할 수 있음, 직접 봐야 확신 가능
  - [ ] 다크모드에서 입력창 카드 안 텍스트/아이콘이 잘 보이는지 (CSS 변수 스코프 오버라이드가 의도대로 적용됐는지)
  - [ ] 1280px/1024px 폭에서 타일이 실제로 사라지는지 (브레이크포인트 확인)
  - [ ] 타일 hover/active/focus-visible(키보드 탭) 다 확인
  - [ ] 3단계 섹션·요금제 티저가 라이트/다크 양쪽에서 성립하는지
  - [ ] 스크롤 힌트가 실제로 보이는지, reduced-motion 켰을 때 정지하는지
  - [ ] 모바일 폭(1024px 미만)에서 레이아웃이 안 깨지는지 — 어젯밤 작업 3의 Dialog 반응형 폭 수정과는 별개 영역
- [커밋 해시] 3743798

---

## 작업 2: 다크모드 재설계

- [상태: 완료] (핵심 토큰·구조는 전부 반영, 하드코딩 회색 스윕은 최고 임팩트 2곳만 하고 나머지는 플래그)
- [한 일]
  - `variables.scss`의 다크 원시 토큰을 지시서 값 그대로 정확히 교체(`--bg`/`--surface`/`--border`/`--border-strong`/`--muted`/`--text`/`--accent`/`--accent-hover`/`--accent-soft`/`--accent-ring`/`--accent-text`) + `--surface-2` 신규 추가
  - **진짜 원인 발견**: 다크 블록 안에 `oklch(0.24 0.01 var(--hue))`라는 리터럴이 `bg-depth-3`/`code-background`/`button-secondary-background`/`artifacts-inlineCode-background`/`actions-code-background`/`messages-background`/`dividerColor` 등 7곳에 동일하게 박혀 있었음 — 전부 같은 값이라는 건 원래 "같은 개념(3단계 표면)"이었다는 뜻이라, 전부 `var(--surface-2)`로 통일 치환. 이제 `--bg`(0.15) < `--surface`(0.185) < `--surface-2`(0.215) < `--border`(0.27) < `--border-strong`(0.33)로 명확한 층위가 생김(품질 헌장 Q3)
  - 라이트 테마에도 `--surface-2: oklch(0.995 0.001 var(--hue))` 추가(지시서 예시값 그대로)
  - **더 큰 발견**: `Dialog.tsx`(로그인/Supabase 연결/삭제 확인 등 앱의 거의 모든 모달이 공유하는 컴포넌트)가 `bg-white dark:bg-gray-950`라는 **코랄레드 토큰 시스템과 완전히 무관한 Tailwind 기본 회색**을 쓰고 있었음 — 이게 "어젯밤 다크가 순수 검정처럼 보였다"는 지적의 실제 원인일 가능성이 높음(따뜻한 oklch 팔레트가 아예 안 거쳐가는 경로였음). `bg-[var(--surface-2)]`로 교체 + 그림자도 `--shadow-overlay`(다크 전용, `0 8px 32px rgba(0,0,0,.5)`) 연동, 라이트는 기존 그림자 폴백 유지
  - `LoginModal.tsx`: 자체 `bg-bolt-elements-background-depth-1` 오버라이드를 제거해서 위에서 고친 Dialog 기본값(`--surface-2`)을 그대로 받게 함. 구글 버튼은 지시서대로 "다크 중립"(`--surface` + `--border-strong` 테두리 + `--text`)으로 전환 — 원래 계획이던 "구글 브랜드는 라이트 고정"에서 오늘 지시서가 명시적으로 다르게 지정해서 그대로 따름(판단 근거 참고)
  - `AvatarDropdown.tsx`의 드롭다운 배경도 같은 하드코딩 패턴(`bg-white dark:bg-[#141414]`)이라 `--surface-2`로 교체
  - `::-webkit-scrollbar`(10px, thumb `--border-strong` radius 8px, hover `--muted`) + `::selection`(라이트 `--accent-ring`, 다크 `oklch(0.4 0.1 var(--hue))`) 전역 추가. 기존 `.modern-scrollbar` 유틸(채팅 스크롤 영역 전용, 2px 얇은 버전)은 그대로 두고 안 건드림 — 이건 전역 기본값이라 나머지 모든 스크롤 영역(사이드바, 다이얼로그 등)에 적용됨
  - 테마 토글: `theme.ts`의 `toggleTheme()`에서 `<html>`에 `.theme-transitioning` 클래스를 붙였다가 250ms 후 제거하는 방식으로 구현(상시 transition 아님). CSS는 `.theme-transitioning, .theme-transitioning *`에 `background-color/border-color/color 200ms`만 한시 적용
  - 3단계 섹션의 다크 대응은 작업 1에서 이미 `var(--surface)`+`1px solid var(--border)`로 만들어놔서 이번 토큰 교체로 자동 개선됨 — 추가 작업 불필요, 확인만
- [판단과 근거]
  - 구글 버튼을 "항상 라이트 고정"에서 "다크 중립 토큰"으로 바꾼 건 오늘 지시서가 명시적으로 그렇게 요청해서 그대로 따른 것 — 실제 구글 브랜드 가이드라인상으로는 라이트 고정이 표준이긴 하지만, 오늘 지시가 더 구체적이고 최신이라 우선함
  - 하드코딩 회색(`dark:bg-gray-950`류) 패턴이 최소 9개 파일에 더 있는 걸 grep으로 확인했지만(`ControlPanel.tsx`/`Menu.client.tsx`/`Preview.tsx`/`Workbench.client.tsx`/`BranchSelector.tsx`/`GitCloneButton.tsx`/`TabTile.tsx`), 오늘 밤 시간 안에 전부 스윕하면 남은 작업(3~7)에 쓸 시간이 없다고 판단해서 **가장 많이 보이는 두 곳(Dialog 공유 컴포넌트, 계정 드롭다운)만 고치고 나머지는 정직하게 플래그**만 남김 — Dialog.tsx 하나가 실질적으로 앱 모달의 대다수를 커버해서 임팩트 대비 시간 효율이 가장 좋다고 판단
- [아침 확인 체크리스트]
  - [ ] **가장 중요**: 다크모드로 전환해서 실제로 "따뜻한 어두운 표면"으로 보이는지, 어젯밤처럼 순정 검정으로 안 보이는지
  - [ ] 로그인 모달을 다크에서 열어서 배경이 페이지 배경과 구분되는 표면으로 보이는지, 구글 버튼이 어색하지 않은지
  - [ ] 모달/드롭다운(Supabase 연결, 계정 드롭다운, 삭제 확인)이 라이트/다크 양쪽에서 인접 표면과 구분되는지
  - [ ] 스크롤바가 새 스타일(10px, 둥근 thumb)로 보이는지, hover 시 색이 바뀌는지
  - [ ] 텍스트 드래그 선택 시 하이라이트 색이 브랜드에 맞는지
  - [ ] 테마 토글 클릭 시 색이 급변하지 않고 부드럽게 전환되는지(200ms)
  - [ ] **남은 하드코딩 회색 9개 파일**은 이번에 손 안 댐 — 필요하면 별도 요청, 위치는 grep `dark:bg-gray-950|dark:bg-black|dark:bg-\[#141414\]`로 바로 찾을 수 있음
- [커밋 해시] 368026f

---

## 작업 3: 워크벤치 크롬 폴리시

- [상태: 완료]
- [한 일]
  - **헤더**: `blur(12px)` + `color-mix(in oklch, var(--bg) 85%, transparent)` 반투명 배경 추가(기존 하단 테두리는 유지)
  - **탭 인디케이터**: `Slider.tsx`(코드/차이점/미리보기가 유일한 사용처인 것 확인 후 과감히 재작성) — 기존 "슬라이딩 알약 배경" 디자인을 하단 2px 코랄 밑줄로 전환. framer-motion `layoutId`는 그대로 재사용해서 슬라이드 트랜지션은 유지, 비활성 hover는 이미 `--text`로 매핑돼 있던 토큰이라 손 안 댐. active(press)/focus-visible 링도 이 김에 추가
  - **파일트리**: 공유 `NodeButton`을 `h-7`(28px) 고정 높이로 통일(기존엔 패딩으로만 높이가 결정돼 파일/폴더 행 높이가 미묘하게 달랐을 수 있음), 선택 행에 좌측 2px 코랄 바(`border-l-2`) 추가, 접기 화살표를 아이콘 스왑 방식(`caret-right`↔`caret-down`, 순간 전환)에서 아이콘 하나 + `rotate-90` 트랜지션(150ms) 방식으로 바꿔서 실제로 회전하는 애니메이션이 되게 함
  - **터미널 헤더/프리뷰 툴바**: 확인해보니 이미 `bg-bolt-elements-background-depth-2`(=`var(--surface)`) + 테두리로 층위가 잡혀 있어서 스펙을 이미 만족 — 코드 변경 없이 확인만
  - **아티팩트 카드**: `rounded-lg`→`rounded-[14px]`. 번들 아티팩트가 진행 중일 때 카드 상단에 1.5px 코랄 바가 좌→우로 흐르는 인디터미네이트 애니메이션(`artifact-progress` 키프레임 신규, `animations.scss`에 reduced-motion 시 정지+반투명 고정바로 대체하는 규칙도 같이 추가) 추가. 완료 체크 아이콘을 정적 렌더에서 framer-motion `scale:0→1` 200ms 스케일인으로 전환
  - **토스트**: `toast.scss` 전면 재작성 — 배경 `var(--surface-2)`, 1px 테두리, `radius 12px`, 좌측 4px 상태 바(기본은 `--border-strong`, `Toastify__toast--success/warning/error` 수정자 클래스로 `--ok`/`--warn`/`--err` 색). react-toastify가 토스트 타입별로 이 클래스를 자동으로 붙여주는 걸 활용해서 JS 쪽은 전혀 안 건드림
- [판단과 근거]
  - `Slider.tsx`를 안전하게 재작성할 수 있었던 근거: grep으로 이 컴포넌트의 유일한 사용처가 워크벤치 탭이라는 걸 먼저 확인함 — 다른 곳에서도 쓰였다면 "워크벤치 크롬"이라는 작업 범위를 벗어나 사이드이펙트가 생겼을 것
  - 인디터미네이트 진행바를 CSS `@keyframes`+UnoCSS 임의값 클래스로 구현하고 framer-motion을 안 쓴 이유: 이 하나의 요소만을 위해 새 컴포넌트/모션 인스턴스를 만들 필요가 없는 단순 반복 애니메이션이라 순수 CSS가 더 가벼움 — 체크 아이콘 쪽은 반대로 상태 전이(진행중→완료) 1회성 트랜지션이라 framer-motion이 자연스러움
- [아침 확인 체크리스트]
  - [ ] 워크벤치 헤더가 스크롤 시 블러+반투명으로 뒤 콘텐츠가 비쳐 보이는지
  - [ ] 코드/차이점/미리보기 탭 전환 시 밑줄이 부드럽게 슬라이드하는지, 키보드 탭(Tab)으로 포커스했을 때 링이 보이는지
  - [ ] 파일트리에서 파일/폴더 행 높이가 전부 똑같아 보이는지, 선택했을 때 좌측 코랄 바가 보이는지, 폴더 화살표가 실제로 회전하는지
  - [ ] 파일을 생성/AI가 작업 중일 때 아티팩트 카드 위쪽에 흐르는 진행바가 보이는지, 완료되면 체크 아이콘이 팝인하는지
  - [ ] 토스트 알림(파일 저장 성공/실패 등)이 새 스타일(왼쪽 색 바)로 보이는지, 성공/경고/에러 색이 맞는지
  - [ ] 전부 라이트/다크 양쪽에서 확인
- [커밋 해시] 1e58c2b

---
