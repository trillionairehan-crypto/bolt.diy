# CoralRed V1 요구사항 (코드에서 역으로 정리, 2026-09-22, HEAD `67289897`)

**목적**: "지금 코랄레드가 무엇인가"(코드)에서 "V1에서 무엇이어야 하는가"를 역으로 뽑은 문서. 각 단계의 현재 구현·한계·실패 가능성은 전부 코드와 실측에서 나온 것. 판단("V1 필수 / V1 이후")은 이 감사자의 제안이며 **최종 결정은 사용자**. 관련: `HANDOFF.md`(함정), `docs/API.md`(라우트), `docs/KEEP-REMOVE-REBUILD-2026-09-22.md`(정리 판정), `docs/DOC-VS-CODE-AUDIT-2026-09-22.md`(보안).

## 0. 제품 한 줄

한국어 비개발자(소상공인·1인 사업자)가 자기 사업을 말로 설명하면, 코랄레드가 **바로 쓸 수 있는 웹 앱/사이트**를 만들어 미리보기 → 자동 검수 → 배포 → 저장 백엔드까지 한 번에 준다. 도메인 `coralred.kr`. 소개·홍보형은 어워드급(CSSDA 8.5~8.9) 시네마틱 사이트가 목표.

**사용자 페르소나(코드가 전제하는 것)**: 개발 용어를 모르고(`coralred-voice.md` 해요체·개발 용어 금지), 사진·문구가 준비되지 않았고(AI 사진 생성·샘플 데이터), 결제·도메인은 "누르면 되는" 수준을 기대.

## 1. 파이프라인 (현재 코드가 실제로 도는 순서)

```
USER (랜딩 → 로그인/게스트)
 ↓ 1. 사업/앱 설명        프롬프트 1줄 + 온보딩 5문항
 ↓ 2. Research            (없음 — 업종→골격 LLM 매핑이 유일)
 ↓ 3. Planning            directives(골격·관점·저장·연동·팔레트) → 시스템 프롬프트 조립
 ↓ 4. Design              팔레트 12 + coralred-ui.css + (소개형) 시네마틱 킷 + 예약 사진/영상
 ↓ 5. Code Generation     /api/chat 스트리밍 → 파일 write → npm install/dev (WebContainer)
 ↓ 6. Preview             iframe + inspector-script (에러 감지·스크린샷)
 ↓ 7. QA                  기계 검사 → Haiku 텍스트 검토 → Sonnet 시각 검토 → 예약 사진 주입
 ↓ 8. Fix                 자동 수정(무과금 2회) / 사용자 수정 메시지(과금)
 ↓ 9. Deploy              Cloudflare Pages(사용자별 프로젝트) + 배지 + 커스텀 도메인 + ZIP
 ↓ 10. CoralRed Cloud     앱 토큰 발급 → 생성 앱 SDK가 문서 CRUD
 + 횡단: 계정·쿼터·결제, 관측(Sentry/health/usage), 품질 하네스
```

각 단계 표의 "구현" 표기: **완료** / **부분** / **없음**. "실패 가능성"은 실측된 것 우선.

---

### 1. 사업/앱 설명 (입력 수집)

