# Easy Deep Discovery — 설계 명세 (2026-09-22, HEAD `bf2f842a`)

**상태**: 설계만. 프로토타입·코드 변경 없음. 이 문서는 현재 코드(온보딩 5문항 → 지시문 → 시스템 프롬프트 → 생성)를 그대로 읽고, 실측(`docs/SCENARIOS-2026-09-22.md`)에서 드러난 결함 — Research 없음, Planning이 사용자에게 안 보임, 요구사항 누락 4/20, `/brief` 미연결, 골격 오판 — 을 고치기 위해 **무엇을 어디에 어떻게 넣을지**를 정한다. §20이 핵심(현재 코드 교체/재사용 지도).

용어: **Discovery** = 사용자에게서 만들 것을 알아내는 전 과정. **Blueprint** = Discovery의 결과물(구조화된 결정 목록). **Question Engine** = 다음에 무엇을 물을지 정하는 규칙.

---

## 1. Easy Deep Discovery 원칙

1. **쉽게, 그러나 깊게.** 사용자는 개발 용어를 모른다(`design-handoff/coralred-voice.md`). 질문은 "가게 얘기"로 하고, 깊이는 엔진이 만든다 — 한 답에서 여러 결정을 추론한다.
2. **답이 결정을 낳고, 결정이 코드를 낳는다.** 모든 질문은 Blueprint의 특정 필드를 채우기 위해 존재한다. 어느 필드도 안 채우는 질문은 없다(현재 Q4 연동은 DB 저장만 하고 생성에 안 흐른다 — 이런 질문은 금지).
3. **사용자가 말한 것은 사실, AI가 정한 것은 추정.** 둘을 같은 칸에 섞지 않는다(§4 출처 등급). 사용자가 말한 것을 AI가 덮어쓰지 못한다(§16).
4. **모르면 묻고, 알면 안 묻는다.** 프롬프트에 이미 있는 것(날짜·이름·가격)은 다시 묻지 않고 확인만 한다. 추론 가능한 것은 추정으로 채우고 요약 화면에서 보여준다.
5. **끝은 "이렇게 만들게요" 한 장.** 사용자는 Blueprint 요약(계획 카드)을 보고 고친 뒤 생성한다. 지금은 프롬프트 텍스트 한 덩어리를 보여주는데(`PromptClarification.tsx` summary), 이것을 구조화된 카드로 바꾼다.
6. **결정은 남는다.** Blueprint는 채팅에 저장되고 수정 턴마다 프롬프트에 다시 실린다. 지금은 첫 메시지 텍스트에만 있어 5턴 뒤엔 컨텍스트 최적화가 잘라낼 수 있다.
7. **질문 수는 예산이다.** 기본 5문항(현재와 같은 부담), 최대 9. 그 이상은 CRITICAL 미결정이 남을 때만.

## 2. 질문 생성 엔진

```
입력: prompt(사용자 문장) + 지금까지의 answers + 추출된 facts(프롬프트 파싱)
      + 골격 후보(Q3 매핑·핵심명사 규칙) + 트랙 후보(일반/시네마틱)
과정:
  1. FactExtractor   — 프롬프트에서 고유명사·숫자·날짜·장소·기능 명사를 뽑아 Blueprint 필드에 USER_LOCKED로 선기입
  2. Resolver        — 각 Blueprint 필드에 대해 (a) 사용자 답/사실이 있으면 확정 (b) 없으면 추정 규칙으로 AI_RECOMMENDED/AI_DEFAULT 채움 (c) 추정 불가면 UNKNOWN
  3. Selector        — UNKNOWN·불확실 필드 중 중요도(§3)와 분기 조건(§6·§8)으로 다음 질문 1개 선택
  4. Renderer        — 질문 템플릿(§19) + 선택지(추정값을 첫 번째 선택지로) + "잘 모르겠어요"/"상관없음"
출력: 다음 질문 또는 "질문 끝(요약 화면)"
```

- 엔진은 **결정적**(규칙 기반). LLM은 두 곳에서만: 업종 자유 입력 매핑(현행 `mapIndustryToSkeleton`)과 프롬프트 사실 추출(FactExtractor, Haiku 1회, 실패하면 정규식 폴백). 질문 문구·순서를 LLM이 즉흥으로 만들지 않는다 — 실측 가능성·테스트 가능성 때문.
- 질문은 항상 **질문 뱅크**(§19)에서 고른다. 뱅크의 각 항목: `id, fills[](채우는 필드), importance, askWhen(조건), skipWhen(조건), options(추정값 우선), allowUnsure, allowAny`.

## 3. 질문 중요도

| 등급 | 뜻 | 미답 시 |
|---|---|---|
| **CRITICAL** | 이게 틀리면 다른 앱이 나온다(골격, 사용자 관점, 핵심 데이터, 저장 여부, 소개형 여부) | 반드시 묻는다. "잘 모르겠어요"면 추정 + 요약 카드에 **노란 표시**로 확인 요구 |
| **HIGH** | 틀리면 사용자가 바로 고쳐달라고 한다(가격·이름·장소 같은 고유 데이터, 예약 방식, 연락 수단, 팔레트) | 프롬프트에 있으면 안 묻고 확인. 없으면 묻되 예산 초과 시 요약 카드에서 편집 |
| **MEDIUM** | 품질에 영향(무드, 사진 유무, 챕터 이야기, 영업시간 표기) | 여유 있을 때만. 기본값으로 진행 |
| **LOW** | 취향(모션 강도, 소리, 서체 프리셋) | 묻지 않는다. AI_DEFAULT. 요약 카드 "더 보기"에서 편집 |

현재 5문항 대응: Q1 관점=CRITICAL, Q2 저장=CRITICAL, Q3 업종=CRITICAL(골격 결정 근거), Q4 연동=HIGH(단, 생성에 흘러야 의미 — 지금은 안 흐름), Q5 팔레트=HIGH.

## 4. 답의 출처 등급

