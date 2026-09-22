# Easy Deep Discovery — 구현 설계 (2026-09-22, HEAD `54bb8c73`)

`docs/DISCOVERY-SYSTEM-SPEC-2026-09-22.md`가 "무엇을"이면 이 문서는 **"어떻게 만드는가"** — 타입, 모듈 API, 알고리즘, 데이터 표, 정확한 삽입 지점(줄 번호), 테스트, 순서. 코드 변경 없음. 구현자는 이 문서만 보고 파일을 만들 수 있어야 한다. 근거 줄 번호는 HEAD `54bb8c73` 기준.

---

## 0. 모듈 지도

```
app/lib/discovery/
  blueprint.ts        타입 + emptyBlueprint + set/get + toPromptLines + summaryLine   (순수, spec 필수)
  facts.ts            FactExtractor: extractFactsRegex + extractFactsLlm + mergeFacts (순수 + fetch 1)
  question-bank.ts    QUESTIONS[] 데이터 + 조건 함수                                    (데이터)
  engine.ts           resolve(bp) / nextQuestion(bp, asked) / applyAnswer(bp, q, a)     (순수, spec 필수)
  branching.ts        골격·관점·트랙 → 질문 집합·화면 집합 표                            (데이터)
  useDiscovery.ts     React 훅: 상태 머신(질문 → 답 → 다음) + 요약 카드 상태             (UI 접착)
app/components/chat/
  PromptClarification.tsx   유지하되 내부를 useDiscovery로 교체(화면 컴포넌트 재사용)
  DiscoverySummary.tsx      신설: 요약 카드
app/lib/review/
  blueprint-checks.ts       신설: facts 존재·저장 SDK 일치·화면 수 → MechanicalFinding[]
app/lib/common/prompts/new-prompt.ts   <blueprint_contract> 절 추가
app/components/chat/Chat.client.tsx   handleClarificationComplete 입력 교체, sendMessage 요약 재첨부
app/lib/persistence/db.ts             IChatMetadata.blueprint
```

의존 방향: `blueprint ← facts, question-bank, branching ← engine ← useDiscovery ← PromptClarification`. `engine`은 React·fetch를 모른다(테스트 가능).

## 1. 타입 (`blueprint.ts`)

```ts
export type Source = 'USER_LOCKED' | 'USER_PREFERENCE' | 'AI_RECOMMENDED' | 'AI_DEFAULT' | 'UNKNOWN';
export type Importance = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface Field<T> {
  value: T | null;
  source: Source;
  /** 어디서 왔나: 'prompt:"…"' | 'q:who_uses' | 'rule:industry-default' | 'summary-edit' */
  evidence?: string;
}

export type SkeletonId = 1 | 2 | 3 | 4 | 5 | 6 | 7;          // question-bank.ts 재사용
export type Audience = 'solo' | 'team' | 'public';           // Q1Value 재사용
export type Storage = 'cloud' | 'none' | 'supabase';         // Q2Value 재사용
export type Track = 'standard' | 'cinematic';

export interface Fact {
  kind: 'brand' | 'price' | 'date' | 'time' | 'place' | 'phone' | 'person' | 'item' | 'count' | 'other';
  text: string;          // 원문 그대로 ("아메리카노 4,000원")
  normalized?: string;   // 검사용 ("4,000원" | "4000")
}

export interface ProductBlueprint {
  purpose: Field<string>;
  skeleton: Field<SkeletonId | null>;      // null = 골격 없음(도구·게임)
  track: Field<Track>;
  audience: Field<Audience>;
  storage: Field<Storage>;
  industry: Field<string>;                 // Q3 라벨 또는 raw
  coreEntities: Field<Array<{ name: string; fields: string[] }>>;
  keyActions: Field<string[]>;
  facts: Field<Fact[]>;                    // 항상 USER_LOCKED (사용자 삭제 외 불변)
  secondaryScreen: Field<string | null>;   // 복합 요청의 부가 화면 이름
  outOfScope: Field<Array<{ asked: string; alternative: string }>>;
  integrations: Field<string[]>;           // Q4 id들
}

export interface UxBlueprint {
  screens: Field<Array<{ id: string; purpose: string; entities: string[]; actions: string[] }>>;
  navigation: Field<'sidebar' | 'bottom-tabs' | 'search-first' | 'scenes'>;
  primaryCTA: Field<string>;
  sampleData: Field<'required' | 'optional' | 'none'>;
  mobileLayout: Field<'cards-2col-max'>;   // V1 상수. 검사 규칙의 근거로만 존재
  copyTone: Field<string>;
}

export interface TechnicalBlueprint {
  stack: Field<'react-vite-spa'>;          // V1 고정
  dataModel: Field<Array<{ collection: string; fields: Array<{ name: string; type: 'string' | 'number' | 'date' | 'bool' }> }>>;
  storageMode: Field<Storage>;             // product.storage 복사(기술 관점 이름)
  media: Field<{ reserved: boolean; hasUserPhotos: boolean; video: boolean; fallback: 'gradient' }>;
  constraints: Field<{ noExternalDeps: string[]; maxFiles: number }>;
  qaChecks: Field<string[]>;               // blueprint-checks가 읽는 규칙 id들
}

export interface DesignBlueprint {
  paletteId: Field<string>;                // palettes.ts id
  hue: Field<number>;
  theme: Field<'light' | 'dark'>;
  typePreset: Field<'grotesk' | 'serif' | 'compact'>;   // cinematic만 의미
  motionLevel: Field<'quiet' | 'normal' | 'cinema'>;
  world: Field<string | null>;             // direction-sheet WorldId
  mood: Field<{ yes: string[]; no: string[] }>;
}

export interface Blueprint {
  version: 1;
  createdAt: string;
  prompt: string;                          // 사용자 원문(불변)
  product: ProductBlueprint;
  ux: UxBlueprint;
  technical: TechnicalBlueprint;
  design: DesignBlueprint;
  asked: string[];                         // 물어본 질문 id 순서
  history: Array<{ at: string; path: string; from: unknown; to: unknown; source: Source }>;
}
```

