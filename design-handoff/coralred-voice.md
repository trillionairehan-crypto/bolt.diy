# coralred 문구 가이드

코랄레드 UI에 들어가는 모든 한국어 문구의 정본 문서입니다. 앞으로 새로 쓰거나 고치는 UI 텍스트는 전부 이 문서를 따릅니다. Claude(또는 Claude Code)에 이 문서를 붙여넣으면 같은 톤으로 문구를 작업할 수 있습니다.

## 원칙

### 1. 해요체로 통일
"~합니다", "~하십시오", "~하세요"(명령형) 금지. "~해요", "~할게요", "~됐어요"로 씁니다.

- ✕ "저장되었습니다" / "다시 시도하십시오" / "이름을 입력하세요"
- ○ "저장됐어요" / "다시 시도해주세요" / "이름을 입력해주세요"

"~해주세요"는 요청이라 예외적으로 허용합니다 (명령형이 아니라 부탁의 형태). "~하세요"만 금지 대상입니다.

### 2. 시스템이 주어가 되지 않기
"생성 실패", "요청을 처리하는 중 오류가 발생했어요"처럼 **시스템 내부 사건**을 그대로 말하지 않습니다. 사용자가 보는 결과나 다음에 할 일을 주어로 씁니다.

- ✕ "생성 실패"
- ✕ "요청을 처리하는 중 오류가 발생했어요"
- ○ "다시 만들어볼게요"
- ○ "잠시 문제가 있었어요. 다시 시도해주세요"

### 3. 개발/외래 용어 금지
비개발자가 실제로 아는 말로 바꿉니다.

| 개발 용어 | 코랄레드 용어 |
|---|---|
| Workbench | 작업 화면 |
| 아티팩트(Artifact) | 만든 것 |
| 프롬프트(Prompt) | 요청 |
| 배포(Deploy) | 내 앱 공개하기 |
| 데이터베이스(Database) | 저장 기능 |
| 토큰(Token) | (사용자에게 노출 안 함) |
| 커밋(Commit) / 스트리밍(Streaming) / 렌더링(Rendering) 등 | 노출 금지 — 사용자에게 보일 이유가 없는 내부 구현 용어 |

### 4. 부정형 대신 다음 행동을 알려주기
"안 됐다"에서 끝내지 않고, 사용자가 지금 뭘 할 수 있는지·다음에 무슨 일이 생기는지까지 말합니다.

- ✕ "무료 체험을 모두 사용했어요"
- ○ "이번 달 무료 횟수를 다 썼어요. 다음 달 1일에 다시 채워져요"

### 5. 길이
- 버튼 라벨: 2~5자
- 안내 문장: 한 줄
- 설명: 두 줄 이내

### 6. 느낌표 남용 금지, 이모지는 라벨에 쓰지 않기
느낌표는 정말 축하하거나 강조할 때만. UI 라벨(버튼, 탭, 메뉴 등)에는 이모지를 쓰지 않습니다. 사용자가 직접 입력하거나 AI가 생성한 콘텐츠 내부는 예외입니다.

### 7. "님"으로 부르지 않기
"OO님, 환영합니다" 대신 주어 없이 자연스럽게 씁니다.

- ✕ "회원님, 저장이 완료되었습니다"
- ○ "저장됐어요"

## 적용 예시

실제 코드베이스에 있는 문구를 그대로 가져와 정리했습니다. 괄호 안은 위치(파일)입니다.

