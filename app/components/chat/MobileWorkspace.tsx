import { type ReactNode, useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { AnimatePresence, motion } from 'framer-motion';
import { workbenchStore } from '~/lib/stores/workbench';
import { mobileActiveTabStore } from '~/lib/stores/mobileWorkspace';
import { classNames } from '~/utils/classNames';
import { Preview } from '~/components/workbench/Preview';
import { Terminal } from '~/components/workbench/terminal/Terminal';
import { themeStore } from '~/lib/stores/theme';
import type { ElementInfo } from '~/components/workbench/Inspector';

interface MobileWorkspaceProps {
  chatColumnContent: ReactNode;
  setSelectedElement?: (element: ElementInfo | null) => void;
}

/*
 * 모바일 전용 레이아웃 (overnight5) — replaces the desktop split-panel (chat | workbench) with a
 * single full-screen tab at a time: only the active tab's content is ever mounted, so there is no
 * overlay layer and no z-index competition between chat and a workbench panel to get wrong (see
 * MOBILE_V2_REPORT.md for why the previous three overlay-based fixes kept failing). Code/diff/file
 * tree/terminal have no entry point here at all — this only ever shows the chat and the live
 * preview, reusing both from the existing desktop components (Messages/ChatBox via
 * chatColumnContent, and Preview directly) rather than reimplementing either.
 *
 * 채팅 홈·생성 전환 통합 수정 — Preview는 이제 activeTab과 무관하게 항상 마운트해두고(탭이 아닐
 * 땐 CSS로만 숨김) CSS visibility로만 감춘다. Preview.tsx의 첫 렌더 게이트 감지(hasRenderedOnce
 * → workbenchStore.previewReady)는 실제 iframe이 로드돼 있어야 동작하는데, 예전처럼 탭을 누를
 * 때만 마운트하면 그 iframe 자체가 탭을 누르기 전엔 존재하지 않아 감지할 방법이 없었다 — 바로
 * 위 Terminal 상시 마운트(WebContainer 셸 초기화 전용)와 똑같은 이유의 똑같은 패턴이다.
 */
export function MobileWorkspace({ chatColumnContent, setSelectedElement }: MobileWorkspaceProps) {
  const activeTab = useStore(mobileActiveTabStore);
  const previewReady = useStore(workbenchStore.previewReady);
  const bootFailed = useStore(workbenchStore.webcontainerBootFailed);
  const theme = useStore(themeStore);
  const [previewTabSeen, setPreviewTabSeen] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);

    const handler = (event: MediaQueryListEvent) => setPrefersReducedMotion(event.matches);
    mq.addEventListener('change', handler);

    return () => mq.removeEventListener('change', handler);
  }, []);

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
      <div className="flex-1 min-h-0 relative">
        <div className={classNames('absolute inset-0', activeTab === 'chat' ? '' : 'hidden')}>{chatColumnContent}</div>
        <div className={classNames('absolute inset-0', activeTab === 'preview' ? '' : 'hidden')}>
          {bootFailed ? (
            <div className="flex flex-col items-center justify-center gap-2 w-full h-full text-center px-8 bg-bolt-elements-background-depth-1">
              <div className="i-ph:warning-circle text-3xl text-bolt-elements-textTertiary" />
              <p className="text-sm text-bolt-elements-textSecondary">이 기기에서는 미리보기를 열 수 없어요</p>
              <p className="text-xs text-bolt-elements-textTertiary">컴퓨터에서 다시 확인해보세요</p>
            </div>
          ) : (
            <Preview setSelectedElement={setSelectedElement} />
          )}
        </div>
      </div>
      <nav className="flex shrink-0 border-t border-bolt-elements-borderColor bg-bolt-elements-background-depth-2">
        <button
          type="button"
          onClick={() => mobileActiveTabStore.set('chat')}
          aria-current={activeTab === 'chat'}
          className={classNames(
            'flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs transition-colors',
            activeTab === 'chat'
              ? 'text-bolt-elements-textPrimary'
              : 'text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary',
          )}
        >
          <div className="i-ph:chat-circle-text text-xl" />
          대화
        </button>
        {/*
          채팅 홈·생성 전환 통합 수정 — "미리보기" 탭 버튼은 previewReady(첫 렌더 게이트)가 켜지기
          전엔 아예 존재하지 않는다(4-2). 자동으로 이 탭으로 전환하지 않는다 — 사용자가 직접 눌러야만
          activeTab이 바뀐다(4-3, 기존 동작 그대로). 처음 나타날 때 옆의 코랄 점으로 "새로 생겼다"는
          걸 표시하고, 한 번이라도 누르면(previewTabSeen) 사라진다.
        */}
        <AnimatePresence>
          {previewReady && (
            <motion.button
              type="button"
              onClick={() => {
                mobileActiveTabStore.set('preview');
                setPreviewTabSeen(true);
              }}
              aria-current={activeTab === 'preview'}
              initial={prefersReducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
              className={classNames(
                'relative flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs transition-colors',
                activeTab === 'preview'
                  ? 'text-bolt-elements-textPrimary'
                  : 'text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary',
              )}
            >
              <div className="relative">
                <div className="i-ph:device-mobile-camera text-xl" />
                {!previewTabSeen && (
                  <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                )}
              </div>
              미리보기
            </motion.button>
          )}
        </AnimatePresence>
      </nav>
    </div>
  );
}
