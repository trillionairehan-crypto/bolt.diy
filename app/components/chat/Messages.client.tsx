import type { UIMessage } from 'ai';
import { Fragment, useMemo } from 'react';
import { useStore } from '@nanostores/react';
import { classNames } from '~/utils/classNames';
import { AssistantMessage } from './AssistantMessage';
import { UserMessage } from './UserMessage';
import { CompletionCard } from './CompletionCard';
import { MessageErrorBoundary } from './MessageErrorBoundary';
import { useLocation } from '@remix-run/react';
import { db, chatId } from '~/lib/persistence/useChatHistory';
import { forkChat } from '~/lib/persistence/db';
import { workbenchStore } from '~/lib/stores/workbench';
import { toast } from 'react-toastify';
import { forwardRef } from 'react';
import type { ForwardedRef } from 'react';
import type { ProviderInfo } from '~/types/model';

interface MessagesProps {
  id?: string;
  className?: string;
  isStreaming?: boolean;
  hasError?: boolean;
  messages?: UIMessage[];
  parsedMessages?: { [key: number]: string };
  append?: (message: { text: string }) => void;
  chatMode?: 'discuss' | 'build';
  setChatMode?: (mode: 'discuss' | 'build') => void;
  model?: string;
  provider?: ProviderInfo;
  addToolOutput: (input: {
    state?: 'output-available';
    tool: string;
    toolCallId: string;
    output: any;
    errorText?: never;
  }) => void;
}

interface Turn {
  key: string;
  entries: { message: UIMessage; index: number }[];
}

/*
 * 채팅 화면 재설계 — 작업 묶음 선(3): user 메시지 하나가 새 턴을 시작하고, 다음 user 메시지가
 * 나오기 전까지의 assistant 메시지(들)가 같은 턴에 속한다. 맨 앞이 assistant 메시지인 드문
 * 경우(예: 복원된 프로젝트 안내)는 그 자체로 턴 하나가 된다.
 */
function groupIntoTurns(messages: UIMessage[]): Turn[] {
  const turns: Turn[] = [];
  let current: Turn | null = null;

  messages.forEach((message, index) => {
    if (message.role === 'user' || !current) {
      current = { key: message.id || `turn-${index}`, entries: [] };
      turns.push(current);
    }

    current.entries.push({ message, index });
  });

  return turns;
}