| 영역 | Before | After | 적용 원칙 |
|---|---|---|---|
| 헤더 | "Rename chat" (`ChatDescription.client.tsx` 툴팁) | "이름 바꾸기" | 3 |
| 헤더 | "Report Bug" (`HeaderActionButtons.client.tsx`) | "문제 보고하기" | 3 |
| 사이드바 | "Delete Chat?" (`Menu.client.tsx` 삭제 확인 다이얼로그 제목) | "채팅을 지울까요?" | 1, 3 |
| 사이드바 | "Are you sure you want to delete this chat?" (`Menu.client.tsx`) | "지우면 다시 볼 수 없어요" | 3, 4 |
| 사이드바 | "No previous conversations" (`Menu.client.tsx` 빈 목록) | "아직 만든 게 없어요" | 3, 4 |
| 입력창 | "Use Shift + Return a new line" (`ChatBox.tsx` 줄바꿈 힌트) | "Shift+Enter로 줄바꿈" | 3, 5 |
| 입력창 | title="Discuss" (`ChatBox.tsx` 대화 모드 버튼) | "대화 모드" | 3 |
| 입력창 | "데이터베이스 연결" (`SupabaseConnection.tsx` 버튼 라벨) | "저장 기능 연결" | 3 |
| 입력창 | "데이터베이스가 연결됐어요" (`SupabaseConnection.tsx` 툴팁) | "저장 기능이 켜졌어요" | 3 |
| 채팅 | "요청을 처리하는 중 오류가 발생했어요." (`LLMApiAlert.tsx` 기본 에러) | "잠시 문제가 있었어요. 다시 시도해주세요" | 2, 4 |
| 채팅 | "무료 체험을 모두 사용했어요" (`BaseChat.tsx` 무료 체험 소진) | "이번 달 무료 횟수를 다 썼어요. 다음 달 1일에 다시 채워져요" | 4 |
| 워크벤치 | "Sync" / "Syncing..." (`Workbench.client.tsx`) | "저장" / "저장 중" | 3 |
| 워크벤치 | "Toggle Terminal" (`Workbench.client.tsx`) | "터미널" | 3, 5 |
| 워크벤치 | "Download Code" (`ExportChatButton.tsx`) | "코드 내려받기" | 3 |
| 워크벤치 | "Export Chat" (`ExportChatButton.tsx`) | "대화 내보내기" | 3 |
| 에러 | "Database not available" (`DataTab.tsx` 토스트) | "저장 기능을 아직 쓸 수 없어요" | 2, 3, 4 |
| 에러 | "Failed to load chats: ..." (`DataTab.tsx` 토스트) | "채팅 목록을 못 가져왔어요. 다시 시도해주세요" | 2, 3, 4 |
| 설정 | "Reset all settings to their default values." (`DataTab.tsx` 설명) | "처음 상태로 되돌려요" | 1, 3, 5 |
| 설정 | "Please enter your GitLab access token" (`GitLabAuthDialog.tsx`) | "깃랩 연결 키를 입력해주세요" | 3 |
| 설정 | "Cancel" (다이얼로그 공통 버튼) | "취소" | 3, 5 |

## 금지 표현 목록

아래 표현이 새 코드에 보이면 이 문서 원칙에 맞게 바꿉니다.

**영어 잔재 (자주 새어나오는 것들)**
- Cancel, Delete, Save, Reset, Export, Download, Sync/Syncing, Toggle, Discuss
- Failed to ..., ... not available, Please enter ..., Are you sure ...?
- Report Bug, Debug Log, access token

**개발 용어 (직역·음역 포함)**
- Workbench / 워크벤치
- 아티팩트 / Artifact
- 프롬프트 (사용자에게 보일 때는 "요청"으로)
- 배포 / Deploy (사용자 행동을 가리킬 땐 "내 앱 공개하기")
- 데이터베이스 / Database / DB (사용자에게 보일 땐 "저장 기능")
- 토큰 / Token
- 커밋(Commit), 스트리밍(Streaming), 렌더링(Rendering), 캐시(Cache), 세션(Session), 엔드포인트(Endpoint), 페이로드(Payload)

**직역체 패턴**
- "~에 실패했습니다", "~중 오류가 발생했습니다" (시스템 사건을 그대로 보고하는 문장 구조 자체가 금지 — 2번 원칙)
- "~하시기 바랍니다", "~해 주시기 바랍니다" (과도한 격식체)
- "OO님" 호칭 (7번 원칙)