규칙: `Field.value === null`이면 `source`는 반드시 `UNKNOWN`. `set(bp, path, value, source, evidence)`는 §5 승격/강등 규칙을 강제하고 `history`에 남긴다.

## 2. 출처 등급 상태 머신 (`blueprint.ts set()`)

```
현재 source →  새 source 요청          결과
UNKNOWN     →  아무거나                 허용
AI_DEFAULT  →  아무거나                 허용
AI_RECOMMENDED → AI_DEFAULT            거부(하향 금지, 값 유지)
AI_RECOMMENDED → AI_RECOMMENDED/USER_* 허용
USER_PREFERENCE → AI_*                 거부(LockedFieldError) — 엔진·LLM 경로에서 호출 불가
USER_PREFERENCE → USER_*               허용
USER_LOCKED → USER_LOCKED              허용(사용자 편집만; evidence='summary-edit' 또는 'q:*'만 인정)
USER_LOCKED → 그 외                    거부
```

- `set()`의 호출자는 `origin: 'engine' | 'user' | 'llm'`을 넘긴다. `origin='engine'|'llm'`은 USER_* 필드를 절대 못 만진다(코드 레벨 보장 = 스펙 §16-1의 프롬프트 레벨과 이중).
- "확인만 누름"(요약 카드에서 값 변경 없이 만들기): AI_RECOMMENDED → USER_PREFERENCE로 일괄 승격(`confirmAll(bp)`), AI_DEFAULT는 그대로.

## 3. 질문 데이터 (`question-bank.ts`)

```ts
export interface Question {
  id: string;
  importance: Importance;
  fills: string[];                                  // Blueprint path들 ('product.audience', 'design.paletteId')
  /** 물을 조건. 전부 true여야 후보 */
  askWhen: (bp: Blueprint) => boolean;
  /** 건너뛸 조건. 하나라도 true면 제외 (askWhen보다 우선) */
  skipWhen?: (bp: Blueprint) => boolean;
  /** 선택지 — 첫 번째가 추정값이 되도록 engine이 정렬 */
  options: (bp: Blueprint) => QuestionOption[];
  /** 자유 입력 허용(텍스트) */
  freeText?: { placeholder: string; parse: (text: string) => Partial<Record<string, unknown>> };
  allowUnsure: boolean;                             // "잘 모르겠어요"
  allowAny: boolean;                                // "상관없음"
  /** 같은 필드를 다른 각도로 다시 묻는 질문 id (CRITICAL 모름 재질문) */
  retryWith?: string;
  /** 답 → Blueprint 적용 */
  apply: (bp: Blueprint, answer: Answer) => Blueprint;
  title: (bp: Blueprint) => string;                 // 해요체, 개발 용어 금지
}

export interface QuestionOption { id: string; label: string; hint?: string; value: unknown; recommended?: boolean }
export type Answer = { kind: 'option'; optionId: string } | { kind: 'text'; text: string } | { kind: 'unsure' } | { kind: 'any' };
```

