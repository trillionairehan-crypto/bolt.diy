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

### A3: 클릭해서 고치기

- [상태: 완료] 커밋 `5d99b7c`
- **조사 결과**: 지시받은 대로 기존 "프리뷰 인스펙터(선택 모드)" 코드를 조사했더니, 백엔드 파이프라인이 이미 100% 구현되어 있었음 — `Preview.tsx`의 "요소 검사" 토글 → iframe에 주입된 `public/inspector-script.js`가 클릭한 요소 정보를 `postMessage`로 전달 → `Chat.client.tsx`의 `selectedElement` 상태에 저장 → 다음 메시지 전송 시 `sendMessage`가 자동으로 `__boltSelectedElement__` 마커(태그/클래스/텍스트/DOM 경로 JSON)를 메시지에 첨부. 이 전 과정이 이미 존재했고 손댈 필요가 없었음.
- 다만 사용자 경험과 모델 활용, 두 군데가 빠져 있었음:
  1. **UX**: 토글 라벨이 "요소 검사 켜기/끄기"(개발자 용어)였고, 선택 칩(ChatBox.tsx)이 영어("selected for inspection"/"Clear")에 태그명만 보여줬음 — voice.md 위반. "선택해서 고치기"로 개명하고, 칩은 "선택: {실제 텍스트}" 형식의 한글로 교체. 한 번 선택하면 인스펙터가 자동으로 꺼지도록 수정(연속 클릭 시 의도치 않게 다른 요소로 바뀌는 것 방지).
  2. **모델 활용**: 시스템 프롬프트(`new-prompt.ts`)가 `__boltSelectedElement__` 마커를 전혀 설명하지 않아서, 모델이 그냥 원본 JSON 텍스트를 받기만 하고 어떻게 써야 하는지 몰랐음. `<selected_element_instructions>` 섹션을 새로 추가해서 태그/클래스/텍스트/DOM 경로를 "파일 위치 추정용 힌트"로 명시하고, 반드시 코드베이스에서 검색/확인 후 수정하라고 지시 (정확도 한계를 명시적으로 인지시킴 — 클래스명 변형, 요소 중복, DOM≠JSX 구조 문제 등).
  - 프롬프트 캐싱 브레이크포인트(`CACHE_BREAKPOINT_MARKER`, overnight2 이전 밤 작업) 앞의 정적 프리픽스 안에 삽입해서 캐시 효율에 영향 없음.
- **검증**: typecheck/lint/build 클린. 컴파일된 서버 번들 grep으로 `<selected_element_instructions>`와 "선택해서 고치기" 문자열이 실제로 번들에 포함됐음을 확인.
- **아침 확인 필요**: 실제 프리뷰에서 요소를 클릭했을 때 칩이 뜨고, 그 상태로 "이거 초록색으로 바꿔줘" 같은 메시지를 보냈을 때 모델이 실제로 해당 요소를 올바르게 찾아 수정하는지 실사용 확인 필요 (클릭→모델 판단까지는 curl로 검증 불가).

---

### A4: 시점 되돌리기 (버전 스냅샷)

- [상태: 완료 — 단, 기존 메커니즘 자체의 한계를 발견해서 아래에 상세히 기록함] 커밋 `6e85750`
- **UI**: 워크벤치 헤더(코드/차이점/미리보기 슬라이더 옆)에 시계 아이콘 드롭다운 추가. 완료된 assistant 응답마다 한 줄씩 나열(시간 + 요약 — 요약은 기존에 이미 존재하던 `data-chatSummary` 메시지 파트를 재사용, 없으면 응답 텍스트 앞부분으로 대체). 클릭하면 `ConfirmationDialog`("이 시점 이후에 만든 내용이 사라져요")를 거쳐 기존 되돌리기(`?rewindTo=`) 메커니즘을 그대로 실행.
- **재사용, 새로 안 만든 것**: 메시지별 되돌리기 버튼(`AssistantMessage.tsx`)이 이미 실사용자에게 노출돼 있었음(dev 플래그 아님) — 같은 쿼리 파라미터 방식을 그대로 씀. 새 파일 스냅샷 저장소는 만들지 않음(지시 준수).
- **⚠️ 조사 결과 — 기존 메커니즘의 진짜 한계 (반드시 읽어주세요)**:
  - `app/lib/persistence/db.ts`의 `setSnapshot`이 IndexedDB `snapshots` 스토어에 `chatId`를 유일 키로 `put`함 — 즉 **채팅 하나당 스냅샷 행이 딱 1개**이고, 메시지가 완료될 때마다 최신 파일 상태로 덮어씌워짐. 여러 시점의 파일 스냅샷이 따로 보관되는 게 아님.
  - 코드를 정적으로 추적한 결과, 실제 "N번째 메시지로 되돌리기"는 이 단일 스냅샷이 아니라 메시지 배열 자체를 그 지점까지 자른 뒤, 메시지에 내장된 `<boltArtifact>`/`<boltAction>`을 처음부터 다시 재생하는 파이프라인에 의존하는 것으로 보임(단일 스냅샷은 "오래된 채팅을 새로고침할 때 처음부터 다 재생하지 않고 빨리 이어가기"용 최적화로 판단됨). 즉 이론적으로는 임의 시점 복원이 되어야 하지만, **브라우저에서 실제로 재생해서 검증하지는 못했음** — curl/SSR로는 이 클라이언트 사이드 재생 로직을 검증할 수 없는 항목.
  - 타임스탬프("오후 3:42" 형식)는 메시지 자체에 저장된 생성 시각이 없어서(추가하려면 메시지 스키마를 건드려야 해서 범위 밖으로 판단) 워크벤치 컴포넌트가 각 메시지를 **처음 관찰한 시점**을 세션 로컬(새로고침하면 사라짐)로 기록하는 방식으로 대체함. 브라우저를 새로고침해서 기존 채팅을 다시 열면, 그 시점에 이미 있던 모든 메시지가 전부 "지금"으로 뭉뚱그려 찍힘 — 실제 생성 시각이 아님. 이 세션 동안 새로 온 응답은 정확함.
