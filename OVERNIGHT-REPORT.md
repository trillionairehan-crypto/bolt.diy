# 야간 자율 루프 리포트

브랜치: `overnight-20260824` (main에서 분기, main에 머지하지 않음)
시작: 2026-08-24

## 작업 0: 준비

- [상태: 완료]
- git status 확인: `app/routes/pricing.tsx`만 미커밋 (PortOne 결제 코드, 손대지 않음)
- `overnight-20260824` 브랜치 생성 (main 기준)
- `.gitignore`의 블랜킷 `*.md` 규칙이 이 리포트 파일도 침묵 무시할 뻔해서 `!/OVERNIGHT-REPORT.md` 예외 추가 (design-handoff 때와 동일한 버그 패턴)
- dev 서버 기동 확인 진행 중

---

## 작업 1: 로그인 재설계

- [상태: 완료]
- [한 일]
  - `LoginModal.tsx`를 스펙대로 재작성: 중앙 카드(max-w-400px, rounded-2xl=16px, `bg-bolt-elements-background-depth-1`), 상단 `Logo` 컴포넌트(32px, 심볼+워드마크 기존 컴포넌트 그대로 재사용) + "시작해볼까요?" + "3초면 충분해요", 버튼 순서 카카오→구글→구분선"또는"→이메일
  - 카카오 버튼: `#FEE500`/`#191919` 고정(브랜드 컬러라 라이트/다크 무관하게 고정이 맞는 선택). 구글 버튼: 흰 배경+회색 1px 테두리 고정(구글 로그인 버튼 브랜드 가이드라인상 테마 무관 고정이 표준) — 이메일 버튼과 구분선만 `bolt-elements-*` 토큰으로 라이트/다크 대응
  - 카카오/구글 아이콘: 코드베이스에 이미 있던 관례(`SupabaseConnection.tsx`가 `cdn.simpleicons.org` 사용) 그대로 재사용. 구글은 simple-icons에 실제 4색 G 로고가 없어서 단색(`#4285F4`)으로 처리 — 아침 체크리스트에 기록
  - 호출부 전부 교체: 헤더/사이드바는 이미 `LoginModal` 사용 중이었음(확인만). `CoralredHero.tsx` 타일 5번(그리고 같은 `openAccount` 함수를 쓰는 타일 3번도 자동으로 같이)이 `EmailOtpModal`을 직접 열던 걸 `LoginModal`로 교체 — 카카오/구글 선택 없이 바로 이메일 OTP로 가던 버그였음. `AvatarDropdown.tsx`(설정 드롭다운, 구 bolt.diy 계정 메뉴)도 구글/카카오/이메일 개별 인라인 항목 3개를 "로그인" 항목 1개 + `LoginModal`로 통합
  - 인증 로직(`signInWithGoogle`/`signInWithKakao`/`sendEmailOtp`/`verifyEmailOtp`)은 함수 시그니처·본문 전혀 안 건드림, import 경로/호출 위치만 변경
  - voice.md 위반 발견: `EmailOtpModal.tsx`의 에러 문구 2개가 "-습니다" 격식체였음(원칙 1 위반) → 해요체로 수정. 로직은 그대로, 문자열만
- [판단과 근거]
  - Google 로고를 단색으로 처리한 건 "가장 보수적인 선택" 원칙 적용 — 실제 4색 G 로고는 별도 SVG 에셋을 새로 만들어야 하는데, 스펙에 에셋 제작 지시가 없어서 임의로 새 에셋 파이프라인을 만들지 않음
  - `DialogTitle`에 `!` 접두사(important) 유틸리티로 오버라이드한 건 이 세션에서 이미 확립된 관례(IconButton 색상 오버라이드 때 동일 패턴 사용)를 그대로 따름
- [아침 확인 체크리스트]
  - [ ] 랜딩 헤더 "로그인" 버튼 → 카드 모달 레이아웃/순서 확인
  - [ ] 히어로 타일 5번("로그인") 클릭 → 이제 3버튼 모달이 뜨는지 (전엔 바로 이메일 OTP였음)
  - [ ] 사이드바 로그인 → 동일 모달
  - [ ] 설정(우상단 아바타) 드롭다운 → 로그인 안 된 상태에서 "로그인" 항목 1개만 보이는지, 클릭 시 모달 정상 동작
  - [ ] 다크모드에서 카드 배경/텍스트 대비 확인
  - [ ] 구글 로고가 단색이라 어색하면 추후 실제 4색 SVG로 교체 검토
  - [ ] 카카오/구글 로그인 실제 리다이렉트까지 완주 테스트 (로직 안 건드렸지만 실제 OAuth 콜솔 설정은 브라우저에서만 확인 가능)
- [커밋 해시] e36a579

---