V1 활성 20개(스펙 §19의 CRITICAL/HIGH): `who_uses, industry, skeleton_confirm, storage, out_of_scope_confirm, palette, brand_name, contact, menu_too, balance_kind, who_adds, slot_unit, confirm_mode, staff_list, services_prices, item_kind, item_action, checkout_reality, goal, has_photos, booking_in_site, kakao_login, unknown_tool`(23 — 예산 안에서 선택되므로 개수는 뱅크 크기가 아니라 분기가 정한다).

현행 데이터 재사용: `who_uses.options = Q1_OPTIONS`, `industry.options = Q3_GRID + custom`, `storage.options = Q2_OPTIONS`, `palette.options = PALETTES`(업종 `recommendedPalettes` 첫 번째). 문구는 `question-bank.ts`의 현행 라벨 그대로.

## 4. 분기 표 (`branching.ts`)

데이터로 둔다(코드에 if 없음). 엔진은 이 표만 본다.

```ts
export const SKELETON_QUESTIONS: Record<SkeletonId | 'none', string[]> = {
  1: ['balance_kind', 'who_adds', 'menu_too'],
  2: ['slot_unit', 'confirm_mode', 'staff_list', 'services_prices', 'booking_in_site'],
  3: ['categories_fixed', 'period_view'],
  4: ['item_kind', 'item_action', 'checkout_reality', 'services_prices', 'filters'],
  5: ['record_unit', 'chart'],
  6: ['score_rule', 'tiers'],
  7: ['goal', 'has_photos', 'contact', 'booking_in_site', 'one_sentence', 'chapters', 'proof_numbers', 'mood', 'dark_or_light'],
  none: ['unknown_tool', 'storage'],
};

export const COMMON_BEFORE = ['out_of_scope_confirm', 'who_uses', 'industry', 'skeleton_confirm'];
export const COMMON_AFTER  = ['storage', 'brand_name', 'contact', 'palette'];   // 골격 질문 뒤

export const SKELETON_DEFAULTS: Record<SkeletonId, {
  audience: Audience; navigation: UxBlueprint['navigation']['value']; screens: string[]; actions: string[]; entities: string[];
}> = {
  1: { audience: 'team',   navigation: 'sidebar',      screens: ['home','members','member-detail','add'], actions: ['적립','차감','회원 추가'], entities: ['member'] },
  2: { audience: 'team',   navigation: 'sidebar',      screens: ['home','calendar','booking-detail','new-booking'], actions: ['예약 생성','확정','취소'], entities: ['booking','service','staff'] },
  3: { audience: 'solo',   navigation: 'bottom-tabs',  screens: ['home','history','add'], actions: ['기록','수정','삭제'], entities: ['transaction','category'] },
  4: { audience: 'public', navigation: 'search-first', screens: ['home','list','detail'], actions: ['탐색','장바구니/문의'], entities: ['item','category'] },
  5: { audience: 'solo',   navigation: 'bottom-tabs',  screens: ['home','history','add'], actions: ['기록'], entities: ['record'] },
  6: { audience: 'solo',   navigation: 'bottom-tabs',  screens: ['ranking','match-log','add'], actions: ['결과 입력'], entities: ['player','match'] },
  7: { audience: 'public', navigation: 'scenes',       screens: ['preloader','nav','hero','statement','chapters','showcase','marquee','numbers','contact'], actions: ['CTA'], entities: [] },
};
// SKELETON_DEFAULT_PERSPECTIVE(question-bank.ts)와 audience가 같아야 한다 — spec에서 동기화 검사.

/** 핵심명사 → 골격 후보(new-prompt.ts <app_skeletons> 1단계 표를 코드로) */
export const SKELETON_KEYWORDS: Array<{ re: RegExp; skeleton: SkeletonId; weight: number }> = [
  { re: /예약|스케줄|시간표|일정/, skeleton: 2, weight: 3 },
  { re: /적립|포인트|스탬프|잔액|충전|수강권|횟수/, skeleton: 1, weight: 3 },
  { re: /가계부|수입|지출|매출|정산/, skeleton: 3, weight: 3 },
  { re: /쇼핑몰|상품|메뉴판|카탈로그|매물|목록/, skeleton: 4, weight: 2 },
  { re: /기록|추이|일지|로그|그래프/, skeleton: 5, weight: 2 },
  { re: /랭킹|순위|등급|리그|승패/, skeleton: 6, weight: 3 },
  { re: /소개|홍보|랜딩|브랜드|포트폴리오|홈페이지|사이트|청첩장/, skeleton: 7, weight: 1 },   // 약한 신호 — 단독으로 확정 못 함
];
```