- **부수 발견 겸 수정**: `ConfirmationDialog`(이 작업에서 직접 사용하게 되어 발견)가 이미 토큰화된 기반 `Dialog` 컴포넌트 위에 자체적으로 `bg-white dark:bg-gray-950`(하드코딩)와, destructive 버튼에 `bg-red-500`(하드코딩)을 다시 씌우고 있었음 — round2에서 기반 `Dialog`만 고치고 이 위에 있는 래퍼는 놓쳤던 것. `--surface-2` 상속 + `--bolt-elements-button-danger-*` 토큰으로 교체.
- **검증**: typecheck/lint/build 클린. 컴파일된 클라이언트 번들 grep으로 드롭다운 문자열이 실제로 포함됐음을 확인.
- **아침 확인 필요 (중요도 높음)**: 실제 대화에서 메시지 3~4개를 주고받은 뒤, 중간 시점(가장 최근이 아닌 시점)으로 "되돌리기"를 실행했을 때 코드/파일이 **실제로 그 시점 상태로 복원되는지** 반드시 확인 필요 — 위에서 설명한 대로 이 부분은 코드 추적만 했고 실브라우저 검증을 못 했음. 만약 안 된다면 이건 오늘 밤 새로 만든 버그가 아니라 기존에 이미 있던 버그이니 별도 이슈로 다뤄야 함.

---

### A5: 메시지 카운트 일관성

- [상태: 완료 — 플래그 게이트, 기본 꺼짐] 커밋 `aa03919`
- **⚠️ 조사 결과 — 실제로 이미 배포되어 있던 과금 우회 버그를 발견함**: `increment_generation_count`가 호출되는 곳을 코드 전체에서 추적한 결과 **딱 한 군데**뿐이었음 — `generateNewApp`(채팅의 "첫 메시지"가 온보딩 설문을 마친 뒤 실제로 생성이 시작되는 지점). `chatStarted` 이후 후속 메시지를 보내는 `sendMessage`의 다른 분기는 `checkGenerationsAllowed`도 `increment`도 전혀 호출하지 않음. 즉 **채팅의 첫 메시지 딱 1개만 카운트되고, 그 뒤로 몇 개를 더 보내든 전부 무료** — 오늘 밤 새로 생긴 버그가 아니라 이미 프로덕션에 나가 있는 상태로 추정됨(이 세션에서 아무것도 안 건드렸는데 발견된 것이므로).
- **목표 정의**(지시받은 대로): 1 사용자 발화 = 1메시지. auto-fix(미리보기 에러 자동수정, `actionAlert` 기원) 트리거는 제외. 무료 티어 = 월 10개 + 일 1개.
- **구현, 전부 `CORALRED_NEW_METERING` 플래그 뒤(`app/utils/featureFlags.ts`, 기본 `false`)**:
  - `Chat.client.tsx`: `sendMessage`에 4번째 파라미터 `isAutoFix`(기본 `false`) 추가, auto-fix 이펙트만 `true`로 호출. `checkGenerationsAllowed`/새 `recordGenerationUsed` 헬퍼가 플래그에 따라 기존 v1 함수 또는 새 v2 함수로 분기. 후속 메시지 분기에 `if (CORALRED_NEW_METERING && !isAutoFix)` 블록으로 체크+카운트를 새로 추가 — **플래그가 꺼져 있으면 이 블록 자체가 아예 실행 안 되므로 기존 버그(?) 동작이 그대로 보존됨**.
  - `app/lib/freeTrial.ts`: v2 함수 세트 추가 (게스트=localStorage 월/일 카운터, 로그인=새 Supabase RPC). 기존 v1 함수는 한 글자도 안 건드림.
  - `supabase/migrations/20260825000000_message_metering_v2.sql` (작성만 함, 미적용): `generation_usage_v2` 테이블(월/일 카운트 + 이월용 예약 컬럼) + `get_generation_status_v2`/`increment_generation_count_v2` RPC. 기존 `generation_usage` 테이블이나 RPC는 전혀 안 건드리는 완전 추가형 스키마.
  - **의도적으로 미구현**: 유료 플랜 이월(다음 달로 최대 월 할당량의 2배까지 누적)은 플랜별 월 할당량을 알아야 하는데, 그 정보가 있는 `pricing.tsx`가 이번 시리즈 내내 불가침이라 코드로 확인 못함. `carryover_count` 컬럼만 마련해두고 로직은 안 붙임 — 아침에 실제 플랜별 할당량을 확인한 뒤 이어서 구현해야 함.