| 등급 | 뜻 | 프롬프트 표기 | 덮어쓰기 |
|---|---|---|---|
| **USER_LOCKED** | 사용자가 명시적으로 말했거나 골랐다(프롬프트 문장, 선택지 클릭, 요약 카드 편집) | `[확정] …` | AI 불가. 사용자만 |
| **USER_PREFERENCE** | 사용자가 "이 쪽이 좋아요" 수준으로 답함("상관없음" 아님) | `[선호] …` | AI가 충돌 시 대안 제시 가능, 무단 변경 불가 |
| **AI_RECOMMENDED** | 엔진이 근거 있게 추천했고 사용자가 요약 카드에서 봤다(반대 안 함) | `[추천] …(근거)` | 생성 중 AI가 더 나은 근거로 바꿀 수 있음 — 단 답변에서 바뀐 것을 말해야 함 |
| **AI_DEFAULT** | 기본값. 사용자가 보지 않았을 수 있음 | `[기본] …` | 자유 |
| **UNKNOWN** | 아무 근거 없음 | 프롬프트에 싣지 않음. "있으면 넣지 말고 빈 자리로" 규칙 | — |

이 5등급은 Blueprint의 **모든 필드**에 붙는다(`{ value, source, evidence }`). §16의 덮어쓰기 금지 규칙은 source로 판정한다.

## 5. 질문을 해야 하는 조건

- 필드가 CRITICAL이고 source가 UNKNOWN 또는 AI_DEFAULT.
- 필드가 HIGH이고 UNKNOWN이며, 프롬프트 파싱으로도 못 채웠고, 질문 예산이 남았다.
- **충돌**: 두 근거가 다른 값을 가리킨다 — 예: 온보딩 골격=예약(2)인데 프롬프트에 "홈페이지" → 지금은 `looksLikeShowcasePrompt`가 조용히 시네마틱으로 보낸다(실측 s01 예약 폼 실종). 이 경우 **반드시 묻는다**: "예약을 받는 앱이 필요해요, 아니면 가게를 소개하는 홈페이지가 필요해요? (둘 다도 가능해요)".
- 이전 답이 새 필드를 열었다(§8 분기): 예약형 → "예약 시간 단위?"; 소개형 → "사진 있나요?".
- 사용자가 "잘 모르겠어요"를 CRITICAL에 골랐다 → 같은 필드를 **다른 각도의 질문 1개**로 한 번만 더(§7).

## 6. 질문을 건너뛰어도 되는 조건

- 프롬프트에서 FactExtractor가 USER_LOCKED로 채웠다(예: "10월 24일 토요일 오후 1시, 더채플 앳 청담" → 날짜·장소). 건너뛰고 요약 카드에 표시.
- 상위 결정이 필드를 무의미하게 만든다: 저장=없음 → 연동·데이터 질문 전부 건너뜀. 소개형 → 데이터 필드 질문 건너뜀. 전화 예약만 → 예약 폼 질문 건너뜀.
- 업종 그리드 항목이 강한 기본값을 가진다(`Q3_GRID.skeleton`, `recommendedPalettes`) 그리고 프롬프트가 그 기본값과 충돌하지 않는다 → 골격 질문 건너뛰고 AI_RECOMMENDED.
- 예산 초과(§9): HIGH 이하 전부 건너뛰고 요약 카드로.
- 사용자가 `/templates`·`/examples` 카드에서 시작했다 → 템플릿이 Blueprint 절반을 USER_PREFERENCE로 미리 채움. 질문 2~3개로 끝.
- 두 번째 앱부터: 같은 계정의 이전 Blueprint에서 브랜드·연락처·팔레트를 AI_RECOMMENDED로 제안(묻지 않고 요약에서 확인).

## 7. "잘 모르겠어요"와 "상관없음" 처리

| 답 | 뜻 | 처리 |
|---|---|---|
| **잘 모르겠어요** | 결정을 못 하겠다, 정보가 없다 | source=UNKNOWN 유지. CRITICAL이면 다른 각도로 1회 재질문(예: "누가 쓰나요?" 모름 → "손님이 직접 예약 버튼을 누르나요, 사장님이 대신 입력하나요?"). 그래도 모르면 업종 기본값을 AI_RECOMMENDED로 넣고 요약 카드에 노란 표시 + 한 줄 이유. 생성물에서는 **보수적 선택**(기능 적게, 샘플 데이터 표시) |
| **상관없음** | 결정을 AI에 위임 | source=AI_DEFAULT로 채우고 다시 묻지 않는다. 요약 카드에 "코랄레드가 골랐어요" 표시. 이후 AI가 자유롭게 바꿀 수 있음 |
| 무응답(건너뛰기 버튼) | = 상관없음 | 동일 |

두 답은 모든 질문에 항상 노출(선택지 맨 아래, 작게). CRITICAL 질문에서 "상관없음"은 허용하되 "이건 앱 모양을 정하는 질문이에요"를 한 줄 덧붙인다.

## 8. 동적 분기

분기 키는 3개: **골격**(1~7), **관점**(본인/관리자/방문자), **트랙**(일반/시네마틱). 이 셋이 정해지면 나머지 질문 집합이 결정된다.

```
prompt ─► FactExtractor ─► 골격 후보
   │                           │
   ▼                           ▼
[Q 관점]  ──────────────► [Q 골격 확인] (충돌 시에만)
   │                           │
   ├─ 골격 7 / 소개형 ────────► 트랙=시네마틱 ─► [Q 목표 CTA] [Q 사진 있나] [Q 연락 방식] [Q 이야기 3개(MEDIUM)]
   ├─ 골격 2 예약 ───────────► [Q 예약 단위(시간/날짜/담당자)] [Q 예약 확정 방식(자동/사장 승인)] [Q 저장]
   ├─ 골격 1 명단·잔액 ──────► [Q 잔액 종류(횟수/포인트/금액)] [Q 누가 적립(직원/손님)] [Q 저장]
   ├─ 골격 3 거래 ───────────► [Q 카테고리 고정?] [Q 저장]
   ├─ 골격 4 목록 ───────────► [Q 항목 종류] [Q 구매/문의 버튼 행동] [Q 저장]
   ├─ 골격 5 기록 ───────────► [Q 기록 단위(일/회)] [Q 그래프 필요?] [Q 저장]
   ├─ 골격 6 순위 ───────────► [Q 점수 기준] [Q 누가 입력]
   └─ 해당 없음(도구·게임) ──► [Q 한 문장으로 무엇을 하는 도구?] [Q 저장 필요?]
                                     │
                              [Q 팔레트] (업종 추천 첫 번째)
                                     │
                              [요약 카드] ─► 생성
```