`SKELETON_KEYWORDS`의 골격 7 weight 1이 스펙 §5 "충돌은 질문" 규칙의 데이터 표현: 7만 잡히고 다른 골격 신호가 없을 때만 7이 후보 1위.

## 5. FactExtractor (`facts.ts`)

1단계 정규식(동기, 항상):

| kind | 정규식 | normalized |
|---|---|---|
| price | `/(\d{1,3}(,\d{3})+\|\d+)\s*(원\|만원\|천원)/g` | 숫자만(만원→×10000) |
| date | `/(\d{1,2})월\s*(\d{1,2})일(\s*[월화수목금토일]요일)?/g`, `/\d{4}[-./]\d{1,2}[-./]\d{1,2}/g` | `MM-DD` |
| time | `/(오전\|오후)?\s*(\d{1,2})시(\s*(\d{1,2})분\|반)?/g`, `/\d{1,2}:\d{2}/g` | `HH:MM` |
| phone | `/0\d{1,2}-\d{3,4}-\d{4}/g` | 하이픈 제거 |
| person | `/([가-힣]{2,4})\s*(원장\|셰프\|대표\|선생님\|강사\|디자이너)/g`, 괄호 나열 `/\(([가-힣]{2,4}(,\s*[가-힣]{2,4})+)\)/` | 이름 |
| place | `/([가-힣A-Za-z0-9 ]+)(역\|동\|로\|길\|빌딩\|타워\|홀\|채플\|호텔)\b/g` + "앳/at" 패턴 | 원문 |
| count | `/(\d+)\s*(명\|개\|종\|석\|회)/g` | 숫자 |
| item | 구분자 나열 `A/B/C`, `A·B·C`, `A, B, C`(2~6개, 각 1~6자) | 각각 |

2단계 LLM(비동기, 3초 타임아웃, 실패 무시): `/api/llmcall` `claude-haiku-4-5`, system = "사용자 요청에서 고유명사·숫자·날짜·장소·사람·가격·항목을 JSON 배열로만 추출. 없는 것은 만들지 않는다. 형식: `[{kind, text}]`". 응답 JSON 파싱 실패 → 빈 배열. 범위 밖 키워드는 정규식으로만(`/앱스토어|ios|안드로이드|apk|크롤링|스크래핑|stripe|결제 연동|실제 결제|로그인 구현/i`).

`mergeFacts(regex, llm)`: text 정규화 후 중복 제거(정규식 결과 우선). 결과는 `product.facts`에 `USER_LOCKED`, evidence `prompt:"<원문 조각>"`.

## 6. 엔진 알고리즘 (`engine.ts`)

```ts
export function resolve(bp: Blueprint): Blueprint            // 추정으로 빈 칸 채우기(멱등)
export function nextQuestion(bp: Blueprint): Question | null  // 다음 질문 또는 끝
export function applyAnswer(bp: Blueprint, q: Question, a: Answer): Blueprint
export const BUDGET = { base: 5, max: 9 } as const;
```

### resolve(bp) — 순서 고정, 멱등

1. `facts`가 비어 있으면 `extractFactsRegex(prompt)` → USER_LOCKED. (LLM 결과는 훅이 나중에 `mergeFacts`로 합침.)
2. 범위 밖 키워드 → `product.outOfScope`(USER_LOCKED가 아니라 **AI_RECOMMENDED** — 사용자가 한계 카드에서 확정).
3. 골격 후보: `SKELETON_KEYWORDS` 점수 합 → 1위/2위. `industry`가 있으면 `Q3_GRID.skeleton`을 weight 2로 가산.
   - 1위 점수 ≥3이고 2위와 차 ≥2 → `skeleton`=1위, AI_RECOMMENDED, evidence `rule:keyword:<단어>`.
   - 1위가 7이고 다른 골격 신호 ≥2 → **충돌** 플래그(`skeleton` UNKNOWN 유지, `skeleton_confirm` 트리거).
   - 신호 없음 → UNKNOWN.
