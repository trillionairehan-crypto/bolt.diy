# KEEP / REMOVE / REBUILD / UNKNOWN 전체 분류 (2026-09-22, HEAD `aecf5a06`)

다음 AI 개발자(GPT/Codex)가 코드베이스를 처음부터 뒤지지 않게 만드는 표. **코드는 건드리지 않았다** — 판정과 근거만. 근거는 전부 이 HEAD에서 grep·빌드·knip·프로덕션 실측으로 확인한 것.

**판정 기준**
- **KEEP** — 코랄레드 실제 사용 경로(랜딩 → 온보딩 → 생성 → 프리뷰 → 자동 검토 → 배포/Cloud/계정). 유지·개선.
- **REMOVE** — bolt.diy 잔재. 코랄레드 사용자 경로에서 도달 불가(`SHOW_DEV_TOOLS=false`) 또는 코드 참조 0. 삭제. **삭제 순서는 §9.**
- **REBUILD** — V1에 필요하지만 지금 구조로는 안 되는 것. 재설계.
- **UNKNOWN** — 사용처·의도를 코드만으로 판단 못 함. GPT가 사용자에게 확인.

"GPT가 할 일" 열은 구체 행동. 관련 문서: `ARCHITECTURE.md`(폴더 담당), `docs/API.md`(라우트 상세), `docs/DB-AUDIT-2026-09-22.md`, `docs/DOC-VS-CODE-AUDIT-2026-09-22.md`(보안 불일치), `docs/AUDIT-2026-09-22.md`(knip 원본).

---

## 1. 주요 폴더

