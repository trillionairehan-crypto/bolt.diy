import { ClientOnly } from 'remix-utils/client-only';
import { BaseChat } from '~/components/chat/BaseChat';
import { Chat } from '~/components/chat/Chat.client';
import { ChatErrorBoundary } from '~/components/chat/ChatErrorBoundary';
import { Header } from '~/components/header/Header';

/** Shared chat screen shell — reused by the chat-home route and every /chat/:id route. */
export function ChatShell() {
  return (
    <div className="flex flex-col h-full w-full bg-bolt-elements-background-depth-1">
      <Header />
      <ChatErrorBoundary>
        <ClientOnly fallback={<BaseChat />}>{() => <Chat />}</ClientOnly>
      </ChatErrorBoundary>
    </div>
  );
}