- **복합 요청**("예약 홈페이지", "메뉴판+적립"): 주 골격 + 부가 화면 1개(현행 프롬프트 규칙과 같음)를 **질문으로 확정**한다: "핵심은 예약이고 소개는 첫 화면 한 장이면 될까요, 아니면 소개 사이트에 예약 버튼만 있으면 될까요?". 실측 s01·s04 누락의 직접 대책.
- **범위 밖 감지**(네이티브 앱·크롤링·결제 완결·로그인 완결): FactExtractor가 키워드를 잡으면 질문 대신 **한계 카드**를 먼저 보여준다("앱스토어 앱은 못 만들지만, 링크로 여는 웹앱을 만들고 홈 화면에 추가하게 할 수 있어요 — 이렇게 진행할까요?"). 실측 s16·s02(Stripe) 대책.

## 9. 질문 수 최소화

1. **프롬프트 파싱 우선**: 한 문장에서 뽑을 수 있는 건 다 뽑는다(s20 긴 요구 → 강사 3명·가격·수업 3종 전부 USER_LOCKED, 질문 0).
2. **한 질문 = 여러 필드**: "누가 쓰나요?"가 관점 + 내비 형태(사이드바/하단 탭) + 기본 화면을 동시에 정한다(현행 `SKELETON_DEFAULT_PERSPECTIVE`와 같은 매핑을 명시).
3. **추정값을 첫 선택지로**: 사용자는 대부분 첫 번째를 누른다 → 답변 시간 단축, 결정은 USER_LOCKED 승격.
4. **예산**: 기본 5, 최대 9. CRITICAL 미결정이 없으면 5에서 끝. 요약 카드가 "묻지 않은 것"을 편집 가능하게 보여주므로 안 물어도 손해가 없다.
5. **묶음 질문 금지**: 한 화면에 질문 하나(현행 유지). 대신 선택지에 조합을 넣는다("손님이 예약하고 사장님이 승인" 같은 한 줄 조합).
6. **재방문 재사용**: §6 마지막 항.

측정: 실측 시나리오 20개를 엔진에 넣었을 때 질문 수 분포를 기록한다(목표 중앙값 5, 최대 8).

## 10. Product Blueprint 생성 규칙

Blueprint는 하나의 JSON(`version: 1`)이며 4개 부분: Product / UX / Technical / Design. 모든 리프 필드는 `{ value, source, evidence? }`.

**Product Blueprint** — "무엇을 위해 누가 무엇을 하는 앱인가"

| 필드 | 채우는 규칙 | 등급 |
|---|---|---|
| `purpose`(한 문장) | 프롬프트 첫 문장 정규화. 없으면 업종+골격으로 생성 | CRITICAL |
| `skeleton`(1~7 또는 null) | 핵심명사 규칙(현행 `<app_skeletons>` 1단계) → Q3 매핑 → 질문. 충돌 시 질문(§5) | CRITICAL |
| `track`('standard'\|'cinematic') | `skeleton===7` 또는 사용자가 "소개 사이트"를 확정했을 때만 cinematic. **단어 휴리스틱(`looksLikeShowcasePrompt`)은 후보 제안까지만, 확정은 사용자** | CRITICAL |
| `audience`(본인/관리자/방문자) | Q1. 골격 기본 관점과 다르면 Q1이 이긴다(현행 규칙 유지) | CRITICAL |
| `coreEntities[]`(예: 회원, 예약, 메뉴) | 골격 + 프롬프트 명사. 각 entity에 `fields[]`(이름·전화·잔여 등) | HIGH |
| `keyActions[]`(예: 예약 생성, 적립, 취소) | 골격 기본 액션 + 프롬프트 동사 | HIGH |
| `facts[]`(고유명사·숫자·날짜·장소·가격) | FactExtractor. **전부 USER_LOCKED**. 생성물에 그대로 들어가야 하고 기계 검사가 존재를 확인(§14) | HIGH |
| `secondaryScreen`(복합 요청의 부가 화면) | §8 복합 질문 | HIGH |
| `outOfScope[]`(못 하는 것 + 대안) | 범위 밖 감지 | HIGH |
| `storage`('cloud'\|'none'\|'supabase') | Q2 | CRITICAL |
| `integrations[]`(kakao 등) | Q4. **생성에 흘려야 함**(지금은 DB 저장만) | HIGH |

규칙: `facts`는 사용자가 지운 것 외에 절대 소실되지 않는다. `outOfScope`가 비어 있지 않으면 요약 카드 맨 위에 표시.

## 11. UX Blueprint 생성 규칙

| 필드 | 규칙 |
|---|---|
| `screens[]` | 골격별 기본 화면 목록(현행 프롬프트 `<app_skeletons>`의 화면 규칙을 데이터로 옮김) + `secondaryScreen` + 시네마틱이면 11장면 순서(`kit-prompt.ts`). 각 screen에 `purpose, entities, actions` |
| `navigation` | 관점으로 결정: 관리자=사이드바, 본인=하단 탭, 방문자=검색+카테고리(현행 규칙) |
| `primaryCTA` | 시네마틱: `GOAL_CTA`(brief-schema)에서. 일반: 골격 핵심 액션 |
| `sampleData` | 저장=none이면 필수. entities마다 5~10행, `facts`를 우선 사용(가격·이름). 현행 "샘플 데이터 수치 규칙" 유지 |
| `emptyStates`, `confirmations` | 액션마다 기본 문구(해요체) |
| `mobileLayout` | 요약 카드 ≤2열, 표는 카드로 — 실측 D5 대책 |
| `copy.tone` | 업종 + 무드(있으면) |

규칙: `screens`가 3개를 넘으면 요약 카드에서 화면 이름을 보여주고 사용자가 뺄 수 있다(USER_LOCKED로 승격).

## 12. Technical Blueprint 생성 규칙

