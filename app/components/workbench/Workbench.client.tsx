import { useStore } from '@nanostores/react';
import { motion, type HTMLMotionProps, type Variants } from 'framer-motion';
import { computed } from 'nanostores';
import { lazy, memo, Suspense, useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { toast } from 'react-toastify';
import { Popover, Transition } from '@headlessui/react';
import { useLocation } from '@remix-run/react';
import type { UIMessage } from 'ai';
import { diffLines, type Change } from 'diff';
import { getLanguageFromExtension } from '~/utils/getLanguageFromExtension';
import type { FileHistory } from '~/types/actions';
import { DiffViewErrorBoundary } from './DiffViewErrorBoundary';

/*
 * overnight3 B2: lazy-loaded — Workbench.client.tsx is already the deferred half of the app (see
 * BaseChat.tsx's own lazy(() => import('./Workbench.client'))), but within it DiffView is only
 * ever rendered when selectedView === 'diff'. Someone who only ever looks at the code/preview
 * tabs never needs this cost at all.
 */
const DiffView = lazy(() => import('./DiffView').then((module) => ({ default: module.DiffView })));
import {
  type OnChangeCallback as OnEditorChange,
  type OnScrollCallback as OnEditorScroll,
} from '~/components/editor/codemirror/CodeMirrorEditor';
import { IconButton } from '~/components/ui/IconButton';
import { Slider, type SliderOptions } from '~/components/ui/Slider';
import { workbenchStore, type WorkbenchViewType } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';
import { SHOW_DEV_TOOLS } from '~/utils/featureFlags';
import { cubicEasingFn, panelTransitionDurationSec, panelTransitionEasing } from '~/utils/easings';
import { createScopedLogger, renderLogger } from '~/utils/logger';
import { EditorPanel } from './EditorPanel';
import { Preview } from './Preview';

import { chatStore } from '~/lib/stores/chat';
import { setSidebarOpen } from '~/lib/stores/sidebar';
import type { ElementInfo } from './Inspector';
import { ExportChatButton } from '~/components/chat/chatExportAndImport/ExportChatButton';
import { useChatHistory } from '~/lib/persistence';
import { streamingState } from '~/lib/stores/streaming';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ConfirmationDialog } from '~/components/ui/Dialog';

const logger = createScopedLogger('Workbench');

interface WorkspaceProps {
  chatStarted?: boolean;
  isStreaming?: boolean;
  metadata?: {
    gitUrl?: string;
  };
  updateChatMestaData?: (metadata: any) => void;
  setSelectedElement?: (element: ElementInfo | null) => void;
  messages?: UIMessage[];
}

const viewTransition = { ease: cubicEasingFn };

const sliderOptions: SliderOptions<WorkbenchViewType> = {
  left: {
    value: 'code',
    text: '코드',
  },
  middle: {
    value: 'diff',
    text: '차이점',
  },
  right: {
    value: 'preview',
    text: '미리보기',
  },
};

/*
 * 채팅 홈·생성 전환 통합 수정 — 전환 시간/이징은 컴포넌트 안에서 prefers-reduced-motion에 따라
 * 갈리므로(motion.div의 transition prop으로 넘김) 여기서는 폭 키프레임만 정의한다.
 */
const workbenchVariants = {
  closed: {
    width: 0,
  },
  open: {
    width: 'var(--workbench-width)',
  },
} satisfies Variants;