4. `track`: `skeleton.value===7`이면 `cinematic`(같은 source). 아니면 `standard`(AI_DEFAULT). **다른 규칙 없음**(단어 휴리스틱 제거).
5. `audience`: UNKNOWN이면 `SKELETON_DEFAULTS[skeleton].audience`를 AI_RECOMMENDED(골격이 있을 때만).
6. `ux.*`: `SKELETON_DEFAULTS`에서 screens/navigation/entities/actions를 AI_DEFAULT. `secondaryScreen`은 골격 2위 신호가 ≥2면 그 골격의 첫 화면을 AI_RECOMMENDED("예약+소개" → `hero-intro`, "메뉴+적립" → `menu`).
7. `storage`: cinematic이면 `none` AI_DEFAULT(소개형은 저장 없음), 아니면 UNKNOWN(질문).
8. `design.paletteId`: `Q3_GRID.recommendedPalettes[0]` AI_RECOMMENDED, 없으면 `coral` AI_DEFAULT. `theme`: cinematic이고 `recommendedPalettes`에 dark → dark AI_RECOMMENDED.
9. `technical.media`: cinematic → `{reserved:true, hasUserPhotos:false, video:false, fallback:'gradient'}` AI_DEFAULT.
10. `technical.dataModel`: `coreEntities` → 컬렉션명 = 영문 소문자 slug(표: member→members, booking→bookings…), 필드는 골격 기본 + facts에서 person/price가 있으면 추가.
11. `technical.qaChecks`: 항상 `['facts-present','storage-sdk-match','screen-count']`; cinematic이면 `+['kit-props','scene-order']`(기존 게이트 id).

### nextQuestion(bp)

```
asked = bp.asked
budget = CRITICAL 미결 있으면 max(9) 아니면 base(5)
if asked.length >= budget → null
order = COMMON_BEFORE ++ SKELETON_QUESTIONS[skeleton ?? 'none'] ++ COMMON_AFTER
for id in order:
  q = QUESTIONS[id]
  if id in asked → continue
  if q.skipWhen?.(bp) → continue
  if !q.askWhen(bp) → continue
  field = 첫 fills
  if importance == CRITICAL and source(field) in {UNKNOWN, AI_DEFAULT} → return q
  if importance == HIGH and source(field) == UNKNOWN → return q
  if importance == MEDIUM and asked.length < base and source(field) == UNKNOWN → return q
  // LOW는 절대 안 물음
return null
```

- `askWhen` 예: `skeleton_confirm.askWhen = bp => bp.product.skeleton.source==='UNKNOWN' && hasConflict(bp)`; `menu_too.askWhen = bp => bp.product.skeleton.value===1 && /메뉴/.test(bp.prompt)`; `checkout_reality.askWhen = bp => bp.ux.primaryCTA.value?.includes('주문')`; `booking_in_site.askWhen = bp => track==='cinematic' && /예약/.test(prompt)`.
- 옵션 정렬: `options(bp)`에서 현재 `Field.value`와 같은 것을 `recommended:true`로 맨 앞.
- "잘 모르겠어요"(CRITICAL): `applyAnswer`가 `q.retryWith`를 `asked`에 넣지 않고 다음 `nextQuestion`이 그 질문을 고르게 한다. 재질문도 모름 → 업종 기본값 AI_RECOMMENDED + `bp.flags.unsure.push(path)`(요약 카드 노란 표시).
- "상관없음": `set(path, 추정값, 'AI_DEFAULT', 'q:<id>:any')`, `asked.push(id)`.

### applyAnswer

`q.apply(bp, a)` → 내부에서 `set(..., 'USER_LOCKED', 'q:<id>')`(option/text) → `resolve()` 재실행(답 하나가 여러 추정을 바꾼다) → `asked.push(q.id)`.

복잡도: 질문 ≤40, 필드 ≤60 — 매 호출 전체 재계산해도 1ms 미만. 캐시 없음.

## 7. 프롬프트 직렬화 (`blueprint.ts toPromptLines`)

출력 형식(현행 `ONBOARDING_ADDITIONS_MARKER` 뒤에 그대로 붙는다):

```
추가로 알려주신 내용:
- [확정] 골격: 예약·일정형 — 판단 순서: (현행 buildSkeletonAndPerspectiveDirective 문장 그대로) 
- [확정] 사용자 관점: 방문자 — (현행 perspectiveLine)
- [확정] 저장: 코랄레드 Cloud(기본 저장 방식)를 씁니다 — 로그인 없이 기기와 무관하게 저장돼요.  (mapQ2ToDirectives 문장)
- [확정] 그대로 써야 하는 것: 아메리카노 4,000원 / 10월 24일 토요일 오후 1시 / 더채플 앳 청담 / 김민준 / 이서연
- [확정] 부가 화면: 손님용 메뉴판 1화면(홈 다음)
- [확정] 못 하는 것: 실제 결제 — 주문 접수(연락)로 대체. 답변 첫 줄에 이 한계를 한 문장으로 말한다.
- [추천] 팔레트: 브라운 (카페 기본)
- [추천] 화면: 홈 / 회원 / 회원 상세 / 추가
- [기본] 샘플 데이터: 필요 (저장 없음)
```