| 항목 | 내용 |
|---|---|
| 입력 | 사용자 프롬프트 1줄(랜딩 textarea, `/templates`·`/examples` 카드는 `?prompt=`/쿠키로 채움) + 온보딩 5문항: Q1 누가 쓰나(본인/관리자/방문자) · Q2 저장(Cloud/없음/내 Supabase) · Q3 업종 그리드(카페·미용·학원·헬스·병원·쇼핑…+직접 입력) · Q4 연동(카카오 등) · Q5 팔레트 |
| 출력 | `answers` 객체 → `answer-directives.ts` `GenerationDirectives{skeleton, perspective, industry, storage, integrations}` + `activePaletteId` |
| API | `POST /api/onboarding`(응답 저장, 분석용) · Q3 직접 입력 시 `POST /api/llmcall`(`mapIndustryToSkeleton`, `INDUSTRY_MAPPING_MODEL`) |
| DB | `P:onboarding_responses`(service role insert, user_id null 허용) |
| 구현 | **완료**. `PromptClarification.tsx`, `lib/onboarding/question-bank.ts`, `answer-directives.ts` |
| 한계 | 문항이 고정 5개·컬럼명이 `q1_…q5_`라 질문을 바꾸면 스키마 의미가 깨짐. 골격 7종(명단·예약·거래·목록·기록·순위·소개) 밖의 앱은 프롬프트 문장에만 의존. 사진·로고·기존 자료 업로드 없음. `/brief` 딥 브리프(24문항)는 만들어졌으나 연결 안 됨 |
| 의존성 | 없음(LLM 매핑만 선택적) |
| 실패 가능성 | **온보딩 단계 전환 20~40초 프리즈**(WebContainer boot가 메인 스레드 점유, 실측·미해결). 업종 매핑 LLM 실패 시 골격 null → 프롬프트만으로 진행(조용히) |
| V1 판정 | **필수**: 5문항 + 프롬프트. 프리즈 해결(boot 지연). **이후**: 딥 브리프, 사진/로고 업로드, 기존 사이트 URL 입력 |

### 2. Research (사업·시장·경쟁 조사)

| 항목 | 내용 |
|---|---|
| 입력/출력 | 없음 |
| 구현 | **없음**. 업종→골격 매핑(`mapIndustryToSkeleton`)과 프롬프트 안의 업종별 힌트(`new-prompt.ts <app_skeletons>`, `look-bibles`/`world-cards` 이미지 재료)가 "조사"의 전부. 웹 검색 라우트(`api.web-search`)는 bolt 잔재로 제거 대상 |
| 한계 | 경쟁 사이트·업계 관행·법적 문구(개인정보 동의 등)를 모델 상식에만 의존 |
| 실패 가능성 | 업종 특화 문구가 일반론으로 나옴(실측: 샘플 데이터 수치 비현실 → `new-prompt.ts` 규칙 4회 강화로 대응) |
| V1 판정 | **이후**. V1은 "골격 7종 × 업종 힌트"로 충분. Research를 넣는다면 온보딩 뒤 1회 LLM 호출로 "업종 카드"(메뉴 예시·문구 톤·필수 페이지) 생성이 가장 싼 형태 |

### 3. Planning (무엇을 만들지 확정)

| 항목 | 내용 |
|---|---|
| 입력 | directives + 프롬프트 + 팔레트 + 트랙 판정(`skeleton===7 \|\| looksLikeShowcasePrompt()` → 시네마틱) |
| 출력 | 최종 사용자 메시지 = 프롬프트 + directive 줄들 + (시네마틱) `skeleton7PromptLines(예약 URL)` + `CINEMATIC_KIT_PROMPT`(11장면 순서). 시스템 프롬프트 = `new-prompt.ts`(빌드 모드, `SKELETON_7_SCREEN_CHECKLIST` 스왑) |
| API | `POST /api/media-images {reserve:true}`(시네마틱일 때 URL 4장+영상 예약 — 생성은 아직 안 함) |
| DB | 없음 |
| 구현 | **완료**. 단, 계획이 사용자에게 보이지 않는다(요약·확인 단계 없음) — 바로 생성으로 감 |
| 한계 | 사용자가 "이렇게 만들 거예요"를 보고 고칠 기회가 없음. 페이지 목록·기능 목록이 프롬프트 안에 암묵적. 다중 페이지 앱 계획 없음(생성물은 SPA 1개) |
| 의존성 | 시네마틱이면 R2 예약(`R2_*`, `GOOGLE_GENERATIVE_AI_API_KEY` 설정 필요 — 미설정이면 503 → 예약 없이 진행) |
| 실패 가능성 | 트랙 오판(소개형인데 일반 앱, 또는 반대) — 실측에서 `looksLikeShowcasePrompt` 휴리스틱 보강함. 예약 실패 시 모델이 스톡 사진 URL을 지어냄(게이트가 잡음) |
| V1 판정 | **필수**: 생성 전 "계획 카드"(만들 페이지·기능·저장 방식·색) 1화면 + "바꾸기/시작" — 지금 코드에 없음, 신규. **이후**: 다중 페이지·사이트맵 편집 |

