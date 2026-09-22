# TESTING — 뭔가 고쳤으면 이걸 돌려라

목적 하나: **A를 고쳤는데 B가 깨졌는지 5분 안에 알기.** 완벽한 커버리지가 아니라 회귀 그물이다.

## 한 줄

```bash
pnpm run check        # typecheck → lint → vitest(전체) → build      (~3분)
pnpm run check:full   # 위 + e2e 스모크(wrangler pages dev + Chromium)  (~5분)
```

둘 다 종료 코드 0이면 커밋해도 된다. 실패하면 **그 실패를 고치거나, 왜 기대를 바꾸는지 커밋 메시지에 쓴다.** 테스트를 지우거나 `skip`으로 넘기는 건 안 된다.

## 층별로

| 층 | 명령 | 잡는 것 | 시간 |
|---|---|---|---|
| 타입 | `pnpm run typecheck` | 잘못된 import, 시그니처 변경, 빠진 prop | 40s |
| 린트 | `pnpm run lint` (`lint:fix`) | 스타일·`no-unused`·prettier. CRLF는 실패 | 30s |
| 유닛 | `pnpm run test` | `**/*.spec.ts` 97파일/890+. 게이트·주입기·기계 검사·Cloud 인증·메터링·킷 export 동기화 | 60s |
| API 계약 | `pnpm run test:api` | `tests/api/routes.contract.spec.ts` — 코랄레드 고유 라우트 14개의 메서드/인증/미설정 경계·응답 필드. 네트워크 0 | 10s |
| 빌드 | `pnpm run build` | Remix/Vite 번들, `?raw` 킷 import, 서버 번들 | 45s |
| E2E 스모크 | `pnpm run test:e2e` | 빌드된 앱을 `wrangler pages dev`로 띄워 실제 Chromium으로: `/api/health`, 랜딩 200, "시작하기"→textarea→"만들기"→온보딩 1·2문항, 정적 에셋 `_routes.json` 우회, `/pricing /guide /terms /privacy /login` 렌더+문구, `/api/models`, 콘솔 치명 에러 0 | 90s |
| E2E 프로덕션 | `pnpm run test:e2e:prod` | 같은 스모크를 `https://coralred.kr`에 (배포 직후 확인용) | 40s |
| 킷 typecheck | `cd kits/cinematic && npm run typecheck` | 킷 소스 타입 | 10s |
| 킷 품질 | `tests/benchmark/cinematic/*` | 렌더·모션·디테일 수치(결정적). `HANDOFF.md §3` | 분 단위 |

CI(`.github/workflows/ci.yaml`): push/PR마다 `test` 잡(build→typecheck→lint→vitest) + `e2e-smoke` 잡. pre-commit 훅 = typecheck+lint, pre-push 훅 = vitest 전체.

## 테스트가 못 잡는 것 (알고 있어라)

- **LLM 출력 품질** — 확률적. 프롬프트·게이트 문구를 바꿨으면 실생성 1런(`HANDOFF.md §6`)이 유일한 확인.
- **실제 외부 호출** — Anthropic/Gemini/Cloudflare/Supabase는 전부 mock 또는 미설정 분기. 키·크레딧·권한 문제는 프로덕션에서만 드러난다 → `test:e2e:prod` + `/api/health`.
- **WebContainer 안** — 생성물이 실제로 `npm run dev` 되는지는 스모크 밖(온보딩 2문항까지만). 킷 렌더는 하네스가 대신 본다.
- **Worker 격리체 메모리** — 로컬 `wrangler pages dev`는 128MB 한도를 재현하지 않는다.
- **보안 경계** — 계약 테스트는 코랄레드 고유 라우트 14개의 401/405만 본다. bolt 잔재 라우트(`export-api-keys`, `git-proxy` 등)가 열려 있는지, "세션 선택" 라우트가 인증 없이 비용을 쓰는지, jobId 덮어쓰기 같은 소유권 문제는 **어떤 테스트도 안 잡는다**(`docs/DOC-VS-CODE-AUDIT-2026-09-22.md`). 잔재를 지우거나 막으면 `routes.contract.spec.ts`에 404/405 기대를 추가해 되살아나지 못하게 할 것.

## 새 기능을 넣을 때 최소 규칙

1. 새 `/api/*` 라우트 → `tests/api/routes.contract.spec.ts`에 405/401/400/미설정 케이스 1블록 추가(패턴 복붙).
2. 새 페이지 → `tests/e2e/smoke.mjs` §5 배열에 `[path, /핵심문구/]` 한 줄.
3. 새 순수 함수(게이트·주입기·파서) → 옆에 `*.spec.ts`. 실측에서 잡은 결함이면 그 입력을 그대로 fixture로.
4. 킷 export 변경 → `sceneOrder.ts`의 `KIT_EXPORTS`/`KIT_FILES`도 — 안 하면 `sceneOrder.spec.ts` 동기화 테스트가 막는다(의도).
5. DB 테이블 추가 → `api.health.ts EXPECTED_TABLES`.

## 실패했을 때

- `typecheck` 실패에 `build/server` 없음이 섞여 있으면 먼저 `pnpm run build`(functions/[[path]].ts가 서버 번들을 import).
- 스모크가 `wrangler pages dev did not come up`: 포트 점유. Windows `taskkill /IM workerd.exe /F`, 또는 `SMOKE_PORT=8891`.
- 스모크가 온보딩에서 멈춤: 문구가 바뀐 것(`누가 쓰나요`, `데이터를 저장할까요`, `손님·고객도 써요`) — `app/lib/onboarding/question-bank.ts`와 맞춘다.
- API 계약이 401→200으로 바뀜: 인증 게이트가 빠진 것. 의도라면 `docs/API.md`도 같이 고친다.
- vitest 소스 문자열 검사(`app/*Audit.spec.ts`)가 ENOENT: 파일을 지운 것 — 해당 `it` 블록도 지운다.