| 항목 | 판정 | 이유 | GPT가 할 일 |
|---|---|---|---|
| `app/routes/` 페이지 (`_index`, `chat.$id`, `apps`, `pricing`, `guide`, `login`, `terms`, `privacy`) | KEEP | 사용자 경로 전부. e2e 스모크가 검사 | 유지 |
| `app/routes/webcontainer.connect.$id.tsx`, `webcontainer.preview.$id.tsx` | KEEP | WebContainer API가 요구하는 인증/프리뷰 브리지 라우트(`@webcontainer/api` 규약). 링크 0이어도 필요 | 건드리지 말 것 |
| `app/routes/templates.tsx`, `examples.tsx` | KEEP | 랜딩 "제품" 링크 → `/templates`, 사이드바 "예시로 시작하기" → `/examples`. `?prompt=`/쿠키로 `Chat.client`에 프롬프트 주입 | 유지. 내용 갱신은 사용자 결정 |
| `app/routes/signup.tsx` | KEEP | 랜딩 nav에서 링크 | 유지 |
| `app/routes/brief.tsx` + `app/components/brief/DeepBrief.tsx` + `app/lib/onboarding/brief-schema.ts`, `direction-sheet.ts` | UNKNOWN | "딥 브리프" 24문항 UI(커밋 979d8f64). 앱 내 링크 0, `entry.server.tsx`가 경로만 특별 취급. `photo-grade.ts`가 `direction-sheet` 타입을 씀 | 사용자에게 "V1 온보딩을 5문항(현재)으로 갈지 딥 브리프로 갈지" 확인. 안 쓰면 라우트·컴포넌트 제거, `direction-sheet` 타입만 남김 |
| `app/routes/git.tsx` + `app/components/git/GitUrlImport.client.tsx` + `app/lib/hooks/useGit.ts` | REMOVE | bolt "Git URL로 가져오기". 링크 0. `useGit`이 부르던 `/api/git-proxy`는 보안 사고로 삭제됨(aecf5a06) → 이미 동작 불가 | 삭제. `GitCloneButton.tsx`(chat)도 함께 |
| `app/components/chat/` | KEEP | 생성 UX 본체. `Chat.client.tsx`(1,666줄)가 오케스트레이션 전부 | 유지. 분리는 REBUILD 후보(§8) |
| `app/components/chat/APIKeyManager.tsx`, `ModelSelector.tsx`, `GitCloneButton.tsx`, `ImportFolderButton.tsx`, `SupabaseConnection.tsx`, `SupabaseAlert.tsx`, `NetlifyDeploymentLink.client.tsx`, `VercelDeploymentLink.client.tsx`, `ProgressCompilation.tsx`, `ThoughtBox.tsx`, `ScreenshotStateManager.tsx`, `ChatBox.tsx` | UNKNOWN | bolt 원본 컴포넌트. `APIKeyManager`·`ModelSelector`는 `BaseChat.tsx:679` `SHOW_DEV_TOOLS`로 숨김. `SupabaseConnection`은 `Header.tsx`/`HeaderActionButtons.client.tsx`가 임포트(사용자 "내 Supabase 연결" — §10-2). `Netlify/VercelDeploymentLink`는 `DeployButton.tsx`가 임포트 | 파일별로 렌더 조건 확인 후 숨김 상태인 것만 REMOVE. Netlify/Vercel 링크는 §6 C와 함께 |
| `app/components/workbench/` | KEEP | 에디터·프리뷰·터미널. `Preview.tsx` ↔ `public/inspector-script.js` postMessage 프로토콜 | 유지 |
| `app/components/workbench/ExpoQrModal.tsx` + `lib/stores/qrCodeStore.ts` + `react-qrcode-logo` | REMOVE | bolt Expo(React Native) 지원. 코랄레드는 웹 앱만 | 삭제 |
| `app/components/@settings/` (64파일) | REMOVE (대부분) | bolt 설정 패널. `ControlPanel.tsx`가 실제로 마운트하는 탭은 **profile, notifications, supabase 3개뿐**. `data, event-logs, features, github, gitlab, mcp, netlify, providers, vercel, settings` 탭은 도달 불가 | `ControlPanel.tsx`·`core/`·`shared/`·`tabs/{profile,notifications,supabase}`만 남기고 나머지 탭 폴더 삭제. 남는 3개도 REBUILD 후보(코랄레드 톤으로) |
| `app/components/deploy/` — `CloudflareDeploy.client.tsx`, `CustomDomainConnect.tsx`, `DeployButton.tsx`, `DeployAlert.tsx`, `deployUtils.ts` | KEEP | 코랄레드 배포 경로 | 유지. `TODO_IS_PRO_USER` 티어 조회는 REBUILD §8 |
| `app/components/deploy/{GitHub,GitLab,Netlify,Vercel}Deploy.client.tsx`, `GitHubDeploymentDialog.tsx`, `GitLabDeploymentDialog.tsx` | REMOVE | bolt 배포 대상. `DeployButton`에서 `SHOW_DEV_TOOLS`로 숨김 | 삭제 + `DeployButton.tsx` 분기 정리 |
| `app/components/{landing,auth,legal,guide,apps,examples,sidebar,header,ui}/` | KEEP | 코랄레드 UI | 유지. `ui/`에 bolt 잔재 컴포넌트가 섞여 있을 수 있음 — 임포터 0인 것만 삭제 |
| `app/components/editor/codemirror/` | KEEP | 코드 뷰 | 유지 |
| `app/lib/.server/llm/` | KEEP | 스트리밍·모델 한도·결제 오류 분류 | 유지 |
| `app/lib/.server/media/` | KEEP | Gemini/Seedream 이미지, Seedance/Kling 영상, R2 | 유지. 인증·jobId 소유 검증은 REBUILD §8 |
| `app/lib/cinematic/`, `app/lib/media/`, `app/lib/review/`, `app/lib/onboarding/`, `app/lib/runtime/`, `app/lib/common/prompts/` | KEEP | 시네마틱 킷 트랙·예약 사진·자동 검토·온보딩·액션 러너·시스템 프롬프트 = 제품 핵심 | 유지 |
| `app/lib/media/look-bibles.ts` | UNKNOWN | 이미지 프롬프트 재료인데 임포터 0(`style-locks`·`world-cards`만 쓰임) | 사용자에게 의도 확인. 안 쓰면 삭제 |
| `app/lib/cloud/` | KEEP | 코랄레드 Cloud(생성 앱 백엔드) + 플랫폼 인증 + 사용량 기록 | 유지. API 계약은 배포된 앱이 의존 — 응답 형식 변경 금지 |
| `app/lib/stores/` — `workbench, files, chat, editor, previews, terminal, theme, auth, cloud, devServerHealth, streaming, sidebar, profile, settings, mobileWorkspace, logs` | KEEP | 코랄레드 상태 | 유지. `settings.ts`·`logs.ts`는 bolt 기능 플래그·이벤트 로그 포함 — 쓰는 필드만 남기는 REBUILD 후보 |
| `app/lib/stores/{github,gitlabConnection,netlify,vercel,mcp,qrCodeStore}.ts` | REMOVE | bolt 연동 상태 | 삭제(§9 순서) |
| `app/lib/stores/supabase.ts` | KEEP | 사용자 "내 Supabase 연결"(생성 앱이 사용자 Supabase를 쓰는 기능) | 유지 |
| `app/lib/hooks/` — `useMessageParser, useShortcuts, useViewport, useReducedMotion, useSettings, useStickToBottom/StickToBottom, useSupabaseConnection, useEditChatDescription` | KEEP | 사용 중 | 유지 |
| `app/lib/hooks/{useGit,useGitHubAPI,useGitHubConnection,useGitHubStats,useGitLabAPI,useGitLabConnection,useDataOperations,useIndexedDB,useLocalModelHealth,useConnectionStatus,useConnectionTest,useFeatures,useNotifications,usePromptEnhancer}` | REMOVE | bolt 설정 패널·연동·로컬 모델·프롬프트 다듬기 전용 | 삭제(§9). `useIndexedDB`는 `useChatHistory`와 별개인지 확인 후 |
| `app/lib/services/cloudflarePages.ts` | KEEP | 배포 본체 | 유지 |
| `app/lib/services/{githubApiService,gitlabApiService,importExportService,localModelHealthMonitor,mcpService}.ts` | REMOVE | bolt | 삭제 |
| `app/lib/persistence/` (`db.ts`, `useChatHistory.ts`, `localStorage.ts`, `lockedFiles.ts`, `chats.ts`, `types.ts`) | KEEP | IndexedDB 채팅 저장 — 앱 목록의 유일한 저장소 | 유지. 서버 `chats` 테이블은 REBUILD §8 |
| `app/lib/supabase/` (`platform-client`, `keyRole`, `platformAuthHeader`, `previewBridge`) | KEEP | 플랫폼 로그인 클라이언트 + 프리뷰 브리지 | 유지 |
| `app/lib/webcontainer/` | KEEP | WebContainer 부팅·인증 | 유지 |
| `app/lib/api/{cookies}.ts` | KEEP | `api.chat` 쿠키 파싱 | 유지 |
| `app/lib/api/{connection,debug,features,notifications}.ts`, `app/lib/utils/serviceErrorHandler.ts` | REMOVE | bolt 설정 패널 백엔드 | 삭제 |
| `app/lib/modules/llm/` — `manager.ts`, `base-provider.ts`, `registry.ts`, `providers/anthropic.ts`, `providers/google.ts` | KEEP | 실제 사용 프로바이더 2개(Anthropic 생성·검토, Google은 이미지 라우트가 아닌 텍스트 모델 목록용) | 유지 |
| `app/lib/modules/llm/providers/` 나머지 20개(cerebras, cohere, deepseek, fireworks, groq, huggingface, hyperbolic, mistral, moonshot, ollama, openai, open-router, openai-like, perplexity, xai, together, lmstudio, amazon-bedrock, github, z-ai) | REMOVE | 프로덕션에 키 없음. `SHOW_DEV_TOOLS=false`라 선택 UI 없음. 단, `[Provider:]` 태그로 서버 호출은 가능(`docs/API.md` M6) | 삭제 + `registry.ts`에서 제거. `PROVIDER_LIST`가 Anthropic(+Google)만 남게. `@ai-sdk/*` dep 함께 |
| `app/utils/` — `reviewGeneratedApp, selectStarterTemplate, coralredKit, featureFlags, logger, constants, mapIndustryToSkeleton, paletteToHue, greeting, relativeTime, utm, diff, markdown, path, buffer, shell, terminal, stacktrace, debounce, promises, react, classNames, fileUtils, projectCommands, folderImport, buildFixPrompt, globalErrorRecovery, easings, mobile, os, url, sampler, unreachable, stripIndent, getLanguageFromExtension, formatSize, fileLocks` | KEEP | 대부분 사용 중 | `githubStats.ts`, `gitlabStats.ts`는 REMOVE. 나머지 임포터 0인 것은 knip으로 재확인 후 |
| `kits/cinematic/` | KEEP | 시네마틱 킷 원본(`?raw`로 번들, 생성물 `src/kit/`) | 유지. export 변경 시 `sceneOrder.ts` 동기화 |
| `functions/` | KEEP | Pages Functions 진입 + Sentry | 유지 |
| `public/` | KEEP | `_routes.json`, `inspector-script.js`, 정적 에셋 | 유지 |
| `design-handoff/` | KEEP | 브랜드·문구 정본, `coralred-ui.css`(생성 앱에 주입) | 유지 |
| `supabase/migrations/` | KEEP | 플랫폼 DB 정본 | 유지. `manual/RUN-*`은 역사 자료 |
| `tests/benchmark/cinematic/`, `tests/skeleton7-dom/`, `tests/fixtures/`, `tests/api/`, `tests/e2e/` | KEEP | 품질 하네스·회귀 그물 | 유지 |
| `tests/benchmark/cssda/` | KEEP | 수상작 측정 도구(기준값 출처) | 유지(데이터 크기 크면 git-lfs 검토) |
| `tests/benchmark/brief/` | UNKNOWN | 딥 브리프 쇼룸 스크린샷 스크립트 — `/brief` 결정과 묶임 | §1 brief 결정 따라 |
| `tests/media/` | KEEP | 이미지·영상 생성 실험 스크립트(비용 발생, 수동) | 유지 |
| `server/preview-server.mjs` | UNKNOWN | 로컬 프리뷰 미러. `package.json` `preview-server` 스크립트가 참조. 문서·하네스에서 쓰는 곳 없음 | 사용자에게 아직 쓰는지 확인. 안 쓰면 스크립트와 함께 삭제 |
| `docs/reports/` | KEEP | 역사 자료(34개). 현재 사실 아님 | 읽지 말 것. 현재 사실은 `HANDOFF.md` |
| `scripts/clean.js` | KEEP | `pnpm run clean`(빌드 산출물·node_modules 정리) | 유지 |