규칙: source별 접두 `USER_LOCKED→[확정]`, `USER_PREFERENCE→[선호]`, `AI_RECOMMENDED→[추천]`, `AI_DEFAULT→[기본]`, UNKNOWN → 줄 없음. 줄 수 상한 14(초과 시 MEDIUM/LOW 필드부터 생략). **현행 5문항만으로 만든 Blueprint의 출력은 현행 `finalPrompt`와 문장이 같아야 한다**(접두 제외) — 이것이 1단계 회귀 기준(§11).

`summaryLine(bp)` (수정 턴 재첨부용, ≤200자): `[확정 요약] 골격 예약·일정형 · 관점 방문자 · 저장 Cloud · 그대로: 4,000원, 10월 24일, 더채플 · 못 함: 실제 결제`.

## 8. 시스템 프롬프트 계약 (`new-prompt.ts`)

`<app_skeletons>` 바로 앞(1071행 부근)에 절 추가:

```
<blueprint_contract>
  메시지 끝 "추가로 알려주신 내용:" 아래 줄은 접두로 구분한다.
  - [확정]: 사용자가 정한 사실. 생성물에 그대로 있어야 하고 바꾸거나 빼면 안 된다. 숫자·이름·날짜·장소·가격을
    "자연스럽게" 조정하지 않는다. [확정] 골격 줄이 있으면 <app_skeletons>의 1단계 판정을 생략하고 그대로 따른다.
  - [선호]: 사용자가 고른 방향. 더 나은 대안이 있어도 바꾸지 말고 답변 끝에 제안만 한다.
  - [추천]/[기본]: 코랄레드가 정한 값. 요청에 더 맞는 게 있으면 바꿔도 되지만 답변 첫 문단에 무엇을 왜 바꿨는지 한 줄로 쓴다.
  - "못 하는 것" 줄이 있으면 답변 첫 문장에서 그 한계를 말한다. 지어낸 API 키·테스트 키·"연동이 끝났어요" 문구 금지.
</blueprint_contract>
```

`<app_skeletons>` 1단계 문장(1073~1075행)에 한 줄: "단, `[확정] 골격:` 줄이 있으면 그 줄이 1단계다."

## 9. 기계 검사 (`blueprint-checks.ts`)

`runBlueprintChecks(files: Record<string,string>, bp: Blueprint): MechanicalFinding[]` — `mechanical-checks.ts:2331 runMechanicalChecks(files, resolvedHue)`에 세 번째 인자 `bp?: Blueprint`를 추가하고 끝에서 호출(자동 수정 없음, 힌트만).

| rule | 조건 | message(LLM에게 가는 힌트 — 자리표시자 금지) |
|---|---|---|
| `facts-present` | `bp.product.facts` 각 항목의 `text` 또는 `normalized`가 `src/**` 텍스트 어디에도 없음 | `사용자가 말한 "아메리카노 4,000원"이 화면 어디에도 없어요 — 메뉴 목록에 그대로 넣으세요` |
| `storage-sdk-match` | storage=none인데 `coralred-storage` import / storage=cloud인데 import 없음 | `저장 없이 만들기로 했는데 저장 SDK를 불러요 — 지우고 state로만 관리하세요` |
| `screen-count` | `bp.ux.screens` 이름(한글 라벨) 중 소스에 없는 것 ≥2 | `계획한 화면 "회원 상세"가 없어요 — 만들거나 계획에서 빼세요` |
| `secondary-screen` | `secondaryScreen` 있는데 소스에 흔적 없음 | `손님용 메뉴판 화면을 넣기로 했는데 없어요` |
| `out-of-scope-claim` | `outOfScope` 있는데 답변 텍스트(파일 아님)에 "연동이 끝났어요/실제 결제" | (답변 검사는 Chat.client에서 정규식 — 파일 검사 아님) |

facts 비교는 공백·쉼표 제거 후 부분 문자열. 오탐 방지: `kind:'other'`는 검사 제외.

## 10. 삽입 지점 (정확한 위치)

