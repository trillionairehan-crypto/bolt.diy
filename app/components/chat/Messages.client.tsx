import type { UIMessage } from 'ai';
import { Fragment } from 'react';
import { classNames } from '~/utils/classNames';
import { AssistantMessage } from './AssistantMessage';
import { UserMessage } from './UserMessage';
import { MessageErrorBoundary } from './MessageErrorBoundary';
import { useLocation } from '@remix-run/react';
import { db, chatId } from '~/lib/persistence/useChatHistory';
import { forkChat } from '~/lib/persistence/db';
import { toast } from 'react-toastify';
import { forwardRef } from 'react';
import type { ForwardedRef } from 'react';
import type { ProviderInfo } from '~/types/model';

interface MessagesProps {
  id?: string;
  className?: string;
  isStreaming?: boolean;
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

export const Messages = forwardRef<HTMLDivElement, MessagesProps>(
  (props: MessagesProps, ref: ForwardedRef<HTMLDivElement> | undefined) => {
    const { id, isStreaming = false, messages = [], parsedMessages = {} } = props;
    const location = useLocation();

    const handleRewind = (messageId: string) => {
      const searchParams = new URLSearchParams(location.search);
      searchParams.set('rewindTo', messageId);
      window.location.search = searchParams.toString();
    };

    const handleFork = async (messageId: string) => {
      try {
        if (!db || !chatId.get()) {
          toast.error('Chat persistence is not available');
          return;
        }

        const urlId = await forkChat(db, chatId.get()!, messageId);
        window.location.href = `/chat/${urlId}`;
      } catch (error) {
        toast.error('Failed to fork chat: ' + (error as Error).message);
      }
    };

    return (
      <div id={id} className={props.className} ref={ref}>
        {messages.length > 0
          ? messages.map((message, index) => {
              const { role, id: messageId, parts } = message;
              const isUserMessage = role === 'user';
              const isFirst = index === 0;
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
                <div
                  key={messageKey}
                  className={classNames('flex gap-4 py-3 w-full rounded-lg', {
                    'mt-4': !isFirst,
                  })}
                >
                  <div className="grid grid-col-1 w-full">
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
                  </div>
                </div>
              );
            })
          : null}
        {isStreaming && (
          <div className="flex justify-center w-full mt-4">
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}
            >
              <span className="flex gap-1">
                <span
                  className="w-1.5 h-1.5 rounded-full animate-[cr-dot-pulse_1.2s_ease-in-out_infinite]"
                  style={{ background: '#FF5330', animationDelay: '0ms' }}
                />
                <span
                  className="w-1.5 h-1.5 rounded-full animate-[cr-dot-pulse_1.2s_ease-in-out_infinite]"
                  style={{ background: '#FF5330', animationDelay: '150ms' }}
                />
                <span
                  className="w-1.5 h-1.5 rounded-full animate-[cr-dot-pulse_1.2s_ease-in-out_infinite]"
                  style={{ background: '#FF5330', animationDelay: '300ms' }}
                />
              </span>
              만드는 중이에요
            </div>
          </div>
        )}
      </div>
    );
  },
);
