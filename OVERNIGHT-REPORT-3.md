# 야간 자율 루프 3차 리포트 — 기능 격차 해소 + 품질 플라이휠

브랜치: `overnight3-20260824` (버그픽스 반영된 `overnight2-20260824` HEAD에서 분기)
시작: 2026-08-24

## 작업 0: 준비

- [상태: 완료]
- `71ad6b2`(어제 버그 2 수정)에서 분기 확인 — `git log --oneline -5`로 두 버그픽스 커밋(`71ad6b2`, `7311cc1`)이 로그 최상단에 있는 것 확인
- `.gitignore`에 `!/OVERNIGHT-REPORT-3.md` 예외 추가
- **자체 검증**: `grep -c "isContainerVisible" Terminal.tsx` → 3건, `grep -c "showLabel={isLanding}" ChatBox.tsx` → 2건. 둘 다 브랜치에 정상 포함됨 확인
- dev 서버 확인: 200 OK

---

## PART A

### A1: 브라우저 자동번역 방어

- [상태: 완료] 커밋 `972c0e1`
- **진짜 원인 발견**: `app/entry.server.tsx`의 SSR HTML 셸 템플릿 리터럴이 `<html lang="en">`로 박혀 있었음 — 100% 한국어 제품인데 지금까지 쭉 `en`으로 서빙되고 있었다. `root.tsx`(React Head)만 봐서는 안 보이는, entry.server.tsx의 raw 문자열이라 이번에 처음 발견. `lang="ko"`로 수정.
  - 클라이언트에서 `document.documentElement.lang`을 건드리는 코드가 있는지 전수 grep — 없음 확인 (하이드레이션 불일치 위험 없음). `BaseChat.tsx`의 `recognition.lang = 'ko-KR'`은 Web Speech API용이라 무관.
- 플랜명("빛"/"장점" 오역, 어제 버그 3)의 실제 소스는 여전히 코드에 없음 — `pricing.tsx`는 수정 불가 대상이라, 근본 원인을 건드리지 않고 대응할 수 있는 유일한 방법으로 `root.tsx`에 `<meta name="google" content="notranslate">`(페이지 전체 차단)를 추가. 판단 근거: 이 제품은 애초에 한국어 프롬프트 입력이 필수라 비한국어 사용자가 번역해서 쓸 시나리오 자체가 없음 — 과함이 아니라 적절한 트레이드오프로 판단.
  - 구글 외 번역기 대비로 `Logo.tsx` 워드마크 span에 `translate="no"` 추가 (브랜드명 단일 최다 렌더 지점).
  - 플랜명이 `pricing.tsx` 외에 렌더되는 다른 지점이 있는지 전수 스윕 (`무료`/`라이트`/`프로`/`맥스` 전체 grep) — 전부 무관한 문맥(무료체험 안내 문구, "프로필" 등 다른 단어)이었고 실제 플랜명 배지 렌더는 pricing.tsx 하나뿐임을 확인. 즉 이 메타 태그가 유일하고 충분한 대응.
- **검증**: typecheck/lint/build 클린. 컴파일된 서버 번들(`build/server/assets/server-build-*.js`)을 직접 grep해서 `lang="ko"`와 `notranslate` meta 둘 다 실제로 번들에 들어갔음을 확인 (소스 레벨이 아니라 컴파일 산출물 레벨로 검증).
- **아침 확인 필요**: 브라우저에서 우클릭 "번역" 메뉴가 비활성화되는지, Chrome 자동번역 배너가 더 이상 안 뜨는지 실제 확인 필요 (SSR/클릭 이벤트라 서버에서 curl로는 검증 불가한 항목).

---

### A2: 템플릿 갤러리

- [상태: 완료] 커밋 `0ab4f37`
- 기존 `StarterTemplates.tsx`/`selectStarterTemplate.ts`(GitHub 템플릿 fetch 파이프라인)는 지시대로 손대지 않음 — `/templates`는 완전히 별개의 새 라우트.
- `/templates`: kit CSS(`design-handoff/coralred-ui.css`)만 사용하는 8개 카드 그리드. 각 카드 = 이름/한 줄 설명/태그 3개/타일 모티프 인라인 SVG(Logo의 사각 타일 모티프를 재사용, 브랜드 hue를 따라가도록 `var(--accent)`/`var(--accent-soft)`/`var(--border-strong)`로만 색칠 — 다크모드/커스텀 hue 자동 대응). 큐레이션 8종: 가게예약, 재고관리, 회원관리, 포트폴리오, 설문, 모임회비정산, 대시보드, 블로그.
- **버그 발견 겸 수정**: 랜딩 히어로의 "템플릿" 타일이 `scrollToTemplates()`로 `#examples` 엘리먼트를 찾아 스크롤하는 코드였는데, `ExamplePrompts`(그 엘리먼트를 그리는 컴포넌트)는 애초에 랜딩에 렌더되지 않음(BaseChat.tsx 주석에 명시) — 즉 클릭해도 아무 일도 안 일어나는 죽은 CTA였음. `/templates`로 링크되도록 수정하고 죽은 스크롤/하이라이트 코드(CoralredHero.tsx의 `scrollToTemplates`, CoralredHero.module.scss의 `.examplesHighlight`)는 정리.
- **버그 발견 겸 수정 2**: "이 템플릿으로 시작" 클릭 시 어떻게 랜딩 입력창에 프롬프트를 주입하고 온보딩 설문으로 들어가게 할지 조사하던 중, 이미 존재하지만 아무 데서도 쓰이지 않던 `Chat.client.tsx`의 `?prompt=` 쿼리 파라미터 처리 로직을 발견 — 근데 이 로직이 `sendChatMessage`를 직접 호출해서 **온보딩 설문(clarification)을 건너뛰고 바로 생성**으로 들어가는 버그가 있었음 (실제 입력창/예시 프롬프트가 쓰는 `sendMessage`의 `!chatStarted` 분기는 `checkGenerationsAllowed` → `setClarifyingPrompt`를 거침). 미사용 기능이라 안전하게 같은 경로로 고쳐서 `/templates` 카드가 예시 프롬프트를 클릭했을 때와 완전히 동일하게 동작하도록 함.
- **검증**: typecheck/lint/build 클린. 컴파일된 서버 번들 grep으로 `이 템플릿으로 시작` 문자열과 라우트가 실제로 번들에 포함됐음을 확인.
- **아침 확인 필요**: 브라우저에서 `/templates` 카드 클릭 → 랜딩 입력창에 프롬프트가 채워지고 온보딩 설문이 뜨는지 실제 확인 (SSR로는 클라이언트 사이드 useEffect 동작을 검증할 수 없음). 8개 프롬프트 문구가 실제 생성 결과와 잘 맞는지도 확인 권장.

---
