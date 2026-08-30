import type { TextUIPart, UIMessage } from 'ai';
import { useCallback, useState } from 'react';
import { EnhancedStreamingMessageParser } from '~/lib/runtime/enhanced-message-parser';
import { workbenchStore } from '~/lib/stores/workbench';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('useMessageParser');

const messageParser = new EnhancedStreamingMessageParser({
  callbacks: {
    onArtifactOpen: (data) => {
      logger.trace('onArtifactOpen', data);

      /*
       * 채팅 홈·생성 전환 통합 수정 — 예전엔 여기서 showWorkbench를 즉시 열었다(LLM이 첫 토큰을
       * 스트리밍하는 순간, 파일도 서버도 없는 상태). 이제 패널을 여는 유일한 트리거는
       * workbenchStore.previewReady(Preview.tsx가 첫 컴파일 성공 시 세팅) — Workbench.client.tsx가
       * 그 신호를 구독해서 연다. addArtifact는 그대로 즉시 호출 — 실제 파일 작성/셸 실행
       * 파이프라인은 패널이 보이든 안 보이든 항상 동작해야 한다.
       */
      workbenchStore.addArtifact(data);
    },
    onArtifactClose: (data) => {
      logger.trace('onArtifactClose');

      workbenchStore.updateArtifact(data, { closed: true });

      /*
       * Fire-and-forget: message-parser.ts doesn't await this callback, so this never blocks
       * streaming/parsing. checkArtifactFileReferences awaits the execution queue internally
       * (so it only reads `files` once everything's actually written) and never throws.
       */
      if (data.artifactId) {
        void workbenchStore.checkArtifactFileReferences(data.artifactId);
      }
    },
    onActionOpen: (data) => {
      logger.trace('onActionOpen', data.action);

      /*
       * File actions are streamed, so we add them immediately to show progress
       * Shell actions are complete when created by enhanced parser, so we wait for close
       */
      if (data.action.type === 'file') {
        workbenchStore.addAction(data);
      }
    },
    onActionClose: (data) => {
      logger.trace('onActionClose', data.action);

      /*
       * Add non-file actions (shell, build, start, etc.) when they close
       * Enhanced parser creates complete shell actions, so they're ready to execute
       */
      if (data.action.type !== 'file') {
        workbenchStore.addAction(data);
      }

      workbenchStore.runAction(data);
    },
    onActionStream: (data) => {
      logger.trace('onActionStream', data.action);
      workbenchStore.runAction(data, true);
    },
  },
});
const extractTextContent = (message: UIMessage) =>
  message.parts
    ?.filter((part): part is TextUIPart => part.type === 'text')
    .map((part) => part.text)
    .join('') ?? '';

export function useMessageParser() {
  const [parsedMessages, setParsedMessages] = useState<{ [key: number]: string }>({});

  const parseMessages = useCallback((messages: UIMessage[], isLoading: boolean) => {
    if (import.meta.env.DEV && !isLoading) {
      messageParser.reset();
    }

    for (const [index, message] of messages.entries()) {
      if (message.role === 'assistant' || message.role === 'user') {
        // parse() always returns the full parsed text for the message, not a delta.
        const newParsedContent = messageParser.parse(message.id, extractTextContent(message));
        setParsedMessages((prevParsed) => ({
          ...prevParsed,
          [index]: newParsedContent,
        }));
      }
    }
  }, []);

  return { parsedMessages, parseMessages };
}