| 파일:줄 | 현재 | 변경 |
|---|---|---|
| `app/components/chat/PromptClarification.tsx:31,44-49` `type Step`, `useState` q1~q5 | 고정 5스텝 | `const d = useDiscovery(initialPrompt)`; `d.current`(Question\|null), `d.answer(a)`, `d.bp`, `d.summary`. 화면 분기 `step==='q1'…` → `d.current?.id`별 렌더러 하나(옵션 그리드 공통) + `d.current===null → <DiscoverySummary>` |
| `PromptClarification.tsx:90-115` `buildDirectivesAndConclude` | 지시문 텍스트 조립 | 삭제. `finalPrompt = prompt + MARKER + toPromptLines(bp).join('\n')` |
| `PromptClarification.tsx:196` `onComplete(finalPromptValue, directives)` | `GenerationDirectives` | `onComplete(finalPrompt, bp)` — 타입 변경. `GenerationDirectives`는 어댑터 `toDirectives(bp)`로 유지(다른 호출자 없음 확인: `Chat.client.tsx:1068`만) |
| `PromptClarification.tsx:406-425` summary `<textarea>` | 텍스트 편집 | `<DiscoverySummary bp onEdit onConfirm>`; "고급: 프롬프트 직접 편집" 접기 안에 textarea 유지 |
| `Chat.client.tsx:1068` `handleClarificationComplete(finalPrompt, directives)` | | `(finalPrompt, bp)`. `hueHex = hueToRepresentativeHex(bp.design.hue.value)` |
| `Chat.client.tsx:1113` `const cinematic = directives.skeleton === 7 \|\| looksLikeShowcasePrompt(baseUserPrompt);` | 오판 지점 | `const cinematic = bp.product.track.value === 'cinematic';` |
| `Chat.client.tsx:1115` `if (directives.industry)` | | `if (bp.product.industry.value)` — 나머지 예약·킷 첨부 로직 무변경 |
| `Chat.client.tsx:1068` 직후 | | `chatMetadata.set({ ...chatMetadata.get(), blueprint: bp })` (IndexedDB 저장은 기존 `storeMessageHistory`가 metadata를 같이 쓴다 — `useChatHistory.ts:318` 확인) |
| `Chat.client.tsx:366-378` `body: async () => ({ … designScheme, chatId, … })` | | `blueprintSummary: chatMetadata.get()?.blueprint ? summaryLine(bp) : undefined` 추가 |
| `app/routes/api.chat.ts:41-60` body 타입 | | `blueprintSummary?: string` 받아 `streamText` props로 전달 |
| `app/lib/.server/llm/stream-text.ts:196-216` 시스템 프롬프트 조립 | CONTEXT BUFFER 뒤 | `if (blueprintSummary) systemPrompt += '\n\n' + blueprintSummary` (첫 턴은 메시지에 전문이 있으므로 `messages.length > 3`일 때만) |
| `app/lib/common/prompts/new-prompt.ts:1071` | | `<blueprint_contract>` 절(§8) |
| `app/lib/review/mechanical-checks.ts:2331` | `(files, resolvedHue)` | `(files, resolvedHue, bp?)` + 끝에 `findings.push(...runBlueprintChecks(files, bp))` |
| `app/utils/reviewGeneratedApp.ts:467` `reviewGeneratedApp()` | | `chatMetadata.get()?.blueprint`를 읽어 `runMechanicalChecks`에 전달; `buildReviewSystemPrompt()`(`review-checklist.ts:179`)에 `summaryLine(bp)`를 인자로 넘겨 끝에 첨부 |
| `app/lib/persistence/db.ts:6` `IChatMetadata` | | `blueprint?: Blueprint` |
| `app/routes/api.onboarding.ts` + `lib/cloud/onboardingResponses.ts` | q1~q5 | body에 `blueprint` 추가, insert에 `blueprint` 컬럼. SQL: `alter table onboarding_responses add column if not exists blueprint jsonb` |
| `app/lib/media/skeleton7Images.ts:73 looksLikeShowcasePrompt` | 트랙 판정 | `Chat.client`에서 호출 제거. `branching.ts SKELETON_KEYWORDS`로 흡수 후 함수 삭제(임포터 0 확인 뒤) |
| `tests/benchmark/scenarios/run.ts:75 composeFirstPrompt` | 현행 지시문 | `emptyBlueprint(prompt)` → `resolve` → 시나리오의 q1/q2/skeleton을 `applyAnswer`로 → `toPromptLines`. 지표 추가: `questionsAsked`, `factsMissing` |

삭제 없음(`answer-directives.ts`는 `toDirectives` 어댑터와 문장 상수로 남는다).

## 11. 테스트