### 4. Design (디자인 시스템·자산)

| 항목 | 내용 |
|---|---|
| 입력 | 팔레트 id(라이트 11 + 다크 + 미니멀, `palettes.ts`), 트랙, 업종 |
| 출력 | 모든 앱: `design-handoff/coralred-ui.css`(`.cr-*`, `--hue` 토큰) 시드. 시네마틱: `kits/cinematic/src` 21파일 → 생성물 `src/kit/`(Lenis+GSAP 스냅·핀 챕터, WebGL 히어로, three.js 3D, 커서, 그레인·켄번즈), `tokens.css`, 다크면 `<html data-theme="dark">`. 사진: hero+ch1~3(Gemini `gemini-3.1-flash-image` 체이닝) + 히어로 5초 루프 영상(Seedance/Kling) |
| API | `POST /api/media-images`(생성, chat 스트림 종료 뒤), `POST/GET /api/media-video` |
| DB | `P:message_usage`(image_cost/video_cost). R2 `media/<jobId>/{hero,ch1,ch2,ch3}.jpg`, `hero-<provider>.mp4` |
| 구현 | **완료**(킷 v0.4, 구도·모션·라이트 팔레트·모바일 400px·디테일 감사 통과). 예약 사진 e2e는 09-18 마지막 확인 |
| 한계 | 사진은 AI 생성만(사용자 사진 업로드 없음, 실사 AI 인물 금지 정책). 킷은 소개형 전용 — 일반 앱(골격 1~6)은 `coralred-ui.css`만이라 디자인 수준 차이 큼. 팔레트가 색만 정함(타이포·간격은 킷/CSS 고정). 로고 없음(워드마크 텍스트) |
| 의존성 | Gemini 크레딧(선불, 09-22 키 재발급 중), R2, ARK/Kling 키, Google Fonts |
| 실패 가능성 | **Gemini 402 `provider_billing`**(크레딧 소진 — 실측 반복). 생성 240s 타임아웃. **chat 스트림과 동시 호출 시 Worker 격리체 128MB 초과 → 엣지 머신 503 지속**(실측, 순서 조정으로 회피 중). 영상 프로바이더 폴링 실패 502(Cloudflare가 HTML로 덮음) |
| V1 판정 | **필수**: 시네마틱 킷(소개형) + 팔레트 + AI 사진 4장. **필수(신규)**: 사용자 사진·로고 업로드로 예약 슬롯 교체(소상공인은 자기 사진이 있다). **이후**: 영상(비용·실패율 높음 — V1은 옵션/끄기 권장), 일반 골격용 디자인 킷 2번째 |

### 5. Code Generation

