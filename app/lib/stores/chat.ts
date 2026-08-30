import { map } from 'nanostores';

export const chatStore = map({
  started: false,
  aborted: false,
  showChat: true,
  autoFixAttempts: 0,

  /*
   * 채팅 홈·생성 전환 통합 수정 — workbenchStore.showWorkbench를 가벼운(=nanostores만 의존하는)
   * chatStore로 미러링한 값. BaseChat.tsx는 워크벤치 열림 여부에 맞춰 .Chat 칼럼의 폭을
   * 즉시 고정해야 하는데, workbenchStore를 직접 import하면 ActionRunner/EditorStore/
   * FilesStore/WebContainer 부트스트랩까지 초기 번들에 딸려 들어온다(Header.tsx/
   * Workbench.client.tsx의 기존 지연 로딩 주석 참고) — 그 무거운 그래프를 안 끌어오려고
   * Workbench.client.tsx가 showWorkbench 변화를 이 값에만 동기화해서 흘려보낸다.
   */
  workbenchOpen: false,
});