## 작업 2: 다크모드 완성

- [상태: 완료]
- [한 일]
  - 조사해보니 대부분 이미 돼 있었음: `prefers-color-scheme` 감지 + localStorage 우선 + FOUC 방지 인라인 스크립트는 `root.tsx`에 이미 존재(`setTutorialKitTheme()`), `themeStore.ts`의 `initStore()`가 그 결과(`data-theme` 속성)를 그대로 초기값으로 읽어옴 — 코드 추가 없이 스펙 충족 확인
  - CodeMirror(`EditorPanel.tsx` → `theme` prop → `CodeMirrorEditor.tsx`의 `reconfigureTheme`)와 xterm(`Terminal.tsx`의 `getTerminalTheme()`가 `--bolt-elements-terminal-*` CSS 변수를 라이브로 읽음) 둘 다 이미 테마 전환에 연동돼 있음 — 확인만, 수정 없음
  - 실제로 빠져 있던 것: 테마 토글 **버튼**이 사이드바 푸터에만 있고 헤더엔 전혀 없었음 → `Header.tsx`에 `ThemeSwitch` 추가: 랜딩(요금제 링크 옆, 코랄 배경용 `!text-[#FAF7F0]` 오버라이드) + 작업공간(`HeaderActionButtons` 옆)
  - `ThemeSwitch.tsx`의 `title="Toggle Theme"`(영어, voice.md 위반) → "밝은/어두운 화면으로" 해요체로 수정
  - `variables.scss`의 `:root[data-theme='light']`/`[data-theme='dark']` 블록에 `color-scheme` 선언 추가(네이티브 스크롤바/폼 컨트롤 다크 대응) — 빌드 결과물 CSS에 반영된 것까지 확인
  - `/pricing`은 이미 `design-handoff/coralred-ui.css`를 정식 스타일시트로 로드 중이고, 그 파일 자체가 `[data-theme="dark"]`에 `color-scheme: dark`까지 포함해 이미 다크 대응 완비 — `pricing.tsx`가 인라인 색상 없이 킷 클래스만 쓰는 것도 확인(`var(--` 4회, 하드코딩 hex 0회). 테마는 `<html>` 전역 속성이라 다른 페이지에서 토글해도 `/pricing` 이동 시 유지됨 — 코드 추가 불필요, 확인만
  - 히어로 코랄 고정: `BaseChat.tsx`의 히어로 배경이 `style={{ background: '#FF5330' }}` 리터럴이라 테마와 무관 — 확인만
  - `Preview.tsx`의 "New Window Options" 드롭다운은 `bolt-elements-*` 토큰 대신 `dark:` 접두사+하드코딩 hex 조합을 쓰고 있었는데, `uno.config.ts`가 `dark:`를 `[data-theme="dark"]`에 매핑해뒀는지 확인한 결과 실제로는 정상 작동함 — 토큰 일관성은 떨어지지만 기능은 이상 없어서 스코프 밖으로 두고 손 안 댐(과잉 리팩터링 방지)
- [판단과 근거]
  - 이미 동작하는 CodeMirror/xterm/프리뷰 드롭다운 다크 로직을 굳이 토큰 스타일로 재작성하지 않은 건 "필요 이상으로 건드리지 않는다" 원칙 — 기능이 이미 맞으면 스타일 일관성은 후순위
- [아침 확인 체크리스트]
  - [ ] 랜딩 헤더/작업공간 헤더 양쪽에서 해/달 아이콘 토글 클릭 → 실제 라이트/다크 전환되는지, 아이콘이 코랄 배경 위에서도 잘 보이는지
  - [ ] 다크 상태에서 새로고침 시 FOUC(잠깐 흰 화면 깜빡임) 없는지
  - [ ] 시크릿/프라이빗 창(로컬스토리지 없음)에서 처음 열었을 때 OS 다크모드 설정을 따라가는지
  - [ ] 코드 에디터/터미널이 다크 전환 시 실제로 색이 바뀌는지 (작업공간 진입해서 확인)
  - [ ] `/pricing` 페이지를 다크 상태로 이동해서 킷 스타일이 깨지지 않는지
  - [ ] 네이티브 스크롤바/입력창 다크 렌더링 확인(브라우저별로 다를 수 있음)
- [커밋 해시] 8a282a0

---

## 작업 3: 모바일 코드 감사