## 2. API 라우트 (`app/routes/api.*.ts`, 51개 → 49개)

| 항목 | 판정 | 이유 | GPT가 할 일 |
|---|---|---|---|
| `api.chat` | KEEP | 생성 본체 | 유지. **서버 쿼터 강제 없음** → REBUILD §8 |
| `api.llmcall` | KEEP | 자동 검토·업종 매핑 | 유지. 인증 없음 → REBUILD §8 |
| `api.media-images`, `api.media-video` | KEEP | 예약 사진·영상 | 유지. 인증·jobId 소유 검증 → REBUILD §8 |
| `api.onboarding`, `api.utm-attribution` | KEEP | 분석 데이터 | 유지 |
| `api.cloud-provision`, `api.cloud-set-origin`, `api.cloud.$appId.$collection[.$docId]` | KEEP | 생성 앱 백엔드. 배포된 앱이 의존 | 응답 형식 변경 금지. 커스텀 도메인 origin 허용은 REBUILD §8 |
| `api.cloudflare-deploy`, `api.cloudflare-domain` | KEEP | 배포·도메인 | 유지 |
| `api.payment.verify`, `api.payment.webhook` | REBUILD | verify는 호출자 없음·금액 검증이 클라이언트 값 의존, webhook은 서명 미검증 no-op. 결제 UI 자체가 없음 | 결제 설계부터(§8 결제) |
| `api.account-delete` | KEEP | 탈퇴 | Cloud/R2 잔존물 삭제 추가(§8) |
| `api.health` | KEEP | 마이그레이션 존재 검사 | 유지 |
| `api.models`, `api.models.$provider`, `api.configured-providers` | REBUILD | bolt 모델 목록. `Chat.client`가 부팅 시 호출하지만 UI는 숨김. 프로바이더 축소 후 정적 응답 1개로 충분 | 프로바이더 REMOVE와 함께 최소화(또는 `Chat.client` 호출 제거) |
| `api.check-env-key` | REMOVE | 어떤 서버 키가 설정됐는지 노출(프로덕션 200) | 삭제 |
| `api.system.diagnostics`, `api.system.git-info`, `api.system.disk-info` | REMOVE | bolt 진단. diagnostics는 토큰 유무 노출, disk-info는 Cloudflare에서 죽은 코드 | 삭제 |
| `api.enhancer` | REMOVE | 프롬프트 다듬기, UI 없음 | 삭제 + `usePromptEnhancer` |
| `api.github-branches`, `api.github-stats`, `api.github-user`, `api.gitlab-branches`, `api.gitlab-projects` | REMOVE | bolt 연동 | 삭제 |
| `api.netlify-deploy`, `api.netlify-user`, `api.vercel-deploy`, `api.vercel-user` | REMOVE | bolt 배포 대상 | 삭제 |
| `api.supabase`, `api.supabase.query`, `api.supabase.variables`, `api.supabase-user` | UNKNOWN | 사용자 "내 Supabase 연결" 기능(생성 앱이 사용자 Supabase 사용)의 서버 측. `SupabaseConnection.tsx`가 렌더되는지·V1에 이 기능을 넣을지에 달림 | 사용자 확인. V1 제외면 4개 + `SupabaseConnection/Alert` + `stores/supabase.ts` + `useSupabaseConnection` 묶어서 REMOVE |
| `api.mcp-check`, `api.mcp-update-config` | REMOVE | MCP 도구(bolt). UI 삭제됨 | 삭제 + `mcpService.ts`, `stores/mcp.ts`, `@modelcontextprotocol/sdk`, `@ai-sdk/mcp` |
| `api.update` | REMOVE | bolt 자체 업데이트 안내 | 삭제 |
| `api.web-search` | REMOVE | 웹 검색(UI 삭제됨) | 삭제 |
| `api.export-api-keys`, `api.git-proxy.$` | REMOVE (완료) | 2026-09-22 보안 사고로 삭제(aecf5a06). 계약 테스트가 재생 차단 | 되살리지 말 것 |