| 항목 | 내용 |
|---|---|
| 입력 | 시스템 프롬프트 + 메시지 + 파일맵(baseline: `getBaselineTemplate(hue,{cinematic,darkTheme})` = package.json·vite·`coralred-ui.css`·(킷)) |
| 출력 | AI SDK 데이터 스트림 → `message-parser`(`<boltArtifact>/<boltAction>`) → `action-runner`: 파일 write(20s 타임아웃) → `npm install` → `npm run dev`(WebContainer). 자동 continue(토큰 한도), 스톨 재시도 |
| API | `POST /api/chat`(Anthropic `claude-sonnet-5`, 컨텍스트 최적화, 과금 기록 `ctx.waitUntil`) |
| DB | `P:message_usage`(토큰·모델·is_auto_fix). 채팅 자체는 **IndexedDB**(`useChatHistory`) — 서버 저장 없음 |
| 구현 | **완료**. React+Vite SPA 1개, TypeScript/JSX 혼재 허용(entry 확장자 게이트 있음) |
| 한계 | 서버에 `chats` 없음 → 기기 바꾸면 앱 목록 유실, `deployed_apps.chat_id`가 FK 없는 텍스트. 생성 1회 = 앱 1개(수정은 같은 채팅). 프레임워크 고정(React SPA). **서버 쿼터 없음**(클라이언트 `freeTrial.ts`가 RPC로 셈) |
| 의존성 | Anthropic 키(09-22 재발급 중), WebContainer(브라우저 Chromium 계열, COOP/COEP 헤더), `@webcontainer/api 1.6.1-internal.1` |
| 실패 가능성 | (a) **post-stream stall** "마무리가 안 끝났어요" — 원인 `start:aborted` 미정산, 수정됨(a6f1030e), 디버그 `window.__ckUnsettled()` (b) Anthropic 402/429 → 402 `provider_billing`·한국어 문구 (c) 한 탭 생성 ~7회 뒤 esbuild 사망 `The service was stopped` → 재시작 2회 후 새 탭 안내 (d) 모델 편차(파일 단위 `./kit/X` import, `/hero.jpg` 루트 경로, 지어낸 prop·호스트, 예약 URL 무시) — 전부 게이트가 잡아 자동 수정으로 (e) Vite `Pre-transform error`는 사망 아님(오탐 수정됨) |
| V1 판정 | **필수**: 지금 경로 + **서버 쿼터 강제**(`/api/chat` 앞단) + 서버 `chats`(앱 목록 유실 방지). **이후**: 다중 페이지 라우팅, 프레임워크 선택, 협업 |

### 6. Preview

| 항목 | 내용 |
|---|---|
| 입력 | WebContainer dev 서버 URL |
| 출력 | `Preview.tsx` iframe. `public/inspector-script.js`(iframe 안)가 postMessage로 런타임 에러·Vite 오버레이·스크린샷(`CAPTURE_SCREENSHOT`) 전달. 모바일 뷰 토글, 코드 뷰 |
| API | 없음(`webcontainer.connect.$id`, `webcontainer.preview.$id` 라우트는 WebContainer 브리지) |
| DB | 없음 |
| 구현 | **완료**. 프리뷰 에러 → `setPreviewAlert` → 자동 수정 트리거. iframe 0×0(코드 뷰 열림)이면 스크린샷 건너뜀 |
| 한계 | 브라우저 자원 의존(한 탭 ~7회). 모바일 기기에서 WebContainer 자체가 무거움(`mobileWorkspace` 스토어로 UI만 대응). 공유 링크 없음(배포 전엔 본인만) |
| 의존성 | WebContainer, COOP/COEP |
| 실패 가능성 | dev 서버 사망 감지(`devServerHealth`)는 `The service was stopped`만 — 다른 사망 모드 미검출 가능. 온보딩 중 boot 경합 프리즈 |
| V1 판정 | **필수**: 현재. **이후**: 배포 전 공유 링크(프리뷰 배포), 실기기 QR(Expo 잔재는 제거) |

### 7. QA (자동 검수)