- [상태: 부분완료] (브라우저/실기기 확인 불가라 코드 레벨에서 고칠 수 있는 것만 고침)
- [한 일]
  - **실제로 고친 것**: `Dialog.tsx` 기반 클래스가 `w-[520px]` 고정폭이었음 — 375px 폰 화면에서 145px만큼 뷰포트를 벗어나는 확정적 버그. 이 컴포넌트를 쓰는 다이얼로그가 30개 파일에 걸쳐 있어서 개별 수정 대신 **원점에서 수정**: `w-[min(520px,calc(100vw-2rem))]` + `max-h-[calc(100vh-4rem)] overflow-y-auto`로 교체 → 모든 다이얼로그가 자동으로 반응형이 됨. 빌드 결과물에 정확히 반영된 것 확인(`build/client/assets/root-*.css`에서 `width:min(520px,calc(100vw - 2rem))` 확인)
  - 입력창 하단 바(`ChatBox.tsx`)가 `flex`(wrap 없음)로 좌측 3개 라벨 버튼(이미지/사이트/음성) + 우측(Shift+Return 힌트/저장 기능 버튼/전송 버튼)을 한 줄에 다 넣고 있어서, 320-375px 폭 폰에서 산술상 겹치거나 넘칠 가능성이 높다고 판단 → `sm:`(640px) 미만에서 라벨 텍스트만 숨기고 아이콘만 남기는 방식으로 폭을 줄임(기능 제거 아님, `title` 툴팁은 유지). "이미지"/"사이트"/"음성"/"대화" 라벨 + Shift+Return 힌트 전체를 `hidden sm:inline`류로 처리
  - `html, body`에 `overflow-x: hidden` 전역 안전장치 추가 — 어딘가 다른 요소가 미처 못 잡은 폭 초과를 일으켜도 페이지 전체가 가로 스크롤되는 최악의 상황은 방지
  - viewport meta(`width=device-width, initial-scale=1`)는 `root.tsx`에 이미 있음 — 확인만
  - 히어로 타일 컨테이너(`CoralredHero.module.scss`)는 이미 `width: min(480px, 88vw)` + `clamp()` 폰트로 완전 반응형이었고, 88vw 기준으로 계산해보면 가장 작은 타일도 320px 폭에서 ~52px로 44px 터치 타깃 기준을 통과 — 확인만, 수정 없음
  - 1024px(`lg:`) 미만 히어로 좌우 그리드는 이미 Tailwind `lg:grid`로만 적용돼 있어서 그 밑에서는 자동으로 세로 스택 — 확인만
- [판단과 근거]
  - `Workbench.client.tsx`의 `motion.div`(workbenchVariants)가 `width: var(--workbench-width)`를 인라인으로 설정하는데, `--workbench-width: min(calc(100% - 533px), 2536px)`라 375px 화면에서는 이론상 음수가 나옴. 하지만 실제로 보이는 패널은 그 안의 `position: fixed` + `isSmallViewport` 조건부(`w-full`/`left-0`)로 이미 별도 처리된 내부 div라서, 바깥 motion.div의 폭이 실제 렌더링에 영향을 주는지 SCSS 스코프(`:root` 전역 변수 vs `.Chat` 로컬 오버라이드)까지 다 추적하지 않고는 확신할 수 없었음 → 잘못 추측해서 오히려 데스크톱을 깨뜨릴 위험이 있다고 판단해 **손대지 않고 체크리스트로 넘김** (추측 금지 원칙)
  - 버튼 터치 타깃(현재 h-8=32px, 권장 44px)은 코드만 봐서는 "얼마나 답답해 보이는지" 판단이 안 되고, 입력창 전체 레이아웃 균형(전송 버튼 등과의 비례)에 영향을 줄 수 있어서 임의로 높이를 키우지 않고 체크리스트로 넘김
- [아침 확인 체크리스트]
  - [ ] **실기기(또는 크롬 개발자도구 모바일 에뮬레이션)로 확인 필수**: 모든 다이얼로그(로그인, Supabase 연결, 삭제 확인 등)가 375px 폭에서 화면 안에 들어오는지
  - [ ] 입력창 하단 바가 320-375px 폭에서 겹치거나 넘치지 않는지(라벨 숨김으로 완화했지만 실측 필요)
  - [ ] 워크벤치를 모바일 폭에서 열었을 때 정상적으로 전체 화면으로 뜨는지 — 위에서 설명한 이유로 코드 레벨에서 확신 못 함, 반드시 확인
  - [ ] 버튼 터치 타깃이 실제 손가락으로 누르기 답답한지(현재 32px) — 답답하면 `h-8`→`h-10`(40px) 또는 `h-11`(44px) 조정 요청
  - [ ] 키보드가 열렸을 때 입력창/전송 버튼이 키보드에 가려지지 않는지(iOS Safari 특히)
  - [ ] 가로모드(landscape)에서 다이얼로그 `max-h-[calc(100vh-4rem)]` 스크롤이 자연스러운지
- [커밋 해시] ed6da08

---

## 작업 4: 설정 탭 정리