| 필드 | 규칙 |
|---|---|
| `stack` | 고정: React+Vite SPA, `coralred-ui.css`, (cinematic) 킷 21파일. 선택지 아님(V1) |
| `dataModel` | `coreEntities` → 컬렉션 이름(`^[a-z][a-z0-9_]{0,30}$`, Cloud 규칙) + 필드 타입. 저장=none이면 state only |
| `storageMode` | cloud → SDK 주입 + `deviceKey` 격리 안내 문구(방문자 앱이면 "기기별 저장" 한계를 요약 카드에 명시 — Cloud에 사용자 인증이 없으므로). supabase → 연결 안내. none → 없음 |
| `integrations` | kakao → `VITE_KAKAO_JS_KEY` 스텁 + "키 필요" 안내. 결제·로그인 완결 요청 → `outOfScope`로 이동, 화면만 |
| `media` | cinematic: 예약 사진 4장 + (옵션) 영상. `hasUserPhotos`면 업로드 슬롯(V1 신규). 예약 실패 시 **그라데이션 폴백 지시**(실측 D8) |
| `constraints` | 파일 수 상한, 외부 dep 금지 목록(차트 라이브러리 금지 등 현행 규칙) |
| `qaChecks[]` | 이 Blueprint에서 파생되는 기계 검사 항목: facts 존재, 화면 수, 저장 SDK 유무, 킷 prop 계약 |

## 13. Design System 생성 규칙

| 필드 | 규칙 |
|---|---|
| `palette` | Q5 → `palettes.ts` id. 업종 추천(`recommendedPalettes`)이 첫 선택지. 다크는 시네마틱에서만 추천 |
| `hue`/`accentHex` | 팔레트에서 파생(현행 `hueToRepresentativeHex`) |
| `theme` | cinematic: `decideTheme`(direction-sheet) 재사용. standard: light 고정 |
| `typePreset` | cinematic만(`grotesk/serif/compact`, direction-sheet). LOW — 묻지 않음 |
| `motionLevel` | cinematic만. AI_DEFAULT 'normal'. LOW |
| `world`(스타일 락) | cinematic만. `pickTopWorlds` 재사용, 업종 기본 |
| `imagery` | 사진 정책(실사 인물 금지) 고정. `sceneType`(오브젝트/공간/손…)은 업종 기본, MEDIUM |
| `tokensOverride` | 없음(V1). 킷 `tokens.css`·`coralred-ui.css` 그대로 |

## 14. Blueprint → 코드 생성 연결

1. **직렬화**: `blueprintToPromptLines(bp)` — 현행 `ONBOARDING_ADDITIONS_MARKER` 뒤 줄들을 대체. 형식은 등급 표기 포함: `[확정] 골격: 예약·일정형`, `[확정] 가격: 아메리카노 4,000원`, `[추천] 팔레트: 브라운(카페 기본)`, `[기본] 모션: 보통`. UNKNOWN은 싣지 않는다.
2. **시스템 프롬프트 계약**(`new-prompt.ts`에 절 1개 추가): "`[확정]` 줄은 사실이다 — 생성물에 그대로 있어야 하고 바꾸면 안 된다. `[추천]`은 바꿀 수 있으나 답변 첫 줄에 바꾼 이유를 쓴다. `[기본]`은 자유." 현행 `<app_skeletons>`의 "1단계 요청 문장 먼저 읽기" 규칙은 그대로 두되, 골격 줄이 `[확정]`이면 1단계를 건너뛰고 따른다(충돌은 이미 Discovery에서 해소됐으므로).
3. **트랙 결정은 Blueprint가 한다**: `Chat.client.tsx handleClarificationComplete`의 `cinematic = skeleton===7 || looksLikeShowcasePrompt()`를 `bp.product.track === 'cinematic'`로 교체. 킷 시드·예약 사진·킷 프롬프트 첨부는 그대로.
4. **기계 검사 연결**: `runMechanicalChecks(files, hue)` → `runMechanicalChecks(files, hue, bp?)`. 새 규칙(힌트, 자동 수정 없음): `facts` 문자열이 소스에 없음 → "사용자가 말한 'X'가 화면에 없어요 — 넣으세요". `screens` 수 부족. 저장=none인데 SDK import. 힌트는 자동 검토 LLM에게 감(현행 경로).
5. **자동 검토 프롬프트**: `review-checklist.ts`에 Blueprint 요약을 컨텍스트로 첨부(확정 목록만, 300자 이내).
6. **수정 턴**: `sendMessage`가 매 턴 `[확정]` 줄 요약(짧게)을 시스템 프롬프트 뒤에 붙인다 — 컨텍스트 최적화로 첫 메시지가 잘려도 결정이 살아남게.
7. **저장**: Blueprint는 `IChatMetadata.blueprint`(IndexedDB, `db.ts`)에 저장. 서버 `onboarding_responses`에는 `blueprint jsonb` 컬럼 추가(분석·복구용, V1 이후 서버 `chats`가 생기면 그쪽으로).

## 15. 요구사항 변경 시 영향 분석

사용자가 수정 턴에서 결정을 바꾸면(예: "저장 기능 빼줘", "예약 말고 문의 폼으로"):

1. **감지**: 수정 메시지를 FactExtractor(Haiku, 짧게)에 넣어 Blueprint 필드 변경 후보를 뽑는다. 못 뽑으면 일반 수정 턴.
2. **영향 계산**(결정적, 의존 그래프):
   - `storage` 변경 → dataModel, sampleData, SDK 파일, 저장 관련 화면 문구 → 파일 N개
   - `skeleton` 변경 → screens 전부, navigation, sampleData → 사실상 재생성
   - `audience` 변경 → navigation, 기본 화면, 액션 노출
   - `facts` 변경(가격 등) → 해당 문자열 포함 파일만
   - `palette` 변경 → `--hue`·index.html만
   - `track` 변경 → 재생성