**유닛(vitest, 신규 spec 5개)**
- `blueprint.spec.ts`: `set()` 상태 머신 전이표 전부(§2), `toPromptLines`가 **현행 5문항 입력에서 현행 `finalPrompt`와 동일 문장**(접두 제거 비교) — 회귀 기준.
- `facts.spec.ts`: 시나리오 20개 프롬프트(`tests/benchmark/scenarios/scenarios.ts` import)에서 기대 facts 표(s01 "강남", s04 "4,000원", s12 날짜·장소·이름 2, s20 강사 3·가격 2·수업 3).
- `engine.spec.ts`: (a) 결정성 — 같은 입력 두 번 = 같은 질문 순서 (b) 예산 — 어떤 답 조합에서도 `asked.length ≤ 9` (c) 충돌 — "강남 피부과 예약 홈페이지" + industry=병원 → 첫 CRITICAL 질문이 `skeleton_confirm` (d) 범위 밖 — "iOS 앱" → 첫 질문 `out_of_scope_confirm` (e) 시네마틱 — 골격 7 확정 시 `storage` 안 물음 (f) 모름 재질문 1회 상한 (g) `SKELETON_DEFAULTS.audience === SKELETON_DEFAULT_PERSPECTIVE` 동기화.
- `branching.spec.ts`: 표의 질문 id가 전부 `QUESTIONS`에 존재, `fills` 경로가 Blueprint 타입에 존재(키 경로 검사).
- `blueprint-checks.spec.ts`: 픽스처(`tests/fixtures/generated/*.json`)에 facts 넣고 존재/부재 판정.

**시나리오 러너**(실생성, 릴리즈 게이트): 20건에서 `questionsAsked` 분포(중앙값 ≤5, 최대 ≤8), `factsMissing`(현재 4/20 → 목표 0), 빈 화면 0, 렌더 OK ≥18/20.

**e2e 스모크**(`tests/e2e/smoke.mjs` §4): "만들기 → 첫 질문 → … → 요약 카드 '이렇게 만들게요'" 도달 검사로 갱신(현재는 "누가 쓰나요" 고정 문구 — 질문 순서가 바뀌면 `waitForFunction`을 요약 카드 기준으로).

## 12. 구현 순서와 각 단계의 완료 조건

| 단계 | 내용 | 완료 조건 |
|---|---|---|
| 1 | `blueprint.ts` + `toDirectives` 어댑터 + `toPromptLines` + `<blueprint_contract>`. `PromptClarification`은 답을 Blueprint에 넣고 `toPromptLines`로 같은 문장 출력 | `blueprint.spec` 회귀 통과, `pnpm run check`, 실생성 2런(일반·시네마틱)에서 생성물 품질 변화 없음 |
| 2 | `facts.ts` + `blueprint-checks.ts` + `runMechanicalChecks` 3번째 인자 + `Chat.client` metadata 저장 | 시나리오 러너 s01·s04·s12·s20 `factsMissing` 0 |
| 3 | `branching.ts` + `engine.ts` + 질문 뱅크 20 + `useDiscovery` + `PromptClarification` 교체 + `Chat.client:1113` 트랙 판정 교체 | `engine.spec` 전부, 시나리오 20건 질문 수 분포, s01 예약 폼 존재 |
| 4 | `DiscoverySummary.tsx` + 승격 규칙(`confirmAll`) | e2e 스모크 갱신 통과, 사용자 브라우저 확인 1회 |
| 5 | 수정 턴 `summaryLine` 재첨부(`api.chat` body → `stream-text`) + `onboarding_responses.blueprint` | 5턴 뒤 수정 요청에서 `[확정]` 사실 유지(러너 followup 검사) |

각 단계는 독립 배포 가능. 1·2단계는 UI 변화가 없어 사용자에게 보이지 않는다.

## 13. 위험과 대응

| 위험 | 대응 |
|---|---|
| `[확정]` 불변 규칙이 모델 창의성을 눌러 품질 저하 | 1단계에서 접두만 붙이고 실생성 비교. 저하 시 `[확정]`을 facts·골격·저장 3종에만 |
| FactExtractor 오탐(예: "10회권" → count) | 정규식 결과는 요약 카드에 노출돼 사용자가 지울 수 있음. LLM 결과는 정규식과 겹칠 때만 채택(1단계), 이후 완화 |
| 질문 문구가 늘어 이탈 | 예산 5 유지, 추정값 첫 선택지, 진행 바. 러너의 `questionsAsked`로 감시 |
| 요약 카드 편집이 Blueprint를 깨뜨림(타입 불일치) | 편집 가능한 필드만 화이트리스트(팔레트·저장·화면 on/off·facts 삭제·부가 화면) |
| `chatMetadata` 저장 타이밍(첫 턴 chatId 미정) | `Chat.client.tsx:366 ensureChatId()` 뒤에 set — 이미 usage 기록이 같은 문제를 풀어둔 경로 |
| 시네마틱 킷 크래시(실측 D1)는 Discovery로 안 풀림 | 별도 코드 수정(킷 방어) — `SCENARIOS §5-1`. 이 설계의 전제 |