| 항목 | 내용 |
|---|---|
| 입력 | 생성 파일맵 + hue + (가능하면) 스크린샷 |
| 출력 | `runMechanicalChecks`(이모지·색 리터럴·타이포·entry 확장자·시네마틱 장면 순서·킷 prop/export·외부 이미지/영상 호스트·루트 경로·자리표시자 …) → finding + 자동 수정 파일 → Haiku 텍스트 검토(`/api/llmcall`) → Sonnet 시각 검토(스크린샷) → 파일 write → `applySkeleton7Images`(예약 사진 주입·캐시버스터) |
| API | `POST /api/llmcall`(`claude-haiku-4-5` 텍스트, `claude-sonnet-5` 시각) |
| DB | `P:message_usage`(is_auto_fix) |
| 구현 | **완료**. `reviewGeneratedApp.ts`, `mechanical-checks.ts`(2,478줄), `sceneOrder.ts`. 픽스처 spec + 하네스(렌더·모션·디테일 수치, CSSDA 기준값 idle 0.036/휠 394px) |
| 한계 | 정적 검사 한계(실제 렌더는 하네스만, 프로덕션 QA는 스크린샷 1장). 힌트 문구가 LLM에 그대로 감(자리표시자 금지 규칙). 킷 `src/kit/`은 검토 제외. 접근성·SEO·성능(LCP) 검사 없음 |
| 의존성 | Anthropic, 스크린샷은 iframe 가시성 |
| 실패 가능성 | 검토 LLM이 프리뷰를 깨뜨리는 수정(실측: TextReveal children 크래시 — 실제 프리뷰가 BLANK, 소스 게이트만으로 못 잡음 → "실제 프리뷰 열어 확인" 규칙) |
| V1 판정 | **필수**: 현재 3단 + 시네마틱 게이트. **필수(신규, 작음)**: 검토 후 프리뷰 재렌더 확인(에러 0)을 QA 통과 조건에 포함. **이후**: Lighthouse류 성능·접근성, 다중 뷰포트 스크린샷 |

### 8. Fix (자동·수동 수정)

| 항목 | 내용 |
|---|---|
| 입력 | 프리뷰 에러(`previewAlert`) / 사용자 수정 메시지 |
| 출력 | `runAutoFix`: 에러 → 수정 프롬프트(`buildFixPrompt`) → `/api/chat` 무과금 재시도 **2회** → 끝나면 예약 사진 재주입. 사용자 메시지: `sendMessage` → 과금(`generationChargeGate`, 이중 과금 방지 수정됨 836d1a2) |
| API | `POST /api/chat` |
| DB | `P:generation_usage_v2`(클라이언트 RPC `increment_generation_count_v2` — 첫 생성·수정 메시지 모두 1건), `P:message_usage` |
| 구현 | **완료** |
| 한계 | 수정 = 자연어만(요소 클릭 편집 없음, `inspector-script`에 선택 프로토콜 일부 있으나 UI 미노출). 되돌리기는 채팅 체크포인트(IndexedDB, 비최신 체크포인트 되감기 브라우저 미검증). "수정 메시지 차단" 정책은 `feat/access-policy` 브랜치(미병합) |
| 의존성 | Anthropic |
| 실패 가능성 | 자동 수정 2회 실패 → 사용자에게 에러 그대로. 수정이 킷 파일을 건드리면 게이트가 다시 잡음(반복 루프 가능성, 상한 없음 — 실측 미확인) |
| V1 판정 | **필수**: 현재. **필수(정책)**: 수정 메시지 과금 규칙 확정(무료 N회? 유료 플랜만?) — `feat/access-policy` 병합 여부. **이후**: 클릭 편집(텍스트·색·이미지 인라인), 버전 히스토리 UI |

### 9. Deploy (배포·도메인·내보내기)