- [상태: 부분완료] (숨김 처리와 핵심 문구 스윕은 완료, 남긴 탭들의 내부 콘텐츠 전수 스윕은 시간상 못 함)
- [한 일]
  - 전체 탭 목록 확인(`constants.tsx`의 `DEFAULT_TAB_CONFIG`): profile, settings, notifications, features, data, cloud-providers, local-providers, github, gitlab, netlify, vercel, supabase, event-logs, mcp — 14개
  - `ControlPanel.tsx`의 `visibleTabs` 필터에 `DEV_ONLY_TAB_IDS` 기반 조건 추가 (github/gitlab/netlify/vercel/mcp/event-logs/local-providers/cloud-providers → `SHOW_DEV_TOOLS`가 `false`일 때 숨김). **탭 정의(`DEFAULT_TAB_CONFIG`)가 아니라 렌더링 단계에서 필터링**한 게 핵심 판단 — `DEFAULT_TAB_CONFIG.visible`만 바꾸면 이미 설정을 한 번이라도 연 사용자는 localStorage(`bolt_tab_configuration`)에 저장된 예전 값(전부 `visible:true`)이 우선 적용돼서 안 숨겨짐. 렌더링 시점 필터라 기존 사용자 localStorage 상태와 무관하게 항상 적용되고, 플래그 하나만 뒤집으면 즉시 복구됨(탭 컴포넌트 자체는 import도 그대로 살아있어서 삭제 아님)
  - 남긴 탭(profile/settings/notifications/features/data/supabase)의 `TAB_LABELS`/`TAB_DESCRIPTIONS`를 voice.md 원칙대로 한국어로: "프로필/설정/알림/새 기능/데이터/저장 기능" + 명령형 아닌 서술형 한 줄 설명. `ControlPanel.tsx`의 다이얼로그 제목("Control Panel"→"설정", "Tab Management"→"탭 관리")과 탭 타일 상태 배지(새 기능 개수/안 읽은 알림 개수/연결 문제 메시지)도 같이 스윕
  - 숨긴 탭들의 `TAB_LABELS`/`TAB_DESCRIPTIONS`는 일부러 영어 그대로 둠 — 화면에 안 보이는 데다, 굳이 깊은 개발자 전문용어를 번역하는 데 시간을 쓰는 것보다 남은 작업(5, 6번)에 시간을 쓰는 게 낫다고 판단
- [판단과 근거] (표)

  | 탭 | 처리 | 이유 |
  |---|---|---|
  | github/gitlab/netlify/vercel | 숨김 | 코드 배포·연동 대상이 비개발자 타겟엔 불필요, 지난 세션에도 "개발자용 연동 탭이라 단순화하면 오히려 역효과"로 이미 스코프 제외됐던 것과 같은 판단 |
  | mcp | 숨김 | Model Context Protocol 서버 설정은 명백히 고급/개발자 기능 |
  | event-logs | 숨김 | 디버그 로그 뷰어, 일반 사용자가 쓸 일 없음 |
  | local-providers | 숨김 | 로컬 LLM(Ollama 등) 연결 — 비개발자가 로컬 서버를 띄울 일 없음 |
  | cloud-providers | 숨김 | 자체 API 키 입력 UI — 이 제품은 호스팅형이라 서버가 모델을 대신 처리하고 있고(`Model Settings` 버튼도 이미 `SHOW_DEV_TOOLS` 뒤에 있음), 같은 맥락으로 판단 |
  | profile/settings/notifications | 유지 | 계정/환경설정/알림은 일반 사용자에게 필요한 기본 설정 |
  | features | 유지 | 새 기능 안내는 마케팅성으로 유지할 가치 있음 |
  | data | 유지 | 자기 데이터/저장 공간 관리는 일반 사용자도 필요 |
  | supabase | 유지 | "저장 기능 켜기"는 입력창에서부터 이미 전면 노출되는 핵심 기능이라 설정에서도 접근 가능해야 함 |
- [아침 확인 체크리스트]
  - [ ] 설정 다이얼로그를 열어서 8개 탭(GitHub/GitLab/Netlify/Vercel/MCP/Event Logs/Local Providers/Cloud Providers)이 실제로 안 보이는지
  - [ ] 남은 6개 탭(프로필/설정/알림/새 기능/데이터/저장 기능) 라벨이 한국어로 잘 보이는지
  - [ ] "저장 기능" 탭을 열어 Supabase 연결 플로우가 정상 작동하는지(로직은 안 건드렸지만 확인 필요)
  - [ ] 숨긴 탭이 정말 필요할 때(디버깅 등) `SHOW_DEV_TOOLS`를 `true`로 바꾸면 8개 다 돌아오는지 — 코드는 확인했지만 실제 토글은 아침에
  - [ ] 남긴 탭들의 내부 콘텐츠(폼 라벨, 버튼 등)는 이번에 손 안 댐 — 필요하면 별도 작업으로 요청