const FileModifiedDropdown = memo(
  ({
    fileHistory,
    onSelectFile,
  }: {
    fileHistory: Record<string, FileHistory>;
    onSelectFile: (filePath: string) => void;
  }) => {
    const modifiedFiles = Object.entries(fileHistory);
    const hasChanges = modifiedFiles.length > 0;
    const [searchQuery, setSearchQuery] = useState('');

    const filteredFiles = useMemo(() => {
      return modifiedFiles.filter(([filePath]) => filePath.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [modifiedFiles, searchQuery]);

    return (
      <div className="flex items-center gap-2">
        <Popover className="relative">
          {({ open }: { open: boolean }) => (
            <>
              <Popover.Button className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3 transition-colors text-bolt-elements-item-contentDefault">
                <span>바뀐 파일</span>
                {hasChanges && (
                  <span className="w-5 h-5 rounded-full bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent text-xs flex items-center justify-center border border-[var(--accent-ring)]">
                    {modifiedFiles.length}
                  </span>
                )}
              </Popover.Button>
              <Transition
                show={open}
                enter="transition duration-100 ease-out"
                enterFrom="transform scale-95 opacity-0"
                enterTo="transform scale-100 opacity-100"
                leave="transition duration-75 ease-out"
                leaveFrom="transform scale-100 opacity-100"
                leaveTo="transform scale-95 opacity-0"
              >
                <Popover.Panel className="absolute right-0 z-20 mt-2 w-[min(320px,calc(100vw-2rem))] origin-top-right rounded-xl bg-bolt-elements-background-depth-2 shadow-xl border border-bolt-elements-borderColor">
                  <div className="p-2">
                    <div className="relative mx-2 mb-2">
                      <input
                        type="text"
                        placeholder="파일 검색..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      />
                      <div className="absolute left-2 top-1/2 -translate-y-1/2 text-bolt-elements-textTertiary">
                        <div className="i-ph:magnifying-glass" />
                      </div>
                    </div>

                    <div className="max-h-60 overflow-y-auto">
                      {filteredFiles.length > 0 ? (
                        filteredFiles.map(([filePath, history]) => {
                          const extension = filePath.split('.').pop() || '';
                          const language = getLanguageFromExtension(extension);

                          return (
                            <button
                              key={filePath}
                              onClick={() => onSelectFile(filePath)}
                              className="w-full px-3 py-2 text-left rounded-md hover:bg-bolt-elements-background-depth-1 transition-colors group bg-transparent"
                            >
                              <div className="flex items-center gap-2">
                                <div className="shrink-0 w-5 h-5 text-bolt-elements-textTertiary">
                                  {['typescript', 'javascript', 'jsx', 'tsx'].includes(language) && (
                                    <div className="i-ph:file-js" />
                                  )}
                                  {['css', 'scss', 'less'].includes(language) && <div className="i-ph:paint-brush" />}
                                  {language === 'html' && <div className="i-ph:code" />}
                                  {language === 'json' && <div className="i-ph:brackets-curly" />}
                                  {language === 'python' && <div className="i-ph:file-text" />}
                                  {language === 'markdown' && <div className="i-ph:article" />}
                                  {['yaml', 'yml'].includes(language) && <div className="i-ph:file-text" />}
                                  {language === 'sql' && <div className="i-ph:database" />}
                                  {language === 'dockerfile' && <div className="i-ph:cube" />}
                                  {language === 'shell' && <div className="i-ph:terminal" />}
                                  {![
                                    'typescript',
                                    'javascript',
                                    'css',
                                    'html',
                                    'json',
                                    'python',
                                    'markdown',
                                    'yaml',
                                    'yml',
                                    'sql',
                                    'dockerfile',
                                    'shell',
                                    'jsx',
                                    'tsx',
                                    'scss',
                                    'less',
                                  ].includes(language) && <div className="i-ph:file-text" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex flex-col min-w-0">
                                      <span className="truncate text-sm font-medium text-bolt-elements-textPrimary">
                                        {filePath.split('/').pop()}
                                      </span>
                                      <span className="truncate text-xs text-bolt-elements-textTertiary">
                                        {filePath}
                                      </span>
                                    </div>
                                    {(() => {
                                      // Calculate diff stats
                                      const { additions, deletions } = (() => {
                                        if (!history.originalContent) {
                                          return { additions: 0, deletions: 0 };
                                        }

                                        const normalizedOriginal = history.originalContent.replace(/\r\n/g, '\n');
                                        const normalizedCurrent =
                                          history.versions[history.versions.length - 1]?.content.replace(
                                            /\r\n/g,
                                            '\n',
                                          ) || '';

                                        if (normalizedOriginal === normalizedCurrent) {
                                          return { additions: 0, deletions: 0 };
                                        }

                                        const changes = diffLines(normalizedOriginal, normalizedCurrent, {
                                          newlineIsToken: false,
                                          ignoreWhitespace: true,
                                          ignoreCase: false,
                                        });

                                        return changes.reduce(
                                          (acc: { additions: number; deletions: number }, change: Change) => {
                                            if (change.added) {
                                              acc.additions += change.value.split('\n').length;
                                            }

                                            if (change.removed) {
                                              acc.deletions += change.value.split('\n').length;
                                            }

                                            return acc;
                                          },
                                          { additions: 0, deletions: 0 },
                                        );
                                      })();

                                      const showStats = additions > 0 || deletions > 0;

                                      return (
                                        showStats && (
                                          <div className="flex items-center gap-1 text-xs shrink-0">
                                            {additions > 0 && <span className="text-green-500">+{additions}</span>}
                                            {deletions > 0 && <span className="text-red-500">-{deletions}</span>}
                                          </div>
                                        )
                                      );
                                    })()}
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })
                      ) : (
                        <div className="flex flex-col items-center justify-center p-4 text-center">
                          <div className="w-12 h-12 mb-2 text-bolt-elements-textTertiary">
                            <div className="i-ph:file-dashed" />
                          </div>
                          <p className="text-sm font-medium text-bolt-elements-textPrimary">
                            {searchQuery ? '찾는 파일이 없어요' : '바뀐 파일이 없어요'}
                          </p>
                          <p className="text-xs text-bolt-elements-textTertiary mt-1">
                            {searchQuery ? '다른 검색어로 찾아보세요' : '수정하면 여기에 나타나요'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {hasChanges && (
                    <div className="border-t border-bolt-elements-borderColor p-2">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(filteredFiles.map(([filePath]) => filePath).join('\n'));
                          toast('파일 목록을 복사했어요', {
                            icon: <div className="i-ph:check-circle text-[var(--accent)]" />,
                          });
                        }}
                        className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-bolt-elements-background-depth-1 hover:bg-bolt-elements-background-depth-3 transition-colors text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary"
                      >
                        파일 목록 복사
                      </button>
                    </div>
                  )}
                </Popover.Panel>
              </Transition>
            </>
          )}
        </Popover>
      </div>
    );
  },
);

export const Workbench = memo(
  ({
    chatStarted,
    isStreaming,
    metadata: _metadata,
    updateChatMestaData: _updateChatMestaData,
    setSelectedElement,
    messages,
  }: WorkspaceProps) => {
    renderLogger.trace('Workbench');

    const [fileHistory, setFileHistory] = useState<Record<string, FileHistory>>({});

    /*
     * The chat message list has no persisted per-message timestamp (UIMessage carries none, and
     * adding one would mean new storage). This stamps "first time this component observed the
     * message" instead — accurate for checkpoints that arrive during the current session, but
     * messages already present at mount (a reloaded chat) all get stamped with the same mount
     * time. Documented as a known limitation rather than presented as a precise history.
     */
    const checkpointTimestamps = useRef<Map<string, number>>(new Map());
    const [rewindTarget, setRewindTarget] = useState<{ id: string; label: string } | null>(null);
    const location = useLocation();

    useEffect(() => {
      const now = Date.now();

      for (const message of messages ?? []) {
        if (message.role === 'assistant' && message.id && !checkpointTimestamps.current.has(message.id)) {
          checkpointTimestamps.current.set(message.id, now);
        }
      }
    }, [messages]);

    const checkpoints = useMemo(() => {
      return (messages ?? [])
        .filter((message) => message.role === 'assistant' && message.id)
        .map((message) => {
          const summaryPart = message.parts?.find((part: any) => part.type === 'data-chatSummary') as any;
          const summary = summaryPart?.data?.summary as string | undefined;
          const textPart = message.parts?.find((part: any) => part.type === 'text') as any;
          const fallback = ((textPart?.text as string) || '')
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 28);

          return {
            id: message.id,
            label: summary || fallback || '응답',
            time: checkpointTimestamps.current.get(message.id),
          };
        })
        .reverse();
    }, [messages]);

    const formatCheckpointTime = (time: number | undefined) => {
      if (!time) {
        return null;
      }

      return new Intl.DateTimeFormat('ko-KR', { hour: 'numeric', minute: '2-digit', hour12: true }).format(
        new Date(time),
      );
    };

    const requestRewind = (id: string, label: string) => setRewindTarget({ id, label });

    const confirmRewind = () => {
      if (!rewindTarget) {
        return;
      }

      const searchParams = new URLSearchParams(location.search);
      searchParams.set('rewindTo', rewindTarget.id);
      window.location.search = searchParams.toString();
    };

    // const modifiedFiles = Array.from(useStore(workbenchStore.unsavedFiles).keys());

    const hasPreview = useStore(computed(workbenchStore.previews, (previews) => previews.length > 0));
    const showWorkbench = useStore(workbenchStore.showWorkbench);
    const previewReady = useStore(workbenchStore.previewReady);

    /*
     * 채팅 홈·생성 전환 통합 수정 — showWorkbench를 여는 유일한 트리거. previewReady는
     * Preview.tsx가 첫 컴파일 성공(또는 15초 타임아웃 폴백) 시에만 세팅하므로, 컴파일이 끝내
     * 성공하지 못한 채 생성이 에러로 끝나면 이 effect가 아예 실행되지 않아 패널이 자동으로
     * 열리지 않는다. 이미 열려 있으면(다음 메시지에서 재실행돼도) set(true)는 멱등이라 안전하다.
     */
    useEffect(() => {
      if (previewReady) {
        workbenchStore.setShowWorkbench(true);
      }
    }, [previewReady]);

    /*
     * chatStore.workbenchOpen 미러링 — BaseChat.tsx는 workbenchStore를 직접 구독하지 않고(무거운
     * 지연 로딩 그래프를 끌어오지 않으려고) 이 값만 보고 .Chat 칼럼 폭을 즉시 고정한다.
     */
    useEffect(() => {
      chatStore.setKey('workbenchOpen', showWorkbench);
    }, [showWorkbench]);

    // 채팅 홈·생성 전환 통합 수정 — 2단 전환/미리보기 페이드의 모션 감소 분기 (PromptClarification.tsx와 동일 패턴).
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

    useEffect(() => {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      setPrefersReducedMotion(mq.matches);

      const handler = (event: MediaQueryListEvent) => setPrefersReducedMotion(event.matches);
      mq.addEventListener('change', handler);

      return () => mq.removeEventListener('change', handler);
    }, []);

    /*
     * Sidebar auto-collapses the moment the workbench/preview opens, so attention goes to the
     * result — a one-shot trigger on the false->true transition (via the ref below), not a
     * continuous "keep it closed" rule, so the user can still reopen the sidebar afterward without
     * this fighting them.
     */
    const hasAutoCollapsedRef = useRef(false);

    useEffect(() => {
      if (showWorkbench && !hasAutoCollapsedRef.current) {
        hasAutoCollapsedRef.current = true;
        setSidebarOpen(false);
      } else if (!showWorkbench) {
        hasAutoCollapsedRef.current = false;
      }
    }, [showWorkbench]);

    const selectedFile = useStore(workbenchStore.selectedFile);
    const currentDocument = useStore(workbenchStore.currentDocument);
    const unsavedFiles = useStore(workbenchStore.unsavedFiles);
    const files = useStore(workbenchStore.files);
    const selectedView = useStore(workbenchStore.currentView);
    const { showChat } = useStore(chatStore);
    const canHideChat = showWorkbench || !showChat;

    /*
     * 개발자용 UI 정리 (overnight5) — currentView로 가는 경로가 여러 곳에 있다(파일 잠금 충돌,
     * AssistantMessage의 요약 안 코드 배지 클릭 등). 그 경로들을 일일이 다 막는 대신, 실제로
     * "무엇을 보여줄지" 결정하는 지점(여기)에서 한 번만 클램프한다 — SHOW_DEV_TOOLS가 꺼져 있으면
     * currentView가 뭘로 세팅되든 항상 미리보기만 보여준다. 저장된 값 자체는 안 건드리므로,
     * 개발자 모드를 다시 켜면 기존 코드/차이점 탭 동작이 그대로 돌아온다.
     */
    const effectiveView = SHOW_DEV_TOOLS ? selectedView : 'preview';

    const streaming = useStore(streamingState);
    const { exportChat } = useChatHistory();
    const [isSyncing, setIsSyncing] = useState(false);

    const setSelectedView = (view: WorkbenchViewType) => {
      workbenchStore.currentView.set(view);
    };

    useEffect(() => {
      if (hasPreview) {
        setSelectedView('preview');
      }
    }, [hasPreview]);

    useEffect(() => {
      workbenchStore.setDocuments(files);
    }, [files]);

    const onEditorChange = useCallback<OnEditorChange>((update) => {
      workbenchStore.setCurrentDocumentContent(update.content);
    }, []);

    const onEditorScroll = useCallback<OnEditorScroll>((position) => {
      workbenchStore.setCurrentDocumentScrollPosition(position);
    }, []);

    const onFileSelect = useCallback((filePath: string | undefined) => {
      workbenchStore.setSelectedFile(filePath);
    }, []);

    const onFileSave = useCallback(() => {
      workbenchStore
        .saveCurrentDocument()
        .then(() => {
          // Explicitly refresh all previews after a file save
          workbenchStore.refreshAllPreviews();
        })
        .catch(() => {
          toast.error('파일을 저장하지 못했어요');
        });
    }, []);

    const onFileReset = useCallback(() => {
      workbenchStore.resetCurrentDocument();
    }, []);

    const handleSelectFile = useCallback((filePath: string) => {
      workbenchStore.setSelectedFile(filePath);
      workbenchStore.currentView.set('diff');
    }, []);

    const handleSyncFiles = useCallback(async () => {
      setIsSyncing(true);

      try {
        const directoryHandle = await window.showDirectoryPicker();
        await workbenchStore.syncFiles(directoryHandle);
        toast.success('파일을 저장했어요');
      } catch (error) {
        logger.error('Error syncing files:', error);
        toast.error('파일을 저장하지 못했어요');
      } finally {
        setIsSyncing(false);
      }
    }, []);

    return (
      chatStarted && (
        <>
          {/*
            채팅·미리보기 화면 수정 — 예전엔 이 폭-애니메이션 motion.div는 flex 레이아웃 안에서
            공간만 예약하고, 실제로 보이는 카드는 position:fixed + left(--workbench-left)로 따로
            떠 있었다. --workbench-left는 뷰포트 폭 기준 100%에서 역산한 값이라 .ChatArea의
            사이드바 레일 padding-left(64px)를 몰랐고, 그만큼 항상 왼쪽으로 더 파고들어 대화
            카드/스크롤바를 가렸다. 이제 폭-애니메이션 motion.div 자체가 실제 카드를 담아 flex
            형제(.Chat)로서 자연스럽게 자리를 잡는다 — 뷰포트 기준 좌표 계산이 아예 없어져서
            같은 종류의 어긋남이 구조적으로 재발할 수 없다.
          */}
          <motion.div
            initial="closed"
            animate={showWorkbench ? 'open' : 'closed'}
            variants={workbenchVariants}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { duration: panelTransitionDurationSec, ease: panelTransitionEasing }
            }
            className="z-workbench h-full overflow-hidden"
          >
            <div className="h-full w-[var(--workbench-inner-width)] pt-[1.2rem] pb-6 px-2 lg:px-4">
              <div className="h-full flex flex-col bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor shadow-sm rounded-lg overflow-hidden">
                {SHOW_DEV_TOOLS && (
                  <div
                    className="flex items-center px-3 py-2 border-b border-bolt-elements-borderColor gap-1.5"
                    style={{
                      backdropFilter: 'blur(12px)',
                      background: 'color-mix(in oklch, var(--bg) 85%, transparent)',
                    }}
                  >
                    <button
                      className={`${showChat ? 'i-ph:sidebar-simple-fill' : 'i-ph:sidebar-simple'} text-lg text-bolt-elements-textSecondary mr-1`}
                      title={showChat ? '채팅 숨기기' : '채팅 보이기'}
                      aria-label={showChat ? '채팅 숨기기' : '채팅 보이기'}
                      disabled={!canHideChat}
                      onClick={() => {
                        if (canHideChat) {
                          chatStore.setKey('showChat', !showChat);
                        }
                      }}
                    />
                    {SHOW_DEV_TOOLS && (
                      <Slider selected={selectedView} options={sliderOptions} setSelected={setSelectedView} />
                    )}
                    <div className="ml-auto" />
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger asChild>
                        <IconButton icon="i-ph:clock-counter-clockwise" title="이전 시점으로 되돌리기" />
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Content
                        className={classNames(
                          'min-w-[280px] max-h-[360px] overflow-y-auto z-[250]',
                          'bg-[var(--surface-2)] text-bolt-elements-textPrimary',
                          'rounded-lg shadow-[var(--shadow-overlay,0_20px_50px_rgba(23,16,14,0.18))]',
                          'border border-bolt-elements-borderColor',
                          'animate-in fade-in-0 zoom-in-95',
                          'py-1',
                        )}
                        sideOffset={5}
                        align="end"
                      >
                        <div className="px-3 py-1.5 text-xs text-bolt-elements-textTertiary">
                          되돌아갈 시점을 골라주세요
                        </div>
                        {checkpoints.length === 0 && (
                          <div className="px-3 py-2 text-sm text-bolt-elements-textTertiary">
                            아직 되돌아갈 시점이 없어요
                          </div>
                        )}
                        {checkpoints.map((checkpoint) => (
                          <DropdownMenu.Item
                            key={checkpoint.id}
                            className="cursor-pointer flex flex-col items-start w-full px-3 py-2 text-sm text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive gap-0.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-bolt-elements-focus transition-colors duration-150 ease-out"
                            onClick={() => requestRewind(checkpoint.id, checkpoint.label)}
                          >
                            {formatCheckpointTime(checkpoint.time) && (
                              <span className="text-xs text-bolt-elements-textTertiary">
                                {formatCheckpointTime(checkpoint.time)}
                              </span>
                            )}
                            <span className="truncate w-full">{checkpoint.label}</span>
                          </DropdownMenu.Item>
                        ))}
                      </DropdownMenu.Content>
                    </DropdownMenu.Root>
                    {effectiveView === 'code' && (
                      <div className="flex overflow-y-auto">
                        {/* Export Chat Button */}
                        <ExportChatButton exportChat={exportChat} />

                        {/* Sync Button */}
                        <div className="flex border border-bolt-elements-borderColor rounded-md overflow-hidden ml-1">
                          <DropdownMenu.Root>
                            <DropdownMenu.Trigger
                              disabled={isSyncing || streaming}
                              className="rounded-md items-center justify-center [&:is(:disabled,.disabled)]:cursor-not-allowed [&:is(:disabled,.disabled)]:opacity-60 px-3 py-1.5 text-xs bg-[var(--accent)] text-[var(--on-accent)] [&:not(:disabled,.disabled)]:hover:opacity-[0.85] outline-[var(--accent)] flex gap-1.7"
                            >
                              {isSyncing ? '저장 중...' : '저장'}
                              <span className={classNames('i-ph:caret-down transition-transform')} />
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Content
                              className={classNames(
                                'min-w-[240px] z-[250]',
                                'bg-[var(--surface-2)] text-bolt-elements-textPrimary',
                                'rounded-lg shadow-[var(--shadow-overlay,0_20px_50px_rgba(23,16,14,0.18))]',
                                'border border-bolt-elements-borderColor',
                                'animate-in fade-in-0 zoom-in-95',
                                'py-1',
                              )}
                              sideOffset={5}
                              align="end"
                            >
                              <DropdownMenu.Item
                                className={classNames(
                                  'cursor-pointer flex items-center w-full px-4 py-2 text-sm text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive gap-2 rounded-md group relative',
                                )}
                                onClick={handleSyncFiles}
                                disabled={isSyncing}
                              >
                                <div className="flex items-center gap-2">
                                  {isSyncing ? (
                                    <div className="i-ph:spinner" />
                                  ) : (
                                    <div className="i-ph:cloud-arrow-down" />
                                  )}
                                  <span>{isSyncing ? '저장 중...' : '파일 저장'}</span>
                                </div>
                              </DropdownMenu.Item>
                            </DropdownMenu.Content>
                          </DropdownMenu.Root>
                        </div>

                        {/* Toggle Terminal Button */}
                        <div className="flex border border-bolt-elements-borderColor rounded-md overflow-hidden ml-1">
                          <button
                            onClick={() => {
                              workbenchStore.toggleTerminal(!workbenchStore.showTerminal.get());
                            }}
                            className="rounded-md items-center justify-center [&:is(:disabled,.disabled)]:cursor-not-allowed [&:is(:disabled,.disabled)]:opacity-60 px-3 py-1.5 text-xs bg-[var(--accent)] text-[var(--on-accent)] [&:not(:disabled,.disabled)]:hover:opacity-[0.85] outline-[var(--accent)] flex gap-1.7"
                          >
                            <div className="i-ph:terminal" />
                            터미널
                          </button>
                        </div>
                      </div>
                    )}

                    {effectiveView === 'diff' && (
                      <FileModifiedDropdown fileHistory={fileHistory} onSelectFile={handleSelectFile} />
                    )}
                  </div>
                )}
                <div className="relative flex-1 overflow-hidden">
                  <View initial={{ x: '0%' }} animate={{ x: effectiveView === 'code' ? '0%' : '-100%' }}>
                    <EditorPanel
                      editorDocument={currentDocument}
                      isStreaming={isStreaming}
                      selectedFile={selectedFile}
                      files={files}
                      unsavedFiles={unsavedFiles}
                      fileHistory={fileHistory}
                      onFileSelect={onFileSelect}
                      onEditorScroll={onEditorScroll}
                      onEditorChange={onEditorChange}
                      onFileSave={onFileSave}
                      onFileReset={onFileReset}
                    />
                  </View>
                  {effectiveView === 'diff' && (
                    <div className="absolute inset-0">
                      <DiffViewErrorBoundary>
                        <Suspense fallback={null}>
                          <DiffView fileHistory={fileHistory} setFileHistory={setFileHistory} />
                        </Suspense>
                      </DiffViewErrorBoundary>
                    </div>
                  )}
                  {/*
                      채팅 홈·생성 전환 통합 수정 — 첫 렌더 시 데스크톱 2단 전환: 미리보기가
                      워크벤치 폭 애니메이션과 동시에(순차 아님) 옅은 스케일(0.985→1)과 함께
                      페이드인된다. x축 슬라이드(코드/차이점/미리보기 내부 탭 전환, SHOW_DEV_TOOLS
                      전용)는 기존 viewTransition 타이밍 그대로 — opacity/scale만 새 패널 전환
                      타이밍(panelTransitionDurationSec/panelTransitionEasing)을 쓴다.
                    */}
                  <View
                    initial={{ x: '100%' }}
                    animate={{
                      x: effectiveView === 'preview' ? '0%' : '100%',
                      opacity: showWorkbench ? 1 : 0,
                      scale: !showWorkbench && !prefersReducedMotion ? 0.985 : 1,
                    }}
                    transition={{
                      x: viewTransition,
                      opacity: prefersReducedMotion
                        ? { duration: 0.15 }
                        : { duration: panelTransitionDurationSec, ease: panelTransitionEasing },
                      scale: prefersReducedMotion
                        ? { duration: 0 }
                        : { duration: panelTransitionDurationSec, ease: panelTransitionEasing },
                    }}
                  >
                    <Preview setSelectedElement={setSelectedElement} />
                  </View>
                </div>
              </div>
            </div>
          </motion.div>
          <ConfirmationDialog
            isOpen={!!rewindTarget}
            onClose={() => setRewindTarget(null)}
            onConfirm={confirmRewind}
            title="이 시점으로 되돌릴까요?"
            description={`"${rewindTarget?.label ?? ''}" 시점 이후에 만든 내용이 사라져요.`}
            confirmLabel="되돌리기"
            cancelLabel="취소"
            variant="destructive"
          />
        </>
      )
    );
  },
);

// View component for rendering content with motion transitions
interface ViewProps extends HTMLMotionProps<'div'> {
  children: JSX.Element;
}

const View = memo(({ children, ...props }: ViewProps) => {
  return (
    <motion.div className="absolute inset-0" transition={viewTransition} {...props}>
      {children}
    </motion.div>
  );
});