3. **표시**: 변경 확인 카드 — "저장 기능을 빼면: 회원 목록·예약 저장이 이 기기에만 남아요. 파일 4개를 고쳐요. 진행할까요?" 재생성급(skeleton/track)은 "새 앱으로 만드는 게 나아요" + 새 채팅 제안.
4. **적용**: 확인되면 Blueprint 업데이트(source=USER_LOCKED) → 수정 프롬프트에 "바뀐 결정: …, 영향 파일: …"을 명시해 모델이 범위 밖 파일을 건드리지 않게.
5. **기록**: `blueprint.history[]`에 `{ turn, field, from, to, source }`. 되감기(체크포인트)와 함께 복원.

## 16. AI가 사용자 결정을 덮어쓰지 못하게 하는 규칙

1. **프롬프트 레벨**: `[확정]` 줄 = 불변. 시스템 프롬프트에 "`[확정]`을 바꾸거나 빼면 실패"를 CRITICAL로 명시. 실측에서 모델이 "10회권 15만원"을 "10회 기준으로 자연스럽게 조정했어요"라고 바꾼 사례(s20) — 이런 "조정"을 금지.
2. **게이트 레벨**: 기계 검사가 `facts` 존재를 확인(§14-4). 자동 검토·자동 수정 턴에서도 같은 검사 → 검토가 사용자 사실을 지우면 다시 잡힌다.
3. **주입기 레벨**: 예약 사진 주입기처럼 `facts` 재주입기는 두지 않는다(텍스트 컨텍스트가 달라 위험). 대신 게이트 힌트 → LLM 수정.
4. **UI 레벨**: 요약 카드에서 사용자가 편집한 값은 USER_LOCKED. AI_RECOMMENDED를 사용자가 "확인"만 눌러도 USER_PREFERENCE로 승격(본 것이니까).
5. **수정 턴 레벨**: 모델 답변에 "[확정]을 바꿨다"는 문장이 있거나(정규식) 게이트가 facts 소실을 잡으면, 사용자에게 알림 카드("'4,000원'이 화면에서 사라졌어요 — 되돌릴까요?") + 자동 수정 1회.
6. **금지 목록**(프롬프트에 명문): 사용자가 준 이름·숫자·날짜·장소·가격·연락처를 "자연스럽게" 바꾸기, 사용자가 뺀 화면을 "있으면 좋아서" 넣기, 저장 방식 바꾸기, 지어낸 외부 키(결제·API) 넣기.

## 17. V1 범위 (이 명세에서 구현할 것)

| # | 항목 | 크기 |
|---|---|---|
| V1-1 | Blueprint 타입 + 출처 등급 + `blueprintToPromptLines` | 소 |
| V1-2 | FactExtractor(Haiku 1회 + 정규식 폴백): 고유명사·숫자·날짜·장소·가격·연락처·범위 밖 키워드 | 소~중 |
| V1-3 | 질문 엔진(결정적) + 질문 뱅크 20개(§19 중 CRITICAL/HIGH) + 분기 3키 + 예산 5/9 | 중 |
| V1-4 | 충돌 질문(골격 vs 홈페이지 단어), 복합 요청 질문, 범위 밖 한계 카드 | 소 |
| V1-5 | 요약 카드(구조화: 무엇/누가/화면/저장/색/확정 목록/못 하는 것) + 필드 편집 | 중 |
| V1-6 | `handleClarificationComplete` 교체: track·directives를 Blueprint에서 | 소 |
| V1-7 | 시스템 프롬프트 `[확정]/[추천]/[기본]` 계약 절 + 금지 목록 | 소(실생성 검증 필수) |
| V1-8 | 기계 검사 `facts` 존재·저장 SDK 일치 규칙 | 소 |
| V1-9 | Blueprint 저장(IndexedDB metadata) + 수정 턴마다 확정 요약 재첨부 | 소 |
| V1-10 | 시나리오 러너에 Blueprint 경로 추가해 20건 재측정(질문 수·누락률) | 소 |

제외(V1 이후): 사진 업로드 슬롯(Design에서 `hasUserPhotos`만 예약), 영향 분석 자동화 §15(V1은 재생성/부분 수정 판정만), 서버 저장, 재방문 재사용, 딥 브리프 24문항.

## 18. V1 이후

- §15 영향 분석 전체(의존 그래프 + 파일 단위 범위 제한).
- 딥 브리프(`/brief` 챕터 A~G)를 시네마틱 트랙의 **선택형 심화 Discovery**로 흡수: 요약 카드에서 "더 자세히 정하기" → 사진 업로드·무드·레퍼런스·세계관. `direction-sheet.ts`의 `decide()`가 Design/UX Blueprint를 채운다.
- 재방문 재사용(계정 단위 브랜드 프로필), 템플릿 카드 → Blueprint 프리셋.
- Research: 요약 카드 뒤 "업종 카드"(Haiku 1회: 필수 페이지·문구 톤·법적 문구) → Product Blueprint 보강.
- 사용자 사진·로고 업로드 → media slot USER_LOCKED.
- 서버 `chats` + `blueprint` 저장, 팀 공유.
- 질문 문구 A/B(답변률·이탈률 측정).

## 19. 질문 예시 (40개)

형식: `id | 중요도 | 채우는 필드 | 조건 | 질문 → 선택지(첫 번째=추정값) [모름/상관없음 허용]`

**공통(모든 트랙)**
1. `who_uses` | CRITICAL | audience, navigation | 항상 | 누가 쓰나요? → 나 혼자 / 나와 직원이 관리 / 손님·고객도 [모름]
2. `industry` | CRITICAL | industry, skeleton 후보, palette 후보 | 프롬프트에 업종 없을 때 | 어떤 일을 하시나요? → 그리드 11 + 직접 입력 [모름]
3. `skeleton_confirm` | CRITICAL | skeleton | 후보가 2개 이상 또는 프롬프트 충돌 | 핵심은 어느 쪽인가요? → 예약 받기 / 가게 소개 / 둘 다(예약이 중심) / 둘 다(소개가 중심) [모름]
4. `storage` | CRITICAL | storage | 항상(소개형 제외) | 입력한 내용을 저장할까요? → 코랄레드 Cloud로 저장 / 저장 없이(샘플) / 내 Supabase(고급) [모름]
5. `out_of_scope_confirm` | CRITICAL | outOfScope | 범위 밖 키워드 | 앱스토어용 앱은 못 만들지만 링크로 여는 웹앱은 돼요. 이렇게 갈까요? → 네, 웹앱으로 / 아니요 [—]
6. `palette` | HIGH | palette | 항상 | 색은요? → 업종 추천 1 / 나머지 팔레트 / 상관없음
7. `brand_name` | HIGH | facts.brandName | 프롬프트에 상호 없을 때 | 가게(서비스) 이름은요? → 텍스트 [모름 → "이름 자리"로]
8. `contact` | HIGH | facts.contact | 방문자 관점 | 손님이 연락할 수단은요? → 전화 / 카카오 채널 / 문의 폼 / 없음 [상관없음]
9. `hours` | MEDIUM | facts.hours | 방문자 관점 + 매장형 업종 | 영업시간을 넣을까요? → 텍스트 / 나중에 [상관없음]
10. `location` | MEDIUM | facts.address | 매장형 | 주소(오시는 길)를 넣을까요? → 텍스트 / 나중에 [상관없음]