- [커밋 해시] 96dd2da

---

## 작업 5: 포트원 서버 검증 준비

- [상태: 완료] (pricing.tsx는 전혀 안 건드림 — 읽기만 함)
- [한 일]
  - `pricing.tsx`를 읽어서 이미 남겨져 있던 TODO 주석(결제 버튼 핸들러 바로 위)에서 정확한 스펙을 그대로 가져옴: `PORTONE_API_SECRET`로 `GET /payments/{paymentId}` 단건조회 → status/금액/통화 재검증. env var 이름도 `worker-configuration.d.ts`에 이미 선언돼 있던 걸 그대로 씀(새로 발명 안 함)
  - `app/routes/api.payment.verify.ts` 신설: `POST`로 `{paymentId, expectedAmount, expectedCurrency}` 받아서 PortOne V2 API(`https://api.portone.io/payments/{id}`, `Authorization: PortOne {secret}`)로 단건조회 → `status === 'PAID'` && 금액 일치 && 통화 일치일 때만 `verified: true` 반환. 기존 `api.supabase.query.ts`의 라우트 구조(action, 에러 응답 형식) 그대로 재사용
  - `app/routes/api.payment.webhook.ts` 신설: PortOne V2가 Svix 방식(`webhook-id`/`webhook-timestamp`/`webhook-signature` 헤더)으로 웹훅에 서명한다는 것까지만 반영한 뼈대. 서명 검증 로직 자체는 TODO로 남김(지시서에 "실연동은 아침 이후"라고 명시돼 있어서 그대로 따름) — 현재는 시크릿이 없으면 로그만 남기고 200 반환, 있어도 검증 없이 로그만
  - `worker-configuration.d.ts`에 `PORTONE_WEBHOOK_SECRET: string;` 타입 선언 추가(값은 안 건드림, 타입 파일이라 보호 대상 아님)
  - curl로 자체 테스트: `GET`은 405가 아니라 400이 나오는데, 이건 버그가 아니라 Remix 리소스 라우트가 `loader`를 안 만들면 GET 자체를 프레임워크 레벨에서 400으로 막아버려서(`action`까지 아예 안 옴) — 기존 `api.supabase.query.ts`도 동일 패턴이라 이 코드베이스의 기존 관례와 일치. 빈 body → `missing_payment_id`(400) 정상. **`paymentId: "test-123"`로 실제 조회를 날려봤더니 `PORTONE_API_SECRET`이 이미 이 dev 환경에 설정돼 있어서 실제 PortOne API까지 갔고, 존재하지 않는 결제라 404가 그대로 반환됨 — 라우트가 진짜로 동작하는 것까지 확인** (시크릿 값 자체는 출력한 적 없음, 응답 상태코드만 관찰)
- [판단과 근거]
  - 서버 SDK(`@portone/server-sdk`)가 설치돼 있지 않아서, 새 패키지를 몰래 추가하는 대신 이미 이 코드베이스에 있는 관례(`api.supabase.query.ts`처럼 raw `fetch`)를 그대로 따름 — "스펙에 없는 결정은 보수적으로" 원칙
  - 웹훅 서명 검증을 실제로 구현하지 않은 것도 지시서 문구를 그대로 따른 것("실연동은 아침 이후") — 실제 시크릿 없이 검증 로직만 만들면 테스트도 못 하고 틀렸을 가능성이 높아서 정직하게 TODO로 남김
- [아침 확인 체크리스트]
  - [ ] pricing.tsx의 TODO 자리(157번째 줄 근처, `if (response && !response.code)`)에서 `/api/payment/verify`를 호출해 `response.paymentId`와 `plan.priceMonthly`를 넘기고, `verified === true`일 때만 플랜을 활성화하도록 3줄 정도만 추가하면 연결 끝
  - [ ] PortOne 콘솔에서 웹훅 URL을 `https://coralred.kr/api/payment/webhook`으로 등록하고, 콘솔에 뜨는 웹훅 시크릿을 Cloudflare Pages 환경변수에 `PORTONE_WEBHOOK_SECRET`으로 추가
  - [ ] 그 다음 `api.payment.webhook.ts`의 TODO 자리에 Svix 방식 서명 검증(HMAC-SHA256, `webhook-id.webhook-timestamp.rawBody`를 서명) 구현 — PortOne V2 공식 문서의 정확한 서명 페이로드 포맷을 실제로 대조해서 구현해야 함(코드만 보고 추측한 부분이라 문서 대조 필수)
  - [ ] `/api/payment/verify`가 실제 결제 성공 건에 대해 `verified: true`를 정확히 반환하는지 실제 테스트 결제로 확인
