import type { ReactNode } from 'react';
import { useStore } from '@nanostores/react';
import { computed } from 'nanostores';
import { workbenchStore } from '~/lib/stores/workbench';
import { mobileActiveTabStore, type MobileTab } from '~/lib/stores/mobileWorkspace';
import { classNames } from '~/utils/classNames';
import { Preview } from '~/components/workbench/Preview';
import { Terminal } from '~/components/workbench/terminal/Terminal';
import { themeStore } from '~/lib/stores/theme';
import type { ElementInfo } from '~/components/workbench/Inspector';

interface MobileWorkspaceProps {
  chatColumnContent: ReactNode;
  setSelectedElement?: (element: ElementInfo | null) => void;
}

const TABS: { value: MobileTab; label: string; icon: string }[] = [
  { value: 'chat', label: '대화', icon: 'i-ph:chat-circle-text' },
  { value: 'preview', label: '미리보기', icon: 'i-ph:device-mobile-camera' },
];

/*
 * 모바일 전용 레이아웃 (overnight5) — replaces the desktop split-panel (chat | workbench) with a
 * single full-screen tab at a time: only the active tab's content is ever mounted, so there is no
 * overlay layer and no z-index competition between chat and a workbench panel to get wrong (see
 * MOBILE_V2_REPORT.md for why the previous three overlay-based fixes kept failing). Code/diff/file
 * tree/terminal have no entry point here at all — this only ever shows the chat and the live
 * preview, reusing both from the existing desktop components (Messages/ChatBox via
 * chatColumnContent, and Preview directly) rather than reimplementing either.
 */
export function MobileWorkspace({ chatColumnContent, setSelectedElement }: MobileWorkspaceProps) {
  const activeTab = useStore(mobileActiveTabStore);
  const hasPreview = useStore(computed(workbenchStore.previews, (previews) => previews.length > 0));
  const bootFailed = useStore(workbenchStore.webcontainerBootFailed);
  const theme = useStore(themeStore);

  return (
    <div className="flex flex-col w-full h-full min-h-0">
      {/*
        원인 조사(MOBILE_V2_FIX_REPORT.md 참고): npm install/npm run dev를 실제로 실행하는
        WebContainer 셸(BoltShell)은 EditorPanel 안의 터미널 UI가 마운트되면서 attachBoltTerminal을
        호출해야 초기화된다(action-runner.ts의 모든 shell/start 액션이 shell.ready()를 기다림). 데스크톱은
        Workbench가 항상 이 터미널을 마운트하지만, 모바일은 Workbench를 아예 렌더하지 않아 셸이 영영
        초기화되지 않았다 — 그래서 앱이 다 만들어져도 미리보기가 절대 뜨지 않았다. 이 터미널은 사용자에게
        보여주는 게 아니라(hidden, 진입 경로 없음) 순수하게 셸을 초기화만 하기 위한 것 — 실제 터미널
        UI/탭/코드 화면은 여전히 모바일에 없다.
      */}
      <Terminal
        id="mobile-bolt-shell-init"
        className="hidden"
        theme={theme}
        onTerminalReady={(terminal) => workbenchStore.attachBoltTerminal(terminal)}
      />
      <div className="flex-1 min-h-0">
        {activeTab === 'chat' ? (
          chatColumnContent
        ) : hasPreview ? (
          <Preview setSelectedElement={setSelectedElement} />
        ) : bootFailed ? (
          <div className="flex flex-col items-center justify-center gap-2 w-full h-full text-center px-8 bg-bolt-elements-background-depth-1">
            <div className="i-ph:warning-circle text-3xl text-bolt-elements-textTertiary" />
            <p className="text-sm text-bolt-elements-textSecondary">이 기기에서는 미리보기를 열 수 없어요</p>
            <p className="text-xs text-bolt-elements-textTertiary">컴퓨터에서 다시 확인해보세요</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 w-full h-full text-center px-8 bg-bolt-elements-background-depth-1">
            <div className="i-ph:device-mobile-camera text-3xl text-bolt-elements-textTertiary" />
            <p className="text-sm text-bolt-elements-textSecondary">앱을 만들면 여기서 바로 볼 수 있어요</p>
          </div>
        )}
      </div>
      <nav className="flex shrink-0 border-t border-bolt-elements-borderColor bg-bolt-elements-background-depth-2">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => mobileActiveTabStore.set(tab.value)}
            aria-current={activeTab === tab.value}
            className={classNames(
              'flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs transition-colors',
              activeTab === tab.value
                ? 'text-bolt-elements-textPrimary'
                : 'text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary',
            )}
          >
            <div className={classNames(tab.icon, 'text-xl')} />
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
