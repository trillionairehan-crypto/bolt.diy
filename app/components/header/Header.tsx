import { lazy, Suspense } from 'react';
import { useStore } from '@nanostores/react';
import { ClientOnly } from 'remix-utils/client-only';
import { chatStore } from '~/lib/stores/chat';
import { sidebarOpenStore, toggleSidebar } from '~/lib/stores/sidebar';
import { classNames } from '~/utils/classNames';
import { ChatDescription } from '~/lib/persistence/ChatDescription.client';

/*
 * Lazy-loaded: HeaderActionButtons only imports `workbenchStore` to read `previews` for the
 * Deploy button, but that store module eagerly instantiates a singleton pulling in ActionRunner,
 * EditorStore, FilesStore, PreviewsStore, TerminalStore, JSZip, Octokit, and the WebContainer
 * bootstrap. Header renders unconditionally on the main route, so a static import here forced
 * that entire workbench dependency graph into the initial page-load bundle (~1MB gzipped, all
 * under a single "Header" chunk) before the user ever opens the workbench. This defers that cost
 * to when HeaderActionButtons actually mounts (chat.started === true). The ideal fix is a
 * lighter-weight selector that doesn't require importing the whole store module at all — this is
 * the quick, low-risk mitigation in the meantime.
 */
const HeaderActionButtons = lazy(() =>
  import('./HeaderActionButtons.client').then((module) => ({ default: module.HeaderActionButtons })),
);

export function Header() {
  const chat = useStore(chatStore);
  const sidebarOpen = useStore(sidebarOpenStore);

  return (
    <header
      className={classNames('flex items-center px-4 border-b h-[var(--header-height)]', {
        'border-transparent': !chat.started,
        'border-bolt-elements-borderColor': chat.started,
      })}
    >
      <div className="flex items-center gap-2 z-logo text-bolt-elements-textPrimary cursor-pointer">
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label="사이드바 열기/닫기"
          aria-expanded={sidebarOpen}
          className="i-ph:sidebar-simple-duotone text-xl"
        />
        <a href="/" className="flex items-center gap-2">
          <div
            className="flex items-center justify-center shrink-0"
            style={{ width: 28, height: 28, borderRadius: '22%', backgroundColor: '#FF5A36' }}
          >
            <span style={{ color: '#FAF7F2', fontWeight: 800, fontSize: 16, lineHeight: 1 }}>C</span>
          </div>
          <span style={{ color: '#1A1A1A', fontWeight: 700, fontSize: 20 }}>coralred</span>
        </a>
      </div>
      {chat.started && ( // Display ChatDescription and HeaderActionButtons only when the chat has started.
        <>
          <span className="flex-1 px-4 truncate text-center text-bolt-elements-textPrimary">
            <ClientOnly>{() => <ChatDescription />}</ClientOnly>
          </span>
          <ClientOnly>
            {() => (
              <div className="">
                <Suspense fallback={null}>
                  <HeaderActionButtons chatStarted={chat.started} />
                </Suspense>
              </div>
            )}
          </ClientOnly>
        </>
      )}
    </header>
  );
}