- [커밋 해시] 8265301

---

## 작업 6: 개선 화이트리스트

- [상태: 완료] (a~e 5개 항목 전부 완료, 항목별 상세는 아래)

### 6a. date-fns 한국어 로케일 — [완료]
- `date-binning.ts`에 `date-fns/locale`의 `ko` 적용. 요일(`EEE`→"토"), 월(`M월`→"3월"), 연+월(`yyyy년 M월`→"2023년 3월")로 자연스러운 한국어 순서/표기로 포맷 문자열 자체도 바꿈(그냥 로케일만 끼워넣으면 "1월 2023"처럼 어색해져서 순서 있는 포맷으로 재작성)
- Node로 격리 테스트해서 실제 출력값 확인(오늘/어제/지난 30일은 이미 한국어 리터럴이라 안 건드림)
- 커밋: 44849e3

### 6b. apple-touch-icon 재생성 + 구 에셋 삭제 — [완료]
- `public/apple-touch-icon.png`/`apple-touch-icon-precomposed.png`를 열어보니 **아직도 구 bolt.diy 로고**(검정 "bolt." + 보라 "diy" 워드마크)였음 — `favicon.svg`는 이미 코랄레드로 바뀌어 있었는데 터치 아이콘만 빠져 있었던 것
- `sharp`로 `public/logo/coralred-icon.svg`(코랄 배경+크림 심볼, 512×512, 앱 아이콘용으로 이미 준비돼 있던 에셋)를 180×180 PNG 두 개로 재생성 → 렌더링해서 눈으로 확인
- `grep`으로 전수 확인 후 참조 0건인 `logo-dark.png`/`logo-dark-styled.png`/`logo-light.png`/`logo-light-styled.png`/`social_preview_index.jpg`(지시서엔 `.png`로 적혀있었는데 실제 파일명은 `.jpg`) 5개 삭제. `og-image.png`는 열어보니 이미 코랄레드로 돼 있어서 손 안 댐
- 커밋: 84f8676

### 6c. SEO 기본기 — [완료]
- 라우트별 title/description은 `_index`/`pricing`/`privacy`/`terms`/`git` 전부 **이미 존재**했음(지난 세션에 이미 해둔 듯) — 새로 만들 필요 없이 확인만
- `public/robots.txt`(채팅 세션/`api`/`webcontainer`/`git` 경로는 비공개·기능성이라 `Disallow`, 나머지 `Allow`, sitemap 링크 포함), `public/sitemap.xml`(랜딩/요금제/약관/개인정보/가이드 5개 URL) 신설. curl로 200 확인
- 커밋: fd649b5

### 6d. /guide 라우트 — [완료]
- `pricing.tsx`와 똑같은 킷 스타일(`design-handoff/coralred-ui.css`, `cr-*` 클래스)로 `app/routes/guide.tsx` 신설. 개별 슬러그 라우트(`/guide/저장하기` 등) 대신 **한 페이지 안에 4개 섹션**으로 구성 — 지시서가 "라우트 하나"라고만 했지 URL을 4개로 나누라고는 안 했어서, 관리 부담이 적은 쪽으로 보수적으로 판단
- "내 앱 공개하기" 글을 쓰다가 실제 배포 버튼(`DeployButton.tsx`)을 확인했는데, **지금 배포 기능은 Netlify/Vercel/GitHub/GitLab 계정 연결이 필수**라 비개발자에게 진짜 "버튼 한 번에 공개"는 아직 안 됨 — 없는 기능을 있는 것처럼 쓰지 않고, 실제 버튼 이름("배포하기")과 실제 플로우(Netlify/Vercel 연결)를 정직하게 설명하는 쪽으로 씀. 이건 문구 문제가 아니라 제품 기능 자체의 갭이라 아래 "발견했지만 손 안 댄 이슈"에도 남김
- "메시지가 뭔가요"/"요금제 안내"는 `pricing.tsx`의 FAQ에 이미 있던, voice.md로 검증된 문장을 그대로 재사용해서 일관성 유지
- sitemap.xml에 `/guide` 추가
- **curl로 시각적 확인을 시도하다가 중요한 사실 발견**: 이 앱은 `root.tsx`의 `Layout`이 전체 `<Outlet/>`(모든 라우트)을 `<ClientOnly>`로 감싸고 있어서, **curl 같은 JS 미실행 도구로는 어떤 라우트든 본문 내용을 절대 볼 수 없음**(`<title>`/메타 태그만 SSR됨, `<div id="root">`는 초기 HTML엔 거의 비어있음). 그래서 오늘 밤 작업 전체에 걸쳐 curl로 한 "확인"은 전부 "라우트가 존재하고 200/404가 정상적으로 뜨는지"까지만 검증한 것이지, **화면이 실제로 의도대로 보이는지는 하나도 검증 못 한 것** — 이미 잘 동작한다고 알려진 `pricing.tsx`도 완전히 동일한 패턴(빈 root, title만 SSR)을 보여서 이게 `guide.tsx`만의 버그가 아니라 이 앱 전체의 구조라는 걸 별도 dev 서버(5174 포트, 완전히 새로 띄움, 원래 5173 서버는 안 건드림)로 교차 확인함. 이 사실은 오늘 밤 작업 전체(로그인 모달, 다크모드 토글, 모바일 레이아웃 등)에 다 해당되는 중요한 한계라 아래 체크리스트 전체의 우선순위를 이 사실 기준으로 다시 매김
- 커밋: 3c8f05b