- **재검증**: typecheck/lint/build 클린. 플래그가 꺼진 상태에서의 코드 경로를 다시 추적: `checkGenerationsAllowed`/`recordGenerationUsed`는 flag=false일 때 기존 v1 함수를 그대로 호출하고, 새로 추가된 후속-메시지 카운트 블록은 flag 조건 자체가 false라 통째로 스킵됨 — 즉 오늘 밤 이전과 동작이 100% 동일함을 코드 추적으로 확인.
- **아침 적용 절차** (사용자가 결정할 사항):
  1. `supabase/migrations/20260825000000_message_metering_v2.sql`을 실제 Supabase 프로젝트에 적용 (Supabase 대시보드 SQL 에디터 또는 `supabase db push`).
  2. `pricing.tsx`의 실제 플랜별 월 할당량을 확인하고, 유료 플랜 이월 로직을 RPC에 추가할지 결정.
  3. `app/utils/featureFlags.ts`의 `CORALRED_NEW_METERING`을 `true`로 변경 + 커밋.
  4. 실브라우저에서 후속 메시지를 여러 번 보내면서 카운트가 실제로 올라가는지, 한도 도달 시 올바르게 막히는지 확인.
  5. (선택) 기존 v1 `generation_usage` 테이블의 과거 데이터를 v2로 마이그레이션할지 결정 — 새 스키마는 완전히 별도라 기존 사용자의 "이미 쓴 횟수" 이력이 자동으로 넘어가지 않음.

---

### A6: 내 앱 대시보드

- [상태: 완료] 커밋 `7376a7b`
- **조사 결과**: 배포 기록 저장소가 아예 없었음. Netlify/Vercel 배포 성공 시 `localStorage.setItem('netlify-site-<chatId>', siteId)` 하나가 전부 — URL도 배포 시각도 없이 브라우저 로컬에만 저장됨. **서버사이드 배포 토큰도 없음**: 사용자가 설정 탭에 직접 붙여넣은 개인 액세스 토큰으로 브라우저가 직접 Netlify/Vercel API를 호출하는 구조(`app/lib/stores/netlify.ts` 등)라, 코랄레드 서버가 사용자 대신 재배포/삭제를 실행할 방법이 없음.
  - → 지시받은 대로 "죽은 CTA를 만들지 말 것"을 지켜서 재배포/삭제 버튼은 아예 구현하지 않았고, 이 요구사항을 리포트에만 기록함(아래 아침 확인 항목 참고).
- **저장소**: `supabase/migrations/20260825000001_deployed_apps.sql` 작성(미적용) — `deployed_apps` 테이블(사용자별 RLS, `user_id`는 클라이언트가 못 채우고 트리거가 `auth.uid()`에서 채움 — 남의 이름으로 기록 못 남김) + 조회 인덱스.
  - `app/lib/deployedApps.ts`: `recordDeployedApp`(best-effort — 실패해도 로그만 남기고 절대 배포 자체를 막지 않음)과 `getDeployedApps`.
  - **부수 발견**: 내부 `chatId`(숫자형 ID)와 라우팅에 쓰이는 `urlId`(첫 아티팩트 id에서 파생된 슬러그, 예: `todo-app`)가 서로 다른 값이라는 걸 발견 — 그냥 `chatId`로 저장했으면 "채팅으로 돌아가기" 링크가 깨졌을 것. IndexedDB에서 `urlId`를 조회해서 저장하도록 처리(조회 실패 시 `chatId`로 폴백).