**골격 1 명단·잔액**
11. `balance_kind` | HIGH | coreEntities.member.balance | skeleton=1 | 무엇을 관리하나요? → 남은 횟수 / 적립 포인트(스탬프) / 선불 금액 [모름]
12. `who_adds` | HIGH | keyActions | skeleton=1 | 누가 적립·차감하나요? → 사장님·직원 / 손님이 직접 / 둘 다 [모름]
13. `member_fields` | MEDIUM | coreEntities.member.fields | skeleton=1 | 회원 정보로 뭘 적나요? → 이름·전화 / +메모 / +생일 [상관없음]
14. `menu_too` | HIGH | secondaryScreen | 프롬프트에 "메뉴" | 메뉴판도 같이 넣을까요? → 네, 손님용 메뉴 화면 / 아니요 [—] ← 실측 s04 대책

**골격 2 예약·일정**
15. `slot_unit` | HIGH | reservation.unit | skeleton=2 | 예약은 어떻게 잡나요? → 시간대(30분/1시간) / 날짜만 / 담당자별 시간표 [모름]
16. `confirm_mode` | HIGH | reservation.confirm | skeleton=2 + 방문자 | 손님이 예약하면? → 바로 확정 / 사장님이 확인 후 확정 [모름]
17. `cancel_policy` | MEDIUM | keyActions.cancel | skeleton=2 | 손님이 취소할 수 있게 할까요? → 네 / 전화로만 [상관없음]
18. `staff_list` | HIGH | facts.staff | skeleton=2 + 담당자별 | 담당자(디자이너·선생님) 이름을 알려주세요 → 텍스트 [모름 → 샘플 3명]
19. `services_prices` | HIGH | facts.services | skeleton=2·4 | 서비스와 가격을 몇 개 알려주세요 → 텍스트 [모름 → 샘플]

**골격 3 거래·수지**
20. `categories_fixed` | MEDIUM | coreEntities.tx.categories | skeleton=3 | 수입·지출 분류는? → 기본 8개 / 직접 정하기 [상관없음]
21. `period_view` | MEDIUM | screens.summaryPeriod | skeleton=3·5 | 합계는 어떻게 보나요? → 이번 달 / 이번 주 / 둘 다 [상관없음]

**골격 4 목록·상세**
22. `item_kind` | HIGH | coreEntities.item | skeleton=4 | 무엇을 보여주나요? → 상품 / 매물 / 메뉴 / 작품 / 직접 입력 [모름]
23. `item_action` | HIGH | keyActions.primary | skeleton=4 | 손님이 항목에서 뭘 하나요? → 장바구니·주문 / 문의하기 / 그냥 보기 [모름]
24. `checkout_reality` | CRITICAL | outOfScope | item_action=주문 | 결제는 실제 결제가 아니라 주문 접수(연락)로 만들어요. 괜찮을까요? → 네 / 실제 결제가 꼭 필요 [—] ← 실측 s02 대책
25. `filters` | MEDIUM | screens.list.filters | skeleton=4 | 분류(카테고리)가 있나요? → 텍스트 / 없음 [상관없음]

**골격 5 기록·추이**
26. `record_unit` | HIGH | coreEntities.record | skeleton=5 | 무엇을 매번 적나요? → 숫자 하나(무게·금액) / 여러 항목 / 체크만 [모름]
27. `chart` | MEDIUM | screens.chart | skeleton=5 | 그래프로 볼까요? → 주간 막대 / 월간 선 / 없음 [상관없음]

**골격 6 순위·티어**
28. `score_rule` | HIGH | ranking.rule | skeleton=6 | 순위 기준은요? → 승/패 / 점수 합계 / 직접 입력 [모름]
29. `tiers` | MEDIUM | ranking.tiers | skeleton=6 | 등급을 나눌까요? → S/A/B / 없음 [상관없음]

**골격 7 소개·홍보(시네마틱)**
30. `goal` | CRITICAL | primaryCTA | track=cinematic | 사이트가 딱 하나만 해야 한다면? → 전화 오게 / 찾아오게 / 사게 / 문의 받게 / 포트폴리오 보이게 [모름]
31. `has_photos` | HIGH | media.hasUserPhotos | track=cinematic | 사진이 있나요? → 있어요(올릴게요) / 없어요(만들어 주세요) / 나중에 [—]
32. `one_sentence` | HIGH | copy.statement | track=cinematic | 손님이 당신 가게를 한 문장으로 말한다면? → 텍스트 [모름 → AI 초안]
33. `chapters` | MEDIUM | chapters[3] | track=cinematic | 보여줄 이야기 3개는? → 업종 기본 3개 / 직접 [상관없음]
34. `proof_numbers` | MEDIUM | proof.numbers | track=cinematic | 자랑할 숫자가 있나요? → 텍스트 / 없음(그럼 안 넣어요) [—]
35. `booking_in_site` | HIGH | secondaryScreen | track=cinematic + 프롬프트에 "예약" | 예약은 어떻게 받나요? → 전화만 / 사이트 안 예약 폼 / 카카오 채널 [모름] ← 실측 s01 대책
36. `mood` | MEDIUM | design.mood | track=cinematic | 느낌을 골라주세요(최대 3) → 칩 12 [상관없음]
37. `dark_or_light` | MEDIUM | design.theme | track=cinematic | 밝게, 어둡게? → 업종 추천 / 반대 [상관없음]
38. `motion` | LOW | design.motionLevel | 묻지 않음 | (요약 카드 더 보기) 움직임 → 조용히 / 보통 / 시네마