| 항목 | 내용 |
|---|---|
| 입력 | WebContainer `npm run build` 산출물(base64 파일맵), 프로젝트명(사용자별), (선택) 도메인 |
| 출력 | Cloudflare Pages 프로젝트 생성/업데이트 → `https://<project>.pages.dev`. "Made with Coralred" 배지 주입(무조건), 생성 이미지 URL 도달성 검사(409). 커스텀 도메인 연결·상태 조회(`TODO_IS_PRO_USER=false`로 UI 잠김). ZIP 내보내기(`.env` 제외, `.env.example` 대체). `/apps`에 목록·만료 표시 |
| API | `POST /api/cloudflare-deploy`, `POST/GET /api/cloudflare-domain`, (Cloud면) `POST /api/cloud-set-origin` |
| DB | `P:deployed_apps`(클라이언트 insert, RLS) + RPC `deployed_app_project_owned_by_other`(소유권, **fail-open**). `storage_mode/storage_expires_at` 컬럼은 라이브에 없음(폴백 운영, `…_safe.sql` 미적용) |
| 구현 | **완료**(도메인 UI는 잠김) |
| 한계 | 파일 25MB/배치 20MB·200파일. 사용자당 프로젝트 수 제한 없음(Cloudflare 계정 한도로 터짐). 배지 제거·도메인은 티어 조회가 없어 전부 잠김/무조건. 재배포 = 전체 업로드. 배포 URL은 `*.pages.dev`(브랜드 도메인 아님). 배포된 앱의 삭제 기능 없음(Pages 프로젝트 잔존) |
| 의존성 | `CLOUDFLARE_API_TOKEN`(Pages 쓰기 권한), 계정 ID |
| 실패 가능성 | Cloudflare API 502(HTML로 덮임), 토큰 권한 부족 502, 이미지 미도달 409(Gemini 아직 생성 중일 때 — 순서상 정상), 프로젝트명 충돌 403 |
| V1 판정 | **필수**: 현재 + `…_safe.sql` 적용(만료 표시 정상화) + 배포 앱 삭제. **필수(결제와 묶임)**: 티어 조회 → 배지 제거·도메인 게이트. **이후**: 브랜드 서브도메인(`*.coralred.app`), 증분 배포 |

### 10. CoralRed Cloud (생성 앱 저장 백엔드)

| 항목 | 내용 |
|---|---|
| 입력 | Q2=Cloud 선택 → "저장 기능 켜기"(로그인 필수) |
| 출력 | `cloud_apps` 행 + 앱 토큰(HMAC `appId.iat.sig`, sha256만 저장, 7일 → 배포 시 30일). 생성 앱에 `VITE_CLOUD_API_BASE`/`VITE_CLOUD_APP_TOKEN` `.env` 주입 + `coralred-storage.client-template.js` SDK(collection CRUD, device_key = localStorage UUID, 오프라인 메모리 폴백). 배포 성공 시 `deploy_origin` 등록 |
| API | `POST /api/cloud-provision`, `POST /api/cloud-set-origin`, `GET/POST /api/cloud/:appId/:collection`, `GET/PATCH/DELETE …/:docId` |
| DB | `C:cloud_apps, cloud_documents, cloud_usage, cloud_rate_limit`, RPC `cloud_check_rate_limit`(앱 120/분·기기 60/분, **fail-open**), 트리거 쿼터(문서 수·바이트·컬렉션), `cloud_expire_cleanup`(만료 앱 정리) |
| 구현 | **완료(코드)** / **운영 불가(인프라)**: Cloud Supabase 프로젝트 DNS 해석 불가(일시중지/삭제 추정) → 지금은 "저장 기능 켜기"가 500/503 |
| 한계 | **사용자(방문자) 인증 없음** — 격리는 device_key뿐(같은 사람이 기기 바꾸면 데이터 못 봄, 관리자가 전체 조회 불가). 앱 토큰은 번들 공개값. `Origin`이 `*.pages.dev` 정확 일치 → **커스텀 도메인 앱은 Cloud 사용 불가**. 계정당 앱 5개, `tier='free'`만. 관리자 대시보드(데이터 보기/내보내기) 없음. 탈퇴해도 Cloud 데이터 잔존 |
| 의존성 | Cloud Supabase(별도 프로젝트), `CLOUD_APP_TOKEN_SECRET` |
| 실패 가능성 | 프로젝트 정지(무료 플랜 비활성 7일) — **현재 상태**. RPC 장애 시 레이트리밋 통과. 만료 후 403 → 생성 앱 SDK가 "다시 배포해보세요" 문구 |
| V1 판정 | **필수(결정 선행)**: Cloud 프로젝트 복구 또는 플랫폼 프로젝트로 통합. 방문자 로그인이 필요한 골격(예약·명단·거래)은 device_key 모델로는 부족 → **V1 범위 결정**: (a) V1은 "방문자 로그인 없는 앱"(소개형·본인용)만 Cloud 지원, (b) 또는 Supabase Auth를 생성 앱에 넣는 Cloud v2. 권장 (a). 커스텀 도메인 origin 허용은 도메인 기능과 묶어 필수. **이후**: 관리자 데이터 뷰, 사용자 인증, 파일 업로드(이미지) |