### 6e. 404 페이지 — [완료]
- `root.tsx`의 `ErrorBoundary`(지난 작업에서 이미 만든 것)를 확장: `isRouteErrorResponse(error) && error.status === 404`일 때만 별도 UI로 분기 — 코랄 배경 + 크림 심볼 로고 + "이 페이지는 없어요" + "주소를 다시 확인해주세요" + "홈으로 가기" 링크. 나머지(진짜 크래시)는 기존 "화면에 문제가 생겼어요" + "다시 불러오기" 그대로
- 리로드 버튼을 404에도 그대로 뒀으면 어색했을 것(잘못된 주소는 새로고침해도 안 고쳐짐) — 그래서 404 전용 분기를 따로 판 것
- curl로 존재하지 않는 경로 요청 → 실제 HTTP 404 상태코드 확인(이건 상태코드라 curl로도 확실히 검증됨, 위 ClientOnly 문제와 무관)
- 커밋: 99b21c1

---

## 최종 요약

브랜치 `overnight-20260824`, main에 머지 안 함 — 아침에 리뷰 후 직접 머지 여부 결정.

### 작업별 상태

| 작업 | 상태 |
|---|---|
| 0. 준비 | 완료 |
| 1. 로그인 재설계 | 완료 |
| 2. 다크모드 완성 | 완료 (대부분 이미 돼 있었음, 토글 버튼만 실제로 빠져 있었음) |
| 3. 모바일 코드 감사 | 부분완료 (Dialog 반응형 폭 등 확정적 버그는 고침, 워크벤치 폭 계산은 추측 위험 있어 손 안 댐) |
| 4. 설정 탭 정리 | 부분완료 (숨김 처리·핵심 문구는 완료, 남긴 탭 내부 콘텐츠 전수 스윕은 시간상 스킵) |
| 5. 포트원 서버 검증 준비 | 완료 (실제 PortOne API까지 살아있는 것 확인, pricing.tsx는 안 건드림) |
| 6a. date-fns 한국어 로케일 | 완료 |
| 6b. 터치 아이콘 재생성 + 구 에셋 삭제 | 완료 |
| 6c. SEO 기본기 | 완료 |
| 6d. /guide 라우트 | 완료 |
| 6e. 404 페이지 | 완료 |

### 전체 커밋 목록 (main 기준 순서대로, 16개)

```
cee0cea 준비 — 브랜치/리포트/gitignore 예외
e36a579 로그인 재설계 — 카카오/구글/이메일 중앙 카드 모달로 통일
b4b5234 로그인 재설계 — 리포트 갱신
8a282a0 다크모드 완성 — 헤더 토글 추가, color-scheme CSS 대응
ccc2ce6 다크모드 완성 — 리포트 갱신
ed6da08 모바일 감사 — Dialog 반응형 폭, 입력창 라벨 반응형 숨김, 전역 overflow-x 방지
0328c35 모바일 감사 — 리포트 갱신
96dd2da 설정 탭 정리 — 개발자용 탭 SHOW_DEV_TOOLS 뒤로 숨김, 남는 탭 한국어 스윕
97506d4 설정 탭 정리 — 리포트 갱신
8265301 포트원 서버 검증 라우트 추가 — 결제 단건조회 + 웹훅 스켈레톤
ee7c424 포트원 서버 검증 — 리포트 갱신
44849e3 6a — 사이드바 날짜 표시 date-fns 한국어 로케일 적용
84f8676 6b — apple-touch-icon 코랄레드 브랜드로 재생성, 구 bolt.diy 에셋 삭제
fd649b5 6c — robots.txt/sitemap.xml 추가
3c8f05b 6d — /guide 라우트 추가 (가이드 4편)
99b21c1 6e — 404 페이지를 코랄레드 스타일로
```

### 아침 브라우저 확인 체크리스트 (우선순위순)

