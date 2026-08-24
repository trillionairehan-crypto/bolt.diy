# overnight5 — 구조 변경 필요/판단 필요 항목 (제안만, 수정 안 함)

## 1. `#FF5330` 하드코딩 나머지 20개 파일 — 개별 판단 필요
Phase 2 사이클 1·2에서 3개 파일(`PromptClarification.tsx`, `Artifact.tsx`, `Messages.client.tsx`)을 고쳤지만, 앱 전체 검색 결과 아래 파일들에 더 남아있음:

- `app/components/chat/BaseChat.tsx`, `app/components/header/Header.tsx` — **랜딩 히어로**, 다크모드 무관하게 항상 코랄이 의도된 설계로 보임(Header.tsx의 `isLanding` 조건부 배경이 이미 이 패턴을 명시적으로 쓰고 있음). 손대면 안 될 가능성이 높음.
- `app/components/ui/Logo.tsx`, `app/components/landing/CoralredHero.tsx` — 브랜드 로고/마케팅 히어로. 마찬가지로 고정색이 맞을 가능성 높음.
- `app/root.tsx` — 브라우저 UI(주소창 등)에 쓰는 `theme-color` meta 태그일 가능성. 고정값이 맞음.
- `app/utils/paletteToHue.ts`, `app/lib/onboarding/answer-directives.ts` — hue↔hex 룩업 테이블 자체. `#FF5330`이 `--hue: 33`의 "대표 hex"로 쓰이는 상수라 여기 있는 건 정상(값 자체가 이 상수를 정의하는 곳).
- `app/routes/privacy.tsx`, `app/routes/terms.tsx`, `app/components/legal/LegalPageLayout.tsx` — 미확인, 로고/헤더 부분일 가능성.
- `app/components/chat/APIKeyManager.tsx`, `ChatBox.tsx`, `ChatErrorBoundary.tsx`, `ModelSelector.tsx`, `StarterTemplates.tsx`, `app/components/deploy/GitHubDeploymentDialog.tsx`, `GitLabDeploymentDialog.tsx`, `app/components/sidebar/HistoryItem.tsx`, `Menu.client.tsx`, `app/components/ui/Slider.tsx`, `app/components/workbench/FileTree.tsx`, `app/utils/globalErrorRecovery.ts` — **미확인, 판단 필요**. 이번 세션에 고친 3개와 같은 "일부만 반응형, 일부만 고정" 패턴일 수도 있고, 의도된 랜딩/브랜드 요소일 수도 있음. 파일마다 문맥을 읽고 "이 UI가 항상 코랄이어야 하는가, 테마를 따라야 하는가"를 개별 판단해야 함 — 일괄 정규식 치환은 위험(랜딩 디자인을 실수로 깨뜨릴 수 있음).

**제안**: 다음 세션에서 파일 하나씩(또는 5개씩 묶어서) "이 요소가 앱 작업 화면 안에 있는가(테마 반응형이어야 함) / 랜딩·마케팅·법률 페이지 안에 있는가(고정 코랄이 맞을 수 있음)"를 먼저 분류한 뒤 착수.

## 2. `GitHubDeploymentDialog.tsx`/`GitLabDeploymentDialog.tsx` 영어 문구 전체 번역
overnight4부터 계속 "범위가 커서" 보류돼온 항목. 이번 세션은 죽은 다크모드 토큰만 정리(커밋 `6d88330`)하고 영어 문구는 그대로 둠. 각각 1000/760줄 내외, GitHub/GitLab 계정이 있어야 쓰는 세미개발자용 화면이라 우선순위는 낮지만, 언젠가는 정리가 필요한 진짜 스코프.

## 3. Pro 티어 게이트 시스템 부재
`CustomDomainConnect.tsx`의 `TODO_IS_PRO_USER = false`(전원 잠금), Made-with 배지 무조건 주입 — 둘 다 서버에 구독/티어 조회 로직 자체가 없어서 발생. `pricing.tsx`(수정 금지 파일)의 PortOne 결제 흐름과 연결되는 더 큰 작업이라 이번 세션 범위 밖.

## 4. 배포/도메인 API 라우트에 사용자 인증·소유권 확인이 아예 없음 (Phase 2, 요금제/결제 감사에서 발견)
`api.cloudflare-domain.ts`(action/loader 둘 다), `api.cloudflare-deploy.ts` 모두 `projectName`을 요청 본문/쿼리에서 그대로 받아 Cloudflare Pages API를 호출할 뿐, 요청자가 로그인했는지·그 프로젝트의 실제 소유자인지 검증하는 코드가 전혀 없음. `CustomDomainConnect.tsx`의 `TODO_IS_PRO_USER` 게이트는 **클라이언트 렌더링만** 막을 뿐이라, `projectName`을 아는 사람이면 누구나 `/api/cloudflare-domain`에 직접 POST해서 커스텀 도메인을 연결하거나 `/api/cloudflare-deploy`로 임의 배포를 트리거할 수 있음(단, `CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_API_TOKEN`이 이 환경에 설정돼 있어야 실제로 동작 — 로컬/이 세션 환경엔 없어서 503으로 막혀있는 것으로 보이나, 프로덕션 환경 변수 설정 여부는 이 세션에서 확인 불가).
- **왜 이번 세션에서 안 고쳤는지**: 이 앱 전체에 사용자별 세션/요청 인증 미들웨어 자체가 없어 보임(다른 API 라우트들도 동일 패턴인지 전수조사 필요) — 이 두 파일만 땜질하면 일관성이 깨지고, "최소 변경" 원칙을 벗어나는 아키텍처 결정(어떤 인증 방식을 쓸지, Supabase 세션 쿠키를 어떻게 서버에서 검증할지)이 필요함.
- **제안**: 아침에 사람이 프로덕션에 `CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_API_TOKEN`이 실제로 설정돼 있는지 먼저 확인. 설정돼 있다면 이 두 라우트(및 비슷한 다른 라우트)에 최소한 "로그인 여부 + 프로젝트 소유권" 확인을 추가하기 전까지는 위험이 실재함 — 우선순위 높게 다룰 것을 권장.