## 3. Dependencies (`package.json`)

임포터 수는 `app/ functions/ tests/ 설정` 기준 `from '<pkg>'` grep(동적 `import()`는 별도 확인).

| 항목 | 판정 | 이유 | GPT가 할 일 |
|---|---|---|---|
| `react, react-dom, @remix-run/{cloudflare,cloudflare-pages,react}, remix-island, remix-utils, isbot, vite-tsconfig-paths, @remix-run/dev, vite, unocss, @unocss/reset, typescript, vitest, wrangler, husky, lint-staged, prettier, @blitz/eslint-plugin` | KEEP | 프레임워크·빌드·검사 | 유지 |
| `ai, @ai-sdk/anthropic, @ai-sdk/provider, @ai-sdk/react` | KEEP | LLM 스트리밍 | 유지 |
| `@ai-sdk/google` | KEEP | Google 프로바이더(텍스트). 이미지 라우트는 REST 직접 호출이라 무관 | Google 텍스트 모델을 안 쓰기로 하면 REMOVE |
| `@ai-sdk/openai` | UNKNOWN | 임포터 11 — `base-provider.ts`가 OpenAI-호환 클라이언트 생성에 씀. 프로바이더 20개 삭제 후에도 base가 참조하면 남음 | 프로바이더 축소 후 `base-provider.ts` 정리하며 판단 |
| `@ai-sdk/{amazon-bedrock,cerebras,cohere,deepseek,fireworks,mistral,mcp}`, `@openrouter/ai-sdk-provider`, `ollama-ai-provider-v2`, `@modelcontextprotocol/sdk`, `zod`(mcpService만) | REMOVE | 미사용 프로바이더·MCP 전용 | 프로바이더 파일 삭제와 같은 커밋에서 제거. `zod`는 다른 임포터 없으면 |
| `@supabase/supabase-js` | KEEP | 플랫폼·Cloud | 유지 |
| `@webcontainer/api` | KEEP | 프리뷰 런타임 | 유지(버전 고정 `1.6.1-internal.1` — 올리지 말 것, 함정 기록 없음 → UNKNOWN 이유) |
| `@codemirror/*`, `@uiw/codemirror-theme-vscode`, `@lezer/highlight`(동적 import 확인 필요) | KEEP | 코드 뷰. `@codemirror/lang-*`는 `languages.ts`에서 동적 import 14곳 | 유지 |
| `@xterm/*` | KEEP | 터미널 | 유지 |
| `nanostores, @nanostores/react` | KEEP | 상태 | 유지 |
| `zustand` | REMOVE | `stores/mcp.ts`, `stores/settings.ts`만. MCP 삭제 후 settings를 nanostores로 | MCP 제거 후 |
| `framer-motion` | KEEP | 51 임포터(코랄레드 UI 포함) | 유지 |
| `lucide-react` | KEEP | 65 임포터 | 유지(잔재 삭제 후 사용량 감소) |
| `@heroicons/react, @phosphor-icons/react, react-icons, @iconify-json/svg-spinners, @iconify-json/ph` | REMOVE | iconify(`i-ph:*`) 사용 중. heroicons/react-icons 임포터는 삭제 대상 탭뿐 | `@settings` 삭제와 함께 |
| `@radix-ui/react-{dialog,dropdown-menu,tooltip,tabs,checkbox,collapsible,context-menu,label,popover,scroll-area,separator,switch}` | KEEP | `ui/` 컴포넌트 | 유지. `react-progress`는 임포터 0 → REMOVE |
| `@headlessui/react` | KEEP | `Workbench.client.tsx` | 유지 |
| `react-toastify` | KEEP | 48 임포터 | 유지 |
| `react-markdown, remark-gfm, rehype-raw, rehype-sanitize, unified, unist-util-visit, shiki` | KEEP | 채팅 마크다운·코드 블록 | 유지 |
| `react-resizable-panels, react-window, react-dnd, react-dnd-html5-backend, diff, istextorbinary, ignore, jszip, file-saver, mime, @noble/hashes, aws4fetch, chalk, path-browserify, js-cookie, date-fns, class-variance-authority, dotenv, vite-plugin-node-polyfills` | KEEP | 워크벤치·배포·R2·로거 등 사용 중 | 유지. `date-fns`는 임포터가 netlify 탭 3곳뿐 → @settings 삭제 후 REMOVE |
| `@octokit/rest` | UNKNOWN | `GitHubDeploymentDialog`(REMOVE)와 `stores/workbench.ts`(bolt "GitHub에 푸시") | `workbench.ts`의 GitHub 푸시 코드 제거 후 REMOVE |
| `isomorphic-git` | REMOVE | `useGit`만 | `git.tsx` 삭제와 함께 |
| `react-qrcode-logo` | REMOVE | Expo QR | 삭제 |
| `chart.js, react-chartjs-2, jspdf, react-beautiful-dnd, @types/react-beautiful-dnd, @tanstack/react-virtual, use-debounce, react-hotkeys-hook, clsx, tailwind-merge, jose, @ai-sdk/ui-utils, @octokit/types, rollup-plugin-node-polyfills, @remix-run/node` | REMOVE | 임포터 0(knip + grep 일치). chart/jspdf는 삭제 대상 `@settings/data`·`event-logs`만 | 제거(lockfile 커밋 별도, 빌드 확인) |
| `@portone/browser-sdk` | REMOVE | 임포터 0. 결제 UI 자체가 없음 | 제거. 결제 만들 때 다시 추가 |
| `@sentry/remix, @sentry/cloudflare` | KEEP | 에러 수집 | 유지 |
| `sass-embedded` | KEEP | `.module.scss` 컴파일 | 유지 |
| `playwright, sharp, @vitejs/plugin-react` | KEEP | 하네스·e2e·킷 렌더 | 유지 |
| `jsdom` | KEEP | vitest 환경 | 유지 |
| `@electron/notarize, @types/electron` | REMOVE | Electron 제거됨 | 제거 |
| `@testing-library/{react,jest-dom}, @types/dom-speech-recognition, cross-env, crypto-browserify, stream-browserify, is-ci, node-fetch, rimraf, pnpm, vite-plugin-copy, @remix-run/serve, eslint-config-prettier, eslint-plugin-prettier, rollup-plugin-visualizer, vite-plugin-optimize-css-modules, fast-glob, @cloudflare/workers-types, @types/*` | UNKNOWN | knip 후보지만 설정 파일·스크립트에서 쓰일 수 있음(`rollup-plugin-visualizer`·`optimize-css-modules`·`fast-glob`은 vite/uno 설정이 씀 = KEEP) | `package.json scripts`·`vite.config.ts`·`eslint.config.mjs` grep 후 참조 없는 것만 제거. `@types/*`는 대응 dep 삭제와 같이 |