---

## 2. 횡단 요구사항

### 2-1. 계정·쿼터·결제

| 항목 | 내용 |
|---|---|
| 현재 | Supabase Auth(Google·Kakao OAuth, 이메일 OTP). 게스트 월 1건(`localStorage`), Free 계정 월 10건(RPC 단일 소스, 사이드바 `AccountUsageBlock`). 요금제 페이지는 **표시만**(Free 0 / Light 9,900 / Pro 29,900 / Max 79,900원, 월 10/35/100/300건) — PortOne UI·SDK 없음, `api.payment.verify` 호출자 없음, webhook no-op, 티어 테이블 없음. 탈퇴 `api.account-delete`(플랫폼만) |
| 한계 | **쿼터가 서버에서 강제되지 않음**(클라이언트 우회 시 무제한). 결제해도 반영 경로 없음. 티어가 없어 배지·도메인·Cloud tier 전부 잠김/무조건. `feat/access-policy`(게스트 차단, 월 1건 첫 생성만, 수정 차단)가 미병합 |
| 실패 가능성 | 비용 폭주(인증 없는 `/api/chat`·`/api/media-*`). 09-22 키 유출 사고(라우트 삭제됨, 키 재발급 중) |
| V1 필수 | ① 서버 쿼터 강제(세션 필수 + RPC 서버 호출) ② 결제 1종(PortOne 정기결제 또는 단건) → 서버 verify(서버 상수 금액) → `subscriptions` 테이블 → RPC 한도가 티어 참조 ③ 웹훅 서명 검증 ④ 게스트 정책 확정(차단 vs 1건) ⑤ 탈퇴 시 Cloud/R2/Pages 정리 |
| V1 이후 | 연간 결제, 환불 자동화, 팀 계정 |

### 2-2. 관측·운영

| 항목 | 내용 |
|---|---|
| 현재 | Sentry(Pages 미들웨어, PII 제거), `/api/health`(테이블 존재 5개), `message_usage` 원장, 프로덕션 디버그 훅(`window.__ckUnsettled()`, `fetch('/pricing')`×10 + cf-ray), 스모크 `test:e2e:prod` |
| 한계 | 비용 대시보드 없음(원장만). 알람 없음(fail-open 3곳 포함). 마이그레이션 수동 적용 → 드리프트(실제 발생) |
| V1 필수 | 일일 비용 집계 1개(원장 → 표), fail-open → fail-closed + Sentry, 마이그레이션 자동 적용(CI `supabase db push`) |
| V1 이후 | 사용자별 비용 상한 자동 차단, 상태 페이지 |

### 2-3. 품질 하네스·회귀

| 항목 | 내용 |
|---|---|
| 현재 | `pnpm run check`(typecheck·lint·vitest 98/892·build), `check:full`(+e2e 20), 계약 테스트 15, 킷 하네스(렌더·모션·디테일 수치), 실측 로그 `rubric.md`. CI 2잡 |
| 한계 | LLM 출력 품질은 실생성만(확률적). 보안 경계 테스트 없음(잔재 라우트 열림 등) |
| V1 필수 | 실생성 벤치 1세트(프롬프트 5개 × 게이트 통과율)를 릴리즈 게이트로 |