- **클라이언트**: `NetlifyDeploy.client.tsx`/`VercelDeploy.client.tsx`의 배포 완료 지점에 `recordDeployedApp` 호출 추가 (GitHub/GitLab 배포는 라이브 URL이 안 나오는 저장소 푸시 방식이라 대상에서 제외 — 확인 후 스코프 판단).
  - 새 `/apps` 라우트(로그인 필요, 비로그인 시 로그인 유도): 배포 목록(이름/URL/배포 시각/원본 채팅 링크), 빈 상태 "다음 배포부터 여기 쌓여요."(지시받은 정확한 문구).
  - 사이드바 메뉴 하단(설정 버튼 옆)에 로켓 아이콘으로 "내 앱" 진입점 추가 — 지시엔 없었지만 진입점 없이는 도달 불가능한 라우트라 최소한으로 추가.
- **검증**: typecheck/lint/build 클린. 컴파일된 서버 번들 grep으로 "내 앱"/"다음 배포부터 여기 쌓여요" 문자열이 실제로 포함됐음을 확인.
- **아침 확인 필요**:
  1. 마이그레이션 적용 후 실제 Netlify/Vercel 배포 → `/apps`에 정상적으로 나타나는지, "채팅으로 돌아가기" 링크가 실제로 맞는 채팅으로 가는지 확인.
  2. 재배포/삭제 기능이 정말 필요하다면, 서버사이드 배포 토큰(코랄레드 자체 Netlify/Vercel 앱 연동)을 새로 구축해야 함 — 지금 구조(사용자 개인 토큰, 브라우저 직접 호출)로는 불가능. 이건 이번 세션 범위를 크게 벗어나는 인프라 작업이라 손대지 않음.

---

## PART B

### B1: 테스트 스위트

- [상태: 완료] 커밋 `b027453`
- vitest는 이미 설치·설정되어 있었음(`pnpm test`, `vite.config.ts`의 `test` 블록, 기존 스펙 3개/52케이스) — 새로 도입할 필요 없이 바로 확장.
- 지시받은 6개 모듈 대상 정상+경계 케이스 작성: `dependency-postprocess`, `file-reference-postprocess`, `answer-directives`(mapAnswerToDirectives 전체 질문×옵션 매핑 + 몰라요 분기 + mergeDirectives), `generateAppQuestions`(fetch 모킹으로 파싱/펜스 제거/실패 폴백 전부), `paletteToHue`(hexToOklchHue 브랜드 hex 값들), `UserMessage`의 `splitDisplayText`(ONBOARDING_ADDITIONS_MARKER 분리 로직) — `splitDisplayText`는 테스트 가능하도록 export 추가(동작 변경 없음).
- 기존 52개 + 신규 98개 = **150개 전부 통과**.
- **⚠️ 테스트 작성 중 실제 프로덕션 버그 2건 발견 — 테스트로 버그를 그대로 고정시키지 않고 원인을 수정함**:
  1. `file-reference-postprocess.ts`의 `RELATIVE_IMPORT_RE`: 정규식의 지연 수량자(`[\s\S]*?`)가 앞선 import문의 특이자가 상대경로가 아니면(예: `import React from 'react'`) 그 import문 전체를 건너뛰어 버려서, 두 번째 이후 import의 깨진 참조에 대해 **잘못된 줄 번호**를 보고하고 있었음. 이건 auto-fix 프롬프트에 실제로 들어가는 값이라 실사용자 영향이 있는 버그. `[^'"]*?`로 교체(따옴표를 건너뛸 수 없게 해서 앞 import문 전체를 건너뛰지 못하게 막음)해서 수정.
  2. `dependency-postprocess.ts`의 `IMPORT_SPECIFIER_RE`: 형제 모듈(`file-reference-postprocess.ts`)과 달리 `import(...)` 형태의 동적 임포트를 지원하지 않아서, `await import('@supabase/supabase-js')`처럼 지연 로드하는 알려진 패키지가 package.json 누락 감지에서 빠지고 있었음. 동일한 안정성 수정과 함께 동적 import 지원 추가.
- **검증**: `pnpm test`(pre-commit에는 안 걸림, 지시대로 별도 실행) 150/150 통과, typecheck/lint/build 클린(정규식 2건은 프로덕션 코드 변경이라 전체 파이프라인 재검증함).

---