## 4. DB 테이블 / RPC

플랫폼 Supabase(라이브 실측 09-22) + Cloud Supabase(DNS 불가, 리포 SQL 기준).

| 항목 | 판정 | 이유 | GPT가 할 일 |
|---|---|---|---|
| `generation_usage_v2` + RPC `get_generation_status_v2`, `increment_generation_count_v2` | KEEP | 월 한도 단일 소스(클라이언트 `freeTrial.ts`가 호출) | 유지. **서버 강제**는 REBUILD §8 |
| `generation_usage_v2.period_day, day_count` | REMOVE | 0831에서 폐지, RPC가 죽은 컬럼 갱신 중 | `…_destructive.sql.pending` D항목(사용자 승인 후) |
| `generation_usage_v2.carryover_count` | UNKNOWN | "예약" 컬럼, 코드 참조 0 | 사용자에게 이월 정책 있는지 확인 |
| `message_usage` | KEEP | 토큰·미디어 비용 원장 | 유지. 인덱스는 `…_safe.sql` |
| `deployed_apps` + RPC `deployed_app_project_owned_by_other` + 트리거 `set_deployed_apps_user_id` | KEEP | 배포 소유권 | `storage_mode/storage_expires_at` 추가는 `…_safe.sql` 적용. RPC anon execute는 REBUILD §8 |
| `deployed_apps.supabase_connected` | REMOVE | `storage_mode='supabase'`와 동일 의미, 코드 참조 0 | destructive.pending |
| `onboarding_responses` | KEEP | 온보딩 분석 | `supabase/migrations/`에 정본 추가(지금은 `manual/RUN-5`만) |
| `utm_attribution` | KEEP | UTM 1회 기록 | 유지 |
| `user_generation_usage` + RPC `get_generation_count`, `increment_generation_count` | REMOVE | v1 메터링 잔재, 코드 참조 0 | destructive.pending |
| RPC `rls_auto_enable` | REMOVE | 리포 정의 없음, 참조 0(대시보드 유틸 추정) | destructive.pending |
| Cloud `cloud_apps, cloud_documents, cloud_usage, cloud_rate_limit` + RPC `cloud_check_rate_limit`, 트리거 `cloud_enforce_quota`, `cloud_track_usage_*`, `cloud_expire_cleanup` | KEEP | 생성 앱 백엔드 | 유지. **프로젝트 자체가 DNS 불가** → 사용자 확인(#1). 정본을 `supabase/migrations/cloud/`로 |
| `cloud_apps.tier` | REBUILD | `'free'`만. 요금제 테이블 없음 | 결제 설계와 함께 |
| 서버 `chats` 테이블 | REBUILD(신설) | 채팅이 IndexedDB에만 있어 기기 바꾸면 앱 목록 유실. `deployed_apps.chat_id`·`message_usage.chat_id`가 FK 없이 텍스트 | V1 전 설계(`DB-AUDIT §5-2`) |
| `plans / subscriptions` | REBUILD(신설) | 결제 반영 경로 전제 | 결제 설계 |

## 5. `@settings` 탭

| 항목 | 판정 | 이유 | GPT가 할 일 |
|---|---|---|---|
| `tabs/profile` | KEEP→REBUILD | `ControlPanel`이 마운트. bolt 스타일 UI | 코랄레드 계정 화면으로 재구성(닉네임·탈퇴 = `api.account-delete`) |
| `tabs/notifications` | UNKNOWN | 마운트되지만 bolt 알림(업데이트·연결 상태) 모델 | 코랄레드 알림이 정의되기 전까지 비움 또는 제거 |
| `tabs/supabase` | UNKNOWN | 사용자 "내 Supabase 연결" 설정. §2 `api.supabase*` 결정과 묶임 | 사용자 확인 |
| `tabs/{data,event-logs,features,github,gitlab,mcp,netlify,vercel,providers,settings}` | REMOVE | 도달 불가(`ControlPanel` case에 없음) | 삭제 |
| `core/`, `shared/`, `utils/` | KEEP(축소) | 패널 뼈대 | 남는 탭이 쓰는 것만 |

## 6. Bolt 잔재 총목록 (한 번에 지우는 묶음)

| 묶음 | 파일/모듈 | 판정 |
|---|---|---|
| A. 설정 패널 | `@settings/tabs/{data,event-logs,features,github,gitlab,mcp,netlify,vercel,providers,settings}` + `lib/api/{connection,debug,features,notifications}` + `lib/hooks/{useConnectionStatus,useConnectionTest,useFeatures,useNotifications,useDataOperations,useIndexedDB,useLocalModelHealth}` + `lib/services/{importExportService,localModelHealthMonitor}` + `lib/stores/logs.ts`(이벤트 로그 부분) | REMOVE |
| B. Git/GitHub/GitLab | `routes/git.tsx`, `components/git/`, `components/chat/GitCloneButton.tsx`, `components/deploy/{GitHub,GitLab}*`, `lib/hooks/{useGit,useGitHub*,useGitLab*}`, `lib/services/{githubApiService,gitlabApiService}`, `lib/stores/{github,gitlabConnection}`, `utils/{githubStats,gitlabStats}`, `api.github-*`, `api.gitlab-*`, `workbench.ts`의 `pushToRepository`(Octokit), deps `isomorphic-git @octokit/*` | REMOVE |
| C. Netlify/Vercel | `components/deploy/{Netlify,Vercel}Deploy.client.tsx`, `lib/stores/{netlify,vercel}`, `api.netlify-*`, `api.vercel-*` | REMOVE |
| D. MCP/웹검색/프롬프트 다듬기 | `lib/services/mcpService.ts`, `lib/stores/mcp.ts`, `api.mcp-*`, `api.web-search`, `api.enhancer`, `lib/hooks/usePromptEnhancer`, deps `@modelcontextprotocol/sdk @ai-sdk/mcp zustand zod` | REMOVE |
| E. 프로바이더 20개 | `lib/modules/llm/providers/*`(anthropic·google 제외), `registry.ts` 항목, `components/chat/{APIKeyManager,ModelSelector}`, `api.check-env-key`, deps `@ai-sdk/*`(anthropic/google/provider/react/openai? 제외) | REMOVE |
| F. 시스템/업데이트/Expo | `api.system.*`, `api.update`, `components/workbench/ExpoQrModal`, `lib/stores/qrCodeStore`, dep `react-qrcode-logo` | REMOVE |
| G. 이미 삭제됨 | `api.export-api-keys`, `api.git-proxy.$`(aecf5a06), 채팅 죽은 컴포넌트 5개·ui 3개·workbench 2개·lib 5개(c645cf35), `.env.production`, `scripts/update-imports.sh`(f8e5f268) | — |
| H. 유지 결정 필요 | `api.supabase*` + `SupabaseConnection` + `stores/supabase`(사용자 Supabase 연결), `api.models*`(부팅 호출), `lib/stores/settings.ts`(bolt 기능 플래그 + 코랄레드 테마 혼재) | UNKNOWN |

예상 효과(감사 문서 추정): 파일 -120±, 줄 -1.2만, dep -25, `console.log` 132 → ~10, 인증 없는 잔재 라우트 0.

## 7. 외부 서비스 연동

| 서비스 | 판정 | 이유 | GPT가 할 일 |
|---|---|---|---|
| Anthropic API(`ANTHROPIC_API_KEY`) | KEEP | 생성·검토 | **키 재발급 중(09-22 유출)** — 사용자 완료 확인 |
| Google Generative Language API(`GOOGLE_GENERATIVE_AI_API_KEY`, `gemini-3.1-flash-image`) | KEEP | 예약 사진 | 동일 재발급. Seedream(`IMAGE_PROVIDER`)은 대안 |
| BytePlus ARK Seedance(`ARK_API_KEY`) / Kling(`KLING_*`) | KEEP | 히어로 루프 영상 | 둘 중 하나만 프로덕션에 설정됐는지 확인(`VIDEO_PROVIDER`) |
| Cloudflare R2(`R2_*`, `CLOUDFLARE_ACCOUNT_ID`) | KEEP | 미디어 저장 | 유지. `world-cards.ts` R2 호스트 하드코딩 → env |
| Cloudflare Pages API(`CLOUDFLARE_API_TOKEN`) | KEEP | 생성 앱 배포·도메인 | 유지 |
| Supabase 플랫폼(`VITE_PLATFORM_SUPABASE_*`, `PLATFORM_SUPABASE_SERVICE_ROLE_KEY`) | KEEP | 계정·사용량·분석 | 유지 |
| Supabase Cloud(`CLOUD_SUPABASE_*`, `CLOUD_APP_TOKEN_SECRET`) | UNKNOWN | 프로젝트 DNS 불가(일시중지/삭제 추정). 코드는 KEEP | 사용자: 프로젝트 상태 확인. 대안 = 플랫폼 프로젝트로 통합(`DB-AUDIT §5-1`) |
| Sentry(`SENTRY_DSN`) | KEEP | 에러 수집 | 이벤트 수신 여부 대시보드 확인 |
| PortOne(`PORTONE_*`) | REBUILD | 결제 UI 없음, verify 호출자 없음, webhook no-op | 결제 설계 |
| Kakao OAuth, Google OAuth, 이메일 OTP(Supabase Auth) | KEEP | 로그인 3종 | 유지. GitHub OAuth는 없음 |
| Kakao JS SDK(`VITE_KAKAO_JS_KEY`) | UNKNOWN | 플랫폼이 아니라 **생성 앱** 프롬프트 예시가 참조 | 생성 앱 카카오 연동을 V1에 넣을지 결정 |
| GitHub/GitLab/Netlify/Vercel API, Ollama/LMStudio/OpenRouter 등 | REMOVE | bolt 잔재(§6 B/C/E) | 삭제 |
| Google Fonts(`fonts.googleapis.com`) | KEEP | 킷·UI 폰트 | 유지 |
| Pexels(`images.pexels.com`) | UNKNOWN | 1곳 참조 — 스톡 대체 또는 게이트 예시 | 확인 후 게이트에서 금지 호스트인지 명시 |
| `cdn.simpleicons.org`, `cdn.jsdelivr.net` | UNKNOWN | 잔재 UI 아이콘 가능성 | 잔재 삭제 후 남으면 확인 |

## 8. REBUILD 상세 (V1에 필요, 지금 구조로는 안 됨)

| 항목 | 지금 | 왜 REBUILD | 방향 |
|---|---|---|---|
| 생성 쿼터 서버 강제 | 클라이언트 `freeTrial.ts`가 RPC 호출. 서버 라우트 인증·쿼터 없음 | 우회하면 무제한 비용 | `/api/chat`·`/api/llmcall`·`/api/media-*` 앞단에서 세션 필수 + `increment_generation_count_v2` 서버 호출 |
| 미디어 jobId 소유 | 클라이언트가 jobId 생성, 서버 검증 없음 | 남의 R2 이미지 덮어쓰기 가능 | 예약 시 서버가 jobId 발급(HMAC 서명) → 생성·영상 요청에서 검증 |
| 결제 | UI 없음, verify 호출자 없음, webhook no-op, 티어 테이블 없음 | 돈이 안 들어옴 | PortOne 결제 UI → 서버 verify(서버 상수 금액) → `subscriptions` 저장 → RPC 한도가 티어 참조 → 배지·도메인 게이트 |
| Cloud origin | `*.pages.dev` 하나만 | 커스텀 도메인 앱은 저장 불가 | `deploy_origin`을 배열/별도 테이블로, `cloudflare-domain` 성공 시 추가 |
| 탈퇴 | 플랫폼 auth만 삭제 | Cloud 앱·문서, R2, Pages 프로젝트 잔존 | 탈퇴 라우트에 Cloud/R2/Pages 정리 |
| fail-open 3곳 | 소유권 RPC·레이트리밋 RPC·플랫폼 env 미설정 시 통과 | 장애가 조용히 보안 완화 | fail-closed + Sentry |
| 채팅 서버 저장 | IndexedDB만 | 기기 바꾸면 앱 목록 유실, FK 대상 없음 | `chats` 테이블 + 동기화 |
| `Chat.client.tsx` 1,666줄 | 모든 effect 한 파일 | 수정 위험 | 온보딩/생성/검토/이미지 주입 effect를 훅으로 분리(동작 변경 없이) |
| `@settings` 남는 탭 | bolt UI | 코랄레드 톤 아님 | 계정 화면 재구성 |
| `api.models*` + `PROVIDER_LIST` | 22 프로바이더 목록 | 실사용 1~2개 | 정적 목록 |
| `lib/stores/settings.ts` | bolt 기능 플래그 + 테마 | 혼재 | 코랄레드가 쓰는 필드만 |
| 미디어 생성 Worker 분리 | chat 스트림 뒤로 순서 조정 | 격리체 128MB 회피책 | 별도 Worker/큐(`HANDOFF §7-4`) |
| 온보딩 전환 지연 | WebContainer boot가 메인 스레드 점유 | 20~40초 프리즈 | boot 지연 로드 |

## 9. REMOVE 실행 순서 (GPT용)

1. **전제**: `pnpm run check` 초록 상태에서 시작. 묶음 하나 = 커밋 하나. 각 커밋 뒤 `pnpm run check`, 마지막에 `check:full`.
2. §6 F(시스템/업데이트/Expo) → D(MCP/검색/enhancer) → C(Netlify/Vercel) → B(Git 계열) → A(설정 패널) → E(프로바이더) 순. 작은 것부터, 의존 적은 것부터.
3. 각 묶음: 라우트 파일 삭제 → 컴포넌트 삭제 → 훅/스토어/서비스 삭제 → `tsc`가 가리키는 임포터 정리(`DeployButton.tsx`, `BaseChat.tsx`, `Menu.client.tsx`, `ControlPanel.tsx`, `registry.ts`, `workbench.ts`) → 관련 `*.spec.ts` 삭제(소스 문자열 검사 spec은 해당 `it`만) → dep 제거는 **별도 커밋**(lockfile).
4. 지운 라우트는 `tests/api/routes.contract.spec.ts`의 "되살아나지 않았다" 목록에 추가.
5. `docs/API.md` 잔재 절·`ARCHITECTURE.md` 표에서 지운 항목 삭제.
6. UNKNOWN(§6 H)은 사용자 답 받기 전까지 손대지 않는다.

## 10. UNKNOWN 한눈에 (사용자 확인 필요)

1. `/brief` 딥 브리프 — V1 온보딩 경로인가?
2. 사용자 "내 Supabase 연결" 기능(`api.supabase*`, `SupabaseConnection`, `stores/supabase`, `@settings/tabs/supabase`) — V1 포함?
3. Cloud Supabase 프로젝트 — 살아 있나, 플랫폼 프로젝트로 통합하나?
4. `look-bibles.ts` — 연결 예정인가 폐기인가?
5. `generation_usage_v2.carryover_count` — 이월 정책?
6. `VITE_KAKAO_JS_KEY` 생성 앱 카카오 연동 — V1 포함?
7. `server/preview-server.mjs`(`pnpm run preview-server`), `tests/benchmark/brief/` — 아직 쓰는가?
8. `@webcontainer/api 1.6.1-internal.1` 고정 이유(업그레이드 금지인지).
9. `@settings/tabs/notifications` — 코랄레드 알림 정의?
10. Pexels·simpleicons·jsdelivr 참조 — 잔재 삭제 후 남는지.