### 2-4. 보안·데이터

| 항목 | 내용 |
|---|---|
| 현재 | 플랫폼 RLS(`auth.uid()=user_id` select, service role 쓰기). Cloud는 서버 전용 service 키. ZIP 내보내기 `.env` 제외. 앱 토큰 sha256 저장 |
| 한계 | `docs/DOC-VS-CODE-AUDIT-2026-09-22.md` C1/H1~H5: 키 유출 라우트(삭제됨), 인증 없는 비용 라우트, jobId 소유 검증 없음(남의 R2 이미지 덮어쓰기), fail-open, 탈퇴 잔존물 |
| V1 필수 | H2·H3·M4 해결. 개인정보 처리방침에 맞는 탈퇴 범위(Cloud 문서·미디어 포함) |

---

## 3. V1 범위 요약

### V1에 반드시 (코드 기준 갭 순)

| # | 요구사항 | 현재 | 갭 크기 |
|---|---|---|---|
| 1 | **보안 사고 마무리**: 키 재발급·Secret 교체·재배포 | 라우트 삭제 완료, 키 교체 대기 | 사용자 작업 |
| 2 | **서버 쿼터 강제 + 미디어 jobId 소유 검증** | 클라이언트만 | 중 |
| 3 | **결제 1종 → 티어 저장 → 한도·배지·도메인 게이트** | 표시만 | 대 |
| 4 | **Cloud 인프라 결정**(복구/통합) + V1 Cloud 범위 = 방문자 로그인 없는 앱 | DNS 불가 | 결정 + 소 |
| 5 | **계획 카드**(생성 전 1화면 확인) | 없음 | 소~중 |
| 6 | **사용자 사진·로고 업로드** → 예약 슬롯 교체 | AI 사진만 | 중 |
| 7 | **온보딩 프리즈 해결**(WebContainer boot 지연) | 20~40초 | 중 |
| 8 | 서버 `chats`(앱 목록 유실 방지) | IndexedDB만 | 중 |
| 9 | 배포 앱 삭제 + `…_safe.sql` 적용 + 커스텀 도메인 origin 허용 | 부분 | 소 |
| 10 | 탈퇴 시 Cloud/R2/Pages 정리, fail-open 제거, 마이그레이션 자동화 | 없음 | 소 |
| 11 | bolt 잔재 제거(`KEEP-REMOVE-REBUILD` §6·§9) | 산재 | 대(기계적) |
| 12 | 실생성 벤치 릴리즈 게이트 | 하네스만 | 소 |

### V1 이후로 미룰 것

- Research 단계(업종 조사·경쟁 분석), 딥 브리프 24문항
- 히어로 영상(비용·실패율) — V1은 옵션 off 권장
- 일반 골격(1~6)용 두 번째 디자인 킷
- 다중 페이지·사이트맵·프레임워크 선택
- 클릭 인라인 편집, 버전 히스토리 UI
- Cloud 사용자 인증·관리자 데이터 뷰·파일 업로드
- 브랜드 서브도메인, 증분 배포, 프리뷰 공유 링크
- 성능·접근성 자동 검사(Lighthouse류)
- 팀 계정, 연간 결제

## 4. 이 문서가 전제한 결정(사용자 확인 필요)

1. V1 대상 앱 유형: 소개·홍보형(시네마틱)이 주력인가, 골격 7종 전부인가? (디자인 킷 투자 방향)
2. Cloud: 복구 vs 플랫폼 통합, 그리고 V1에서 방문자 로그인 없는 앱만 지원하는 데 동의하는가?
3. 게스트 정책: 완전 차단(`feat/access-policy`) vs 월 1건
4. 수정 메시지 과금: 무료 횟수 있나
5. 영상 생성: V1에서 켜나
6. 결제 방식: 정기결제 vs 월 단건
7. `/brief` 딥 브리프 폐기 여부