**연동·기타**
39. `kakao_login` | HIGH | integrations, outOfScope | 프롬프트에 "카카오 로그인" | 카카오 로그인은 키를 받아야 켜져요. 키 없이도 화면은 만들게요 → 네 / 로그인 없이 [—]
40. `unknown_tool` | CRITICAL | purpose | skeleton=null | 한 문장으로, 이 도구는 무엇을 하나요? → 텍스트 [모름 → 되물음 1회 후 중단]

## 20. 현재 CoralRed 코드에서 어디를 교체/재사용할지

현재 흐름(파일·함수·줄 기준, HEAD `bf2f842a`):

```
_index.tsx / Chat.client.tsx
  └ BaseChat "만들기" → setClarifyingPrompt(prompt)
      └ PromptClarification.tsx  (steps q1→q2→q3→q4→q5→summary, 519줄)
          ├ question-bank.ts   Q1_OPTIONS/Q2_OPTIONS/Q3_GRID/Q4_CATEGORIES/SKELETON_NAMES
          ├ mapIndustryToSkeleton.ts  (Q3 직접 입력 → /api/llmcall Haiku, 3s 타임아웃)
          ├ answer-directives.ts buildSkeletonAndPerspectiveDirective / mapQ2ToDirectives / mergeDirectives
          │     → finalPrompt = prompt + ONBOARDING_ADDITIONS_MARKER + "- 줄"들   (텍스트)
          │     → directives {skeleton, industry, hue, connectSupabase, promptAdditions}
          ├ api.onboarding.ts → onboarding_responses(q1..q5)  (분석용, 생성에 무관)
          └ summary: <textarea finalPrompt> + "만들기" → onComplete(finalPrompt, directives)
      └ Chat.client.tsx handleClarificationComplete (1068~1145)
          ├ hue → designScheme
          ├ cinematic = directives.skeleton===7 || looksLikeShowcasePrompt(baseUserPrompt)   ← 오판 지점
          ├ cinematic: prepareSkeleton7Images → promptLines 추가; CINEMATIC_KIT_PROMPT 첨부
          └ generateNewApp(promptToSend, designScheme, cinematic)  (963~1066)
              ├ seedCinematicKit / getBaselineTemplate(hue,{cinematic,darkTheme})
              └ messages [user prompt] [assistant baseline] [user followup(hidden)] → regenerate()
  └ /api/chat → stream-text.ts → new-prompt.ts getFineTunedPrompt(… cinematic)  <app_skeletons> 1072~1201
  └ 스트림 후 reviewGeneratedApp() → runMechanicalChecks(files, hue) → llmcall 검토 → applySkeleton7Images
  └ 수정 턴 sendMessage(): 지시문 재첨부 없음(첫 메시지에만 존재)
/brief.tsx → DeepBrief.tsx(24문항 A~G) → buildDirectionSheet(brief) → JSON 미리보기만. 생성과 미연결.
```

### 20-1. 교체 (REPLACE)

| 현재 | 문제 | 교체안 | 규모 |
|---|---|---|---|
| `PromptClarification.tsx`의 고정 `Step = 'q1'…'q5'\|'summary'`와 `STEP_ORDER` | 질문 집합 고정, 분기 없음, Q4는 생성에 안 흐름 | `useDiscovery(prompt)` 훅이 엔진(§2)에서 다음 질문을 받아 렌더. 화면 컴포넌트(옵션 그리드·진행 바·"만들기")는 재사용 | 중 |
| `answer-directives.ts` → `finalPrompt` 텍스트(`ONBOARDING_ADDITIONS_MARKER` + "- 줄") | 등급 없음, 사실 추출 없음, 수정 턴에서 소실 | `blueprintToPromptLines(bp)`(§14-1). `ONBOARDING_ADDITIONS_MARKER`·`buildSkeletonAndPerspectiveDirective` 문구는 그대로 살려 `[확정]/[추천]` 접두만 붙임 | 소 |
| summary step `<textarea finalPrompt>` | 계획이 텍스트 덩어리, 편집=프롬프트 수정 | 요약 카드(§17 V1-5): 필드 편집 → Blueprint 갱신 → 프롬프트 재직렬화 | 중 |
| `Chat.client.tsx:1113 cinematic = skeleton===7 \|\| looksLikeShowcasePrompt()` | 단어가 온보딩 답을 덮음(s01) | `bp.product.track === 'cinematic'`. `looksLikeShowcasePrompt`는 엔진의 **후보 신호**로 이동(충돌 질문 트리거) | 소 |
| `Chat.client.tsx:1115~1140` 예약 사진·킷 프롬프트 첨부 조건 | 그대로 쓰되 입력을 bp에서 | `bp.technical.media`, `bp.product.track` | 소 |
| `new-prompt.ts <app_skeletons>` "골격 기본값(최후 순위)" 3단계 규칙 | Blueprint가 확정하면 모델이 다시 판단할 이유가 없음 | 규칙 유지 + "골격 줄이 `[확정]`이면 그대로" 1문장. `[확정]/[추천]/[기본]` 계약 절과 금지 목록 신설(§14-2, §16-6) | 소(실생성 검증) |
| `api.onboarding.ts` + `onboarding_responses(q1_…q5_)` | 질문 번호 컬럼, 생성과 무관 | 컬럼 유지(호환) + `blueprint jsonb` 추가. 응답 저장은 요약 카드 "만들기" 시점으로 이동 | 소(SQL 1개) |

### 20-2. 재사용 (KEEP, 입력만 바꿈)