**중요**: 이 앱은 `root.tsx`가 전체 페이지를 `<ClientOnly>`로 감싸고 있어서 밤새 curl로 한 검증은 전부 "라우트가 존재하고 상태코드가 맞는지"까지만이고, **실제 화면이 의도대로 보이는지는 하나도 확인 못 했음**. 아래는 전부 실제 브라우저로 눈으로 봐야 하는 것들이고, 그 중에서도 위험도/변경폭이 큰 순서대로 정렬함.

1. **로그인 모달** (`/`, 헤더·사이드바·히어로 5번 타일·설정 아바타 드롭다운 4곳에서 열어보기) — 카카오/구글/이메일 순서, 카카오 노란색·구글 흰색 대비, 다크모드에서도 확인
2. **다크모드 토글** — 랜딩/작업공간 헤더 양쪽 해/달 아이콘, 실제 전환되는지, 코드 에디터·터미널도 같이 바뀌는지
3. **입력창 하단 바 (모바일 폭)** — 실기기 또는 크롬 개발자도구로 375px 폭에서 확인. 이미지/사이트/음성 라벨이 좁은 화면에서 숨겨지는지, 안 겹치는지
4. **다이얼로그들 (모바일 폭)** — 로그인/Supabase 연결/삭제 확인 등, 375px에서 화면 안에 들어오는지
5. **워크벤치를 모바일 폭에서 열기** — 코드 레벨에서 확신 못 한 부분(CSS 변수 체인이 복잡해서), 정말 전체 화면으로 뜨는지 반드시 확인
6. **설정 다이얼로그** — GitHub/GitLab/Netlify/Vercel/MCP/Event Logs/Local/Cloud Providers 8개 탭이 안 보이는지, 남은 6개는 한국어로 보이는지
7. **`/guide` 페이지** — 4개 섹션 다 보이는지, 특히 "내 앱 공개하기" 항목이 실제 배포 버튼 위치·이름과 맞는지
8. **404 페이지** — 존재하지 않는 주소로 들어가서 코랄 배경 페이지가 뜨는지
9. **터치 아이콘** — 실제 iOS/Android에서 홈 화면에 추가해보고 코랄레드 아이콘으로 보이는지 (또는 브라우저 탭에서 파비콘 확인)
10. **포트원 검증 라우트 연결** — `pricing.tsx`의 TODO 자리에 `/api/payment/verify` 호출 3줄 추가 (라우트 자체는 실제 PortOne API와 통신 확인됨)
11. **사이드바 날짜 표시** — 대화 목록에서 요일/월 표기가 한국어로 나오는지

### 발견했지만 손 안 댄 이슈

- **`pricing.tsx`의 "시작하세요"**: voice.md 원칙 1(명령형 금지)을 이미 위반하고 있는데, 이 파일은 이번 세션 내내 불가침이라 확인만 하고 안 고침. 사용자가 포트원 작업 커밋할 때 같이 손보면 좋을 것
- **배포(공개하기) 기능이 아직 개발자 중심**: `DeployButton.tsx`가 Netlify/Vercel/GitHub/GitLab 계정 연결을 요구함 — 비개발자가 정말 버튼 한 번에 공개하는 기능은 아직 없음. `/guide`에는 정직하게 현재 플로우로 썼지만, 이게 코랄레드의 타겟 사용자에게 맞는 기능인지는 별도 논의가 필요해 보임
- **`Workbench.client.tsx`의 모바일 폭 계산**: `--workbench-width: min(calc(100% - 533px), 2536px)`가 375px 화면에서 이론상 음수가 나오는데, 실제로 보이는 패널은 `isSmallViewport` 조건부 오버라이드가 이미 있어서 괜찮을 수도 있음 — SCSS 스코프 추적까지 완전히 확신 못 해서 코드 변경 없이 체크리스트로 넘김
- **입력창 버튼 터치 타깃(32px)**: 44px 권장 기준보다 작음. 라벨은 숨겼지만 버튼 자체 크기는 안 키움 — 실제로 답답한지는 손가락으로 눌러봐야 앎
- **설정 탭 내부 콘텐츠**: 남긴 6개 탭(프로필/설정/알림/새 기능/데이터/저장 기능) 자체 라벨/설명은 스윕했지만, 각 탭 안의 폼 라벨·버튼 등 내부 콘텐츠는 이번엔 손 안 댐
- **PortOne 웹훅 서명 검증**: 뼈대만 만들고 실제 Svix 서명 검증 로직은 TODO — PortOne 공식 문서 대조 없이 구현하면 틀릴 위험이 커서 정직하게 미룸
- **`Preview.tsx`의 "New Window Options" 드롭다운**: `bolt-elements-*` 토큰 대신 하드코딩 hex + `dark:` 접두사 조합이라 다른 곳과 스타일이 안 맞음 — 기능은 정상이라 안 건드림