export const Messages = forwardRef<HTMLDivElement, MessagesProps>(
  (props: MessagesProps, ref: ForwardedRef<HTMLDivElement> | undefined) => {
    const { id, isStreaming = false, hasError = false, messages = [], parsedMessages = {} } = props;
    const location = useLocation();

    const handleRewind = (messageId: string) => {
      const searchParams = new URLSearchParams(location.search);
      searchParams.set('rewindTo', messageId);
      window.location.search = searchParams.toString();
    };

    const handleFork = async (messageId: string) => {
      try {
        if (!db || !chatId.get()) {
          toast.error('지금은 새 채팅을 만들 수 없어요.');
          return;
        }

        const urlId = await forkChat(db, chatId.get()!, messageId);
        window.location.href = `/chat/${urlId}`;
      } catch (error) {
        console.error('Failed to fork chat:', error);
        toast.error('새 채팅을 만들지 못했어요. 다시 시도해주세요.');
      }
    };

    const turns = useMemo(() => groupIntoTurns(messages), [messages]);

    /*
     * 2-1/2-5: 완성 카드는 대화당 딱 한 번 — "첫 아티팩트를 가진 메시지"에만 붙인다. 새로고침해도
     * 메시지 배열에서 항상 같은 메시지로 결정론적으로 계산되므로 별도 영속 상태가 필요 없다.
     * 아티팩트 존재 여부는 Markdown.tsx가 이미 같은 방식(문자열에 __boltArtifact__ 포함 여부)으로
     * 판단하는 것과 동일한 마커를 재사용 — parsedMessages는 그 마커가 그대로 남아있는 파싱된
     * HTML 문자열이다.
     */
    const previewReady = useStore(workbenchStore.previewReady);
    const completionMessageId = useMemo(() => {
      if (!previewReady) {
        return null;
      }

      const ownerIndex = messages.findIndex((_, index) => (parsedMessages[index] || '').includes('__boltArtifact__'));

      return ownerIndex === -1 ? null : messages[ownerIndex].id;
    }, [previewReady, messages, parsedMessages]);

    return (
      <div id={id} className={props.className} ref={ref}>
        {turns.map((turn, turnIndex) => {
          const isLastTurn = turnIndex === turns.length - 1;

          /*
           * 3-2/3-4: 진행 중인 마지막 턴은 100% 불투명, 에러로 끝난 마지막 턴은 회갈색, 그 외
           * (정상 종료)는 코랄 25%로 가라앉는다. var(--accent)는 oklch 값이라 rgba()로 직접
           * 옅게 만들 수 없어 color-mix를 쓴다(Header.tsx의 backdrop 배경과 같은 기존 패턴).
           */
          const lineColor =
            isLastTurn && hasError
              ? 'rgba(122, 112, 103, 0.25)'
              : isLastTurn && isStreaming
                ? 'var(--accent)'
                : 'color-mix(in oklch, var(--accent) 25%, transparent)';

          return (
            <div
              key={turn.key}
              className={classNames('w-full', { 'mt-8': turnIndex > 0 })}
              style={{ borderLeft: `2px solid ${lineColor}`, paddingLeft: 16 }}
            >
              {turn.entries.map(({ message, index }, entryIndex) => {
                const { role, id: messageId, parts } = message;
                const isUserMessage = role === 'user';
                const parsedContent = parsedMessages[index] || '';

                /*
                 * Stable per-message key so the same logical message keeps its identity across
                 * renders even when it swaps between Fragment (hidden) and div (visible) —
                 * index-based keys caused React to reuse the wrong DOM node in that swap.
                 */
                const messageKey = messageId || `message-${index}`;

                /*
                 * v5 UIMessage has no `annotations` field — hidden messages are now flagged via
                 * `message.metadata.hidden` instead (see generateNewApp() in Chat.client.tsx).
                 */
                const isHidden = (message as any).metadata?.hidden === true;

                if (isHidden) {
                  return <Fragment key={messageKey} />;
                }

                return (
                  <div key={messageKey} className={classNames('w-full', { 'mt-3': entryIndex > 0 })}>
                    <MessageErrorBoundary>
                      {isUserMessage ? (
                        <UserMessage parts={parts} />
                      ) : (
                        <AssistantMessage
                          parsedContent={parsedContent}
                          messageId={messageId}
                          onRewind={handleRewind}
                          onFork={handleFork}
                          append={props.append}
                          chatMode={props.chatMode}
                          setChatMode={props.setChatMode}
                          model={props.model}
                          provider={props.provider}
                          parts={parts}
                          addToolOutput={props.addToolOutput}
                        />
                      )}
                    </MessageErrorBoundary>
                    {messageId && messageId === completionMessageId && (
                      <div className="mt-3">
                        <CompletionCard />
                      </div>
                    )}
                  </div>
                );
              })}
              {/*
                1-6: 스트리밍 진행 문구는 마지막 턴에만, AI 응답과 같은 평문 스타일로 붙인다 —
                Artifact.tsx가 쓰는 것과 같은 코랄 점멸 점(cr-dot-pulse) 패턴 재사용.
              */}
              {isLastTurn && isStreaming && (
                <div className="flex items-center gap-2 mt-3 text-sm" style={{ color: '#1A1A1A' }}>
                  <span
                    className="w-2 h-2 rounded-full shrink-0 animate-[cr-dot-pulse_1.2s_ease-in-out_infinite]"
                    style={{ background: 'var(--accent)' }}
                    aria-hidden="true"
                  />
                  만드는 중이에요
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  },
);