| 파일 | 재사용 방식 |
|---|---|
| `question-bank.ts` `Q1_OPTIONS/Q2_OPTIONS/Q3_GRID/SKELETON_NAMES/SKELETON_DEFAULT_PERSPECTIVE` | 질문 뱅크 §19의 1·2·4번 항목 데이터로 그대로. `Q3_GRID.skeleton/recommendedPalettes`가 AI_RECOMMENDED 근거 |
| `mapIndustryToSkeleton.ts` | 업종 자유 입력 매핑 그대로(엔진의 Resolver에서 호출) |
| `answer-directives.ts buildSkeletonAndPerspectiveDirective`, `mapQ2ToDirectives` 문구 | 직렬화 문장으로 재사용(검증된 문구) |
| `palettes.ts`, `hueToRepresentativeHex` | Design Blueprint palette/hue |
| `direction-sheet.ts` `decideTheme/decideTypePreset/pickTopWorlds/decideSections/planShots/decide/toPromptAdditions` | 시네마틱 Design/UX Blueprint 채우기. `Brief` 타입의 필드 이름(`idea, world, palette, mood, media, brand, proof, copy, contact, chapters, motion`)을 Blueprint의 cinematic 하위 스키마로 **그대로 채택** — 새로 짜지 않음 |
| `brief-schema.ts` `Goal/GOAL_CTA/MOOD_CHIPS/SceneType/Archetype/Section` | §19 30·36번 선택지와 CTA 매핑 |
| `DeepBrief.tsx` 24문항 중 A(4)·B(5)·C(4)·D(3)·F(3) | V1 이후 심화 Discovery 화면(§18). V1에서는 문항 문구만 §19로 이관(goal, one_sentence, has_photos, chapters, proof, mood) |
| `kit-prompt.ts CINEMATIC_KIT_PROMPT`, `skeleton7PromptLines`, `seedKit` | 그대로. 호출 조건만 bp |
| `mechanical-checks.ts runMechanicalChecks` | 시그니처에 `bp?` 추가, 규칙 2개 신설(§14-4). 기존 28 규칙 무변경 |
| `reviewGeneratedApp.ts`, `review-checklist.ts` | Blueprint 확정 요약을 시스템 프롬프트에 첨부 |
| `Chat.client.tsx generateNewApp`, `sendMessage` | generateNewApp 무변경. sendMessage에 확정 요약 재첨부 1곳 |
| `db.ts IChatMetadata` | `blueprint?: Blueprint` 필드 추가(IndexedDB) |
| `tests/benchmark/scenarios/run.ts` | `composeFirstPrompt`를 엔진 경로로 바꿔 20건 재측정(질문 수·누락률 지표 추가) |

### 20-3. 신설 (NEW)

| 파일(제안) | 내용 |
|---|---|
| `app/lib/discovery/blueprint.ts` | 타입(Product/UX/Technical/Design, `Field<T>{value,source,evidence}`), `emptyBlueprint(prompt)`, `blueprintToPromptLines`, `blueprintSummary`(수정 턴용 200자) |
| `app/lib/discovery/facts.ts` | FactExtractor: 정규식(가격 `\d[\d,]*원`, 날짜, 시간, 전화, 주소 키워드) + Haiku 호출(`/api/llmcall`, 3s 타임아웃, 실패 시 정규식만). 범위 밖 키워드 표 |
| `app/lib/discovery/engine.ts` | Resolver + Selector(§2·§5·§6·§8·§9). 순수 함수 `nextQuestion(bp, answers): Question \| null`. spec 테스트 대상 |
| `app/lib/discovery/question-bank.ts` | §19 40개(V1은 CRITICAL/HIGH 20개 활성) |
| `app/lib/discovery/useDiscovery.ts` | 훅: 상태·엔진 호출·"모름/상관없음" 처리 |
| `app/components/chat/DiscoverySummary.tsx` | 요약 카드(§17 V1-5) |
| `app/lib/review/blueprint-checks.ts` | facts 존재·저장 SDK 일치·화면 수 검사 → `runMechanicalChecks`에서 호출 |
| `supabase/migrations/2026…_onboarding_blueprint.sql` | `onboarding_responses add column blueprint jsonb` |

### 20-4. 삭제/보류

- `looksLikeShowcasePrompt`(`skeleton7Images.ts:73`): 삭제하지 않고 엔진의 후보 신호로만. 트랙 확정에서 제거.
- `/brief` 라우트·`DeepBrief.tsx`: V1에서는 링크 없는 현 상태 유지(삭제도 연결도 안 함). V1 이후 §18로 흡수 결정 전까지 `KEEP-REMOVE-REBUILD` UNKNOWN 유지.
- `Q4_CATEGORIES`(연동): 항목은 재사용하되 "DB 저장 전용" 주석의 정책을 바꿔 생성에 흘린다(§10 integrations).

### 20-5. 순서(구현 시)

1. `blueprint.ts` + `blueprintToPromptLines` + 시스템 프롬프트 계약 절 → 기존 5문항 답을 Blueprint로 변환만 하고 프롬프트 출력이 **현재와 동일한 문장**이 되게(회귀 0). 실생성 1런.
2. `facts.ts` + 기계 검사 facts 규칙 → 시나리오 러너로 누락률 측정(s01·s04·s12·s20).
3. 엔진 + 질문 뱅크 20개 + 충돌/복합/범위 밖 질문 → `PromptClarification`을 `useDiscovery`로 교체. 시나리오 러너로 질문 수 분포.
4. 요약 카드.
5. Blueprint 저장 + 수정 턴 재첨부.

각 단계마다 `pnpm run check` + 시나리오 러너 5건.

## 21. 이 명세가 전제한 결정 (사용자 확인)

1. 질문 예산 5/9에 동의하는가(더 적게 원하면 CRITICAL만 3~4개).
2. 복합 요청(예약+소개)에서 "둘 다"를 허용할지, 주 골격 하나만 강제할지.
3. `/brief` 24문항을 V1 이후 시네마틱 심화로 흡수하는 방향에 동의하는가(아니면 폐기).
4. "결제·로그인 완결 불가"를 Discovery 단계에서 미리 말하는 정책(§8 범위 밖 카드)에 동의하는가.
5. 시스템 프롬프트 계약(`[확정]` 불변)이 모델 자유도를 줄여 품질이 떨어질 가능성 — 실생성으로 확인 후 조정.
