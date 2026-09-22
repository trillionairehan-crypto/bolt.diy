# 코랄레드 (Coralred)

코딩을 몰라도 한국어로 요청만 하면 웹사이트와 웹앱을 만들어주는 AI 빌더입니다. [bolt.diy](https://github.com/stackblitz-labs/bolt.diy)(StackBlitz의 오픈소스 프로젝트)를 기반으로 시작해, 한국어 비개발자 사용자를 위한 상용 제품으로 개조했습니다.

- 서비스: https://coralred.kr
- 기본 모델: Claude(Anthropic)
- 실행 환경: WebContainer (브라우저 안에서 돌아가는 Node.js 런타임 — 별도 서버 없이 생성한 코드를 그 자리에서 실행/미리보기)
- 배포 대상: Cloudflare Pages

## 이어서 개발하려면

`HANDOFF.md`부터 읽으세요 — 현재 아키텍처, 생성 한 번의 데이터 흐름, 검증 하네스, 운영 함정, 미병합 브랜치, 다음 할 일. AI 개발자(GPT/Codex)용 규칙은 `AI_HANDOFF.md`, 폴더별 담당·호출자·변경 영향은 `ARCHITECTURE.md`, 회귀 검사는 `TESTING.md`, API 목록은 `docs/API.md`, DB 현황은 `docs/DB-AUDIT-2026-09-22.md`. 과거 작업 보고서는 `docs/reports/`, 실측·사건 로그는 `tests/benchmark/cinematic/rubric.md`.

## 로컬에서 실행하기

```bash
pnpm install
cp .env.example .env.local   # 아래 "환경 변수" 참고해서 채우기
pnpm run dev
```

Node 22 이상이 필요합니다 (`package.json`의 `engines` 참고).

### 환경 변수

`.env.example`이 전체 목록입니다(용도별로 묶여 있고, 각 키가 어느 파일에서 읽히는지 주석으로 적혀 있음). 복사해서 `.env.local`로 쓰세요. 로컬 개발의 최소값은 `ANTHROPIC_API_KEY` + `VITE_PLATFORM_SUPABASE_URL` / `VITE_PLATFORM_SUPABASE_ANON_KEY`이고, 사진·영상 생성(`GOOGLE_GENERATIVE_AI_API_KEY`, `R2_*`)과 결제(`PORTONE_*`), Cloud(`CLOUD_*`)는 해당 기능을 만질 때만 필요합니다. 프로덕션 값은 Cloudflare Pages 대시보드의 환경 변수에만 있습니다.

`.env`, `.env.local`, `.env.production` 등 `.env.*`는 모두 `.gitignore`에 걸려 있어 커밋되지 않습니다(`.env.example`만 추적). 키를 코드나 문서에 붙여넣지 마세요.

## 배포

실제 프로덕션 배포는 Cloudflare Pages입니다.

```bash
pnpm run deploy
```

내부적으로 `pnpm run build` 후 `wrangler pages deploy build/client --branch=coralred`를 실행합니다.

## 주요 구조

```
app/routes/                    Remix 라우트
  _index.tsx                     메인 화면(랜딩 + 채팅)
  chat.$id.tsx                   저장된 채팅 이어보기
  templates.tsx                  템플릿 갤러리
  apps.tsx                       내 앱 대시보드 (로그인 필요)
  pricing.tsx / guide.tsx         요금제 / 이용 가이드 (design-handoff/coralred-ui.css로 스타일링)
  privacy.tsx / terms.tsx         약관 페이지

app/components/chat/           채팅 입력창, 온보딩 설문, 메시지 렌더링
app/components/workbench/      코드 에디터, 미리보기, 터미널, diff 뷰
app/lib/common/prompts/        LLM 시스템 프롬프트
  new-prompt.ts                   메인 생성 모드 (빌드 모드) 시스템 프롬프트
  discuss-prompt.ts               대화 모드(질문/상담 전용, 코드 생성 안 함) 시스템 프롬프트
app/lib/stores/                nanostores 기반 상태 관리 (workbench, chat, auth, terminal 등)
app/lib/onboarding/            채팅 시작 전 온보딩 설문 문항/로직

design-handoff/                브랜드·디자인 정본 문서 (아래 참고)
supabase/migrations/           DB 마이그레이션 SQL — 자동 적용 안 됨, 직접 실행해야 함
```

## design-handoff/ 문서

새 UI 문구나 화면을 작업하기 전에 먼저 참고하세요:

- `coralred-voice.md` — 모든 한국어 UI 문구의 톤·스타일 정본 (해요체, 개발 용어 금지 등)
- `coralred-brand.md` — 브랜드 컬러·타이포그래피
- `design-rules.md` — 디자인 규칙
- `coralred-ui.css` — 코랄레드가 생성하는 앱마다 주입되는 디자인 킷 CSS. AI가 새 앱을 만들 때 이 클래스(`.cr-*`)와 `--hue` 토큰만 쓰도록 시스템 프롬프트에서 강제합니다.

## 자주 쓰는 스크립트

| 명령 | 설명 |
|---|---|
| `pnpm run dev` | 로컬 개발 서버 |
| `pnpm run check` | typecheck → lint → vitest 전체 → build. **뭔가 고쳤으면 커밋 전에 이것.** (~3분) |
| `pnpm run check:full` | 위 + e2e 스모크(`wrangler pages dev` + Chromium) (~5분) |
| `pnpm run build` | 프로덕션 빌드 |
| `pnpm run typecheck` | TypeScript 타입 체크 |
| `pnpm run lint` / `lint:fix` | ESLint |
| `pnpm run test` | vitest 전체 (`test:api` = API 계약만) |
| `pnpm run test:e2e` / `test:e2e:prod` | 브라우저 스모크 — 로컬 빌드 / `https://coralred.kr` |
| `pnpm run deploy` | Cloudflare Pages 배포 |

무엇이 무엇을 잡는지, 실패했을 때 어디를 보는지는 `TESTING.md`. 커밋 시 husky pre-commit 훅이 `typecheck`와 `lint`를, pre-push 훅이 vitest 전체를 실행합니다.

## 되돌릴 기준점

`coralred-v0.1-clean` 태그(같은 이름의 브랜치도 있음)가 "전체 검사 통과 + 문서·DB·테스트 정리가 끝난 상태"입니다. 뭔가 크게 망가지면 여기로 돌아오세요.

```bash
git diff coralred-v0.1-clean --stat        # 기준점 이후 무엇이 바뀌었나
git checkout coralred-v0.1-clean           # 그 상태를 그대로 보기
git reset --hard coralred-v0.1-clean       # 현재 브랜치를 기준점으로 되돌리기 (작업 내용 사라짐 — 확인 후)
```

## bolt.diy와의 관계

이 저장소는 [bolt.diy](https://github.com/stackblitz-labs/bolt.diy)를 포크해 시작했지만, 지금은 코랄레드 전용으로 개조된 별개의 제품입니다. 상위 프로젝트와 더 이상 코드를 주고받지 않으며, 원본의 커뮤니티 운영 문서(기여 가이드, 이슈 템플릿, 릴리스 프로세스 등)와 Electron 데스크톱 앱 빌드, Docker 셀프호스팅 파이프라인은 코랄레드에 해당하지 않아 제거했습니다.
