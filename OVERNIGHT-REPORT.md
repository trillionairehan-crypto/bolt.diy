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

- [상태: 진행 예정]

---

## 작업 4: 설정 탭 정리

- [상태: 진행 예정]

---

## 작업 5: 포트원 서버 검증 준비

- [상태: 진행 예정]

---

## 작업 6: 개선 화이트리스트

- [상태: 진행 예정]

---

## 최종 요약

(작업 완료 후 채움)
