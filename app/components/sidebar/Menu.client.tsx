import { motion, type Variants } from 'framer-motion';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from '@remix-run/react';
import { toast } from 'react-toastify';
import {
  Dialog,
  DialogButton,
  DialogDescription,
  DialogRoot,
  DialogTitle,
  dialogBackdropVariants,
} from '~/components/ui/Dialog';
import { SettingsButton } from '~/components/ui/SettingsButton';
import { Logo } from '~/components/ui/Logo';
import { db, deleteById, getAll, type ChatHistoryItem, useChatHistory } from '~/lib/persistence';
import { cubicEasingFn } from '~/utils/easings';
import { groupChatsByApp } from './groupChatsByApp';
import { AppGroup } from './AppGroup';
import { QuotaBar } from './QuotaBar';
import { useSearchFilter } from '~/lib/hooks/useSearchFilter';
import { classNames } from '~/utils/classNames';
import { useStore } from '@nanostores/react';
import { profileStore } from '~/lib/stores/profile';
import { sidebarOpenStore, setSidebarOpen } from '~/lib/stores/sidebar';
import { authUserStore, initAuthListener } from '~/lib/stores/auth';
import { isPlatformSupabaseConfigured } from '~/lib/supabase/platform-client';
import { Skeleton } from '~/components/ui/Skeleton';
import useViewport from '~/lib/hooks';
import styles from './Sidebar.module.scss';

/*
 * overnight5 B2: lazy-loaded, same rationale/pattern as Header.tsx's HeaderActionButtons —
 * ControlPanel pulls in every settings tab (providers, connections, event logs, etc.), but Menu
 * renders on essentially every page load while ControlPanel itself is only ever shown once the
 * user actually opens Settings. A static import here forced all of that into the sidebar's chunk
 * unconditionally; this defers it to first open instead.
 */
const ControlPanel = lazy(() =>
  import('~/components/@settings/core/ControlPanel').then((module) => ({ default: module.ControlPanel })),
);

// Mobile: fully off-canvas when closed, full-width overlay (with backdrop) when open.
const mobileVariants = {
  closed: {
    opacity: 0,
    visibility: 'hidden',
    left: '-340px',
    transition: { duration: 0.2, ease: cubicEasingFn },
  },
  open: {
    opacity: 1,
    visibility: 'initial',
    left: 0,
    transition: { duration: 0.2, ease: cubicEasingFn },
  },
} satisfies Variants;

/*
 * Desktop: always visible, pinned at left:0 — only its own width animates between a thin
 * collapsed rail and the full expanded panel. Content inside cross-fades via CSS (see
 * .railLayer/.contentLayer in Sidebar.module.scss) rather than remounting.
 */
const desktopVariants = {
  collapsed: { width: 64, transition: { duration: 0.2, ease: cubicEasingFn } },
  expanded: { width: 320, transition: { duration: 0.2, ease: cubicEasingFn } },
} satisfies Variants;

type DialogContent =
  | { type: 'delete'; item: ChatHistoryItem }
  | { type: 'bulkDelete'; items: ChatHistoryItem[] }
  | null;

export const Menu = () => {
  const { duplicateCurrentChat, exportChat } = useChatHistory();
  const { id: currentUrlId } = useParams();
  const menuRef = useRef<HTMLDivElement>(null);
  const [list, setList] = useState<ChatHistoryItem[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const open = useStore(sidebarOpenStore);
  const [dialogContent, setDialogContent] = useState<DialogContent>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const profile = useStore(profileStore);
  const authUser = useStore(authUserStore);
  const isSmallViewport = useViewport(1024);

  const { filteredItems: filteredList, handleSearchChange } = useSearchFilter({
    items: list,
    searchFields: ['description'],
  });

  const loadEntries = useCallback(() => {
    if (db) {
      setIsLoadingList(true);
      getAll(db)
        .then((list) => list.filter((item) => item.urlId && item.description))
        .then(setList)
        .catch((error) => toast.error(error.message))
        .finally(() => setIsLoadingList(false));
    } else {
      setIsLoadingList(false);
    }
  }, []);

  const deleteChat = useCallback(async (id: string): Promise<void> => {
    if (!db) {
      throw new Error('Database not available');
    }

    try {
      localStorage.removeItem(`snapshot:${id}`);
    } catch (snapshotError) {
      console.error(`Error deleting snapshot for chat ${id}:`, snapshotError);
    }

    await deleteById(db, id);
  }, []);

  const deleteItem = useCallback(
    (event: React.UIEvent, item: ChatHistoryItem) => {
      event.preventDefault();
      event.stopPropagation();

      deleteChat(item.id)
        .then(() => {
          toast.success('대화를 삭제했어요', { position: 'bottom-right', autoClose: 3000 });
          loadEntries();

          if (currentUrlId === item.urlId) {
            window.location.pathname = '/';
          }
        })
        .catch((error) => {
          console.error('Failed to delete chat:', error);
          toast.error('대화를 삭제하지 못했어요', { position: 'bottom-right', autoClose: 3000 });
          loadEntries();
        });
    },
    [loadEntries, deleteChat, currentUrlId],
  );

  const deleteSelectedItems = useCallback(
    async (itemsToDeleteIds: string[]) => {
      if (!db || itemsToDeleteIds.length === 0) {
        return;
      }

      let deletedCount = 0;
      const errors: string[] = [];
      const shouldNavigate = itemsToDeleteIds.some((id) => list.find((item) => item.id === id)?.urlId === currentUrlId);

      for (const id of itemsToDeleteIds) {
        try {
          await deleteChat(id);
          deletedCount++;
        } catch (error) {
          console.error(`Error deleting chat ${id}:`, error);
          errors.push(id);
        }
      }

      if (errors.length === 0) {
        toast.success(`대화 ${deletedCount}개를 삭제했어요`);
      } else {
        toast.warning(
          `대화 ${itemsToDeleteIds.length}개 중 ${deletedCount}개를 삭제했어요. ${errors.length}개는 실패했어요.`,
          { autoClose: 5000 },
        );
      }

      await loadEntries();

      if (shouldNavigate) {
        window.location.pathname = '/';
      }
    },
    [deleteChat, loadEntries, list, currentUrlId],
  );

  const closeDialog = () => setDialogContent(null);

  useEffect(() => {
    if (open) {
      loadEntries();
    }
  }, [open, loadEntries]);

  useEffect(() => {
    const unsubscribe = initAuthListener();
    return unsubscribe;
  }, []);

  const handleDuplicate = async (id: string) => {
    await duplicateCurrentChat(id);
    loadEntries();
  };

  const handleSettingsClick = () => {
    setIsSettingsOpen(true);
    setSidebarOpen(false);
  };

  const handleSettingsClose = () => setIsSettingsOpen(false);

  const setDialogContentWithLogging = useCallback((content: DialogContent) => {
    setDialogContent(content);
  }, []);

  const groups = groupChatsByApp(filteredList);

  /*
   * Desktop: thin rail when collapsed, full panel when expanded. Mobile: fully off-canvas when
   * closed (no rail — no room), full-width overlay when open.
   */
  const showRail = !isSmallViewport && !open;

  return (
    <>
      {open && isSmallViewport && (
        <motion.div
          className={styles.backdrop}
          initial="closed"
          animate="open"
          exit="closed"
          variants={dialogBackdropVariants}
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <motion.div
        ref={menuRef}
        initial={isSmallViewport ? 'closed' : 'collapsed'}
        animate={isSmallViewport ? (open ? 'open' : 'closed') : open ? 'expanded' : 'collapsed'}
        variants={isSmallViewport ? mobileVariants : desktopVariants}
        style={isSmallViewport ? { width: 'min(340px, calc(100vw - 40px))' } : undefined}
        className={classNames(styles.panel, 'selection-accent', isSettingsOpen ? 'z-40' : 'z-sidebar')}
      >
        <div className={classNames(styles.railLayer, { [styles.railLayerHidden]: !showRail })}>
          <button
            type="button"
            className={styles.railToggle}
            onClick={() => setSidebarOpen(true)}
            aria-label="사이드바 펼치기"
          >
            <Logo height={24} showWordmark={false} />
          </button>
        </div>

        <div className={classNames(styles.contentLayer, { [styles.contentLayerHidden]: showRail })}>
          {/* 1. 새 앱 만들기 */}
          <div className={styles.topRow}>
            {!isSmallViewport && (
              <button
                type="button"
                className={styles.collapseButton}
                onClick={() => setSidebarOpen(false)}
                aria-label="사이드바 접기"
              >
                <span className="i-ph:caret-line-left" />
              </button>
            )}
            <a href="/" className={styles.newAppButton}>
              <span className="i-ph:plus-circle" />새 앱 만들기
            </a>
          </div>

          {/* 2. 내 앱 목록 */}
          <div className={styles.searchRow}>
            <input
              className={styles.searchInput}
              type="search"
              placeholder="앱 검색..."
              onChange={handleSearchChange}
              aria-label="앱 검색"
            />
          </div>
          <div className={styles.appList}>
            {isLoadingList ? (
              <div className="space-y-2 px-1 pt-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : filteredList.length === 0 ? (
              <p className={styles.emptyCaption}>{list.length === 0 ? '아직 만든 앱이 없어요' : '찾는 앱이 없어요'}</p>
            ) : (
              groups.map((group) => (
                <AppGroup
                  key={group.key}
                  group={group}
                  exportChat={exportChat}
                  onDuplicate={handleDuplicate}
                  onDeleteChat={(event, item) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setDialogContentWithLogging({ type: 'delete', item });
                  }}
                  onDeleteGroup={(group) => setDialogContentWithLogging({ type: 'bulkDelete', items: group.items })}
                  defaultExpanded={group.items.some((item) => item.urlId === currentUrlId)}
                />
              ))
            )}
          </div>

          {/* 3. 계정 영역 */}
          <div className={styles.accountArea}>
            {authUser ? (
              <>
                <div className={styles.accountRow}>
                  <div className={styles.avatar}>
                    {profile?.avatar ? (
                      <img
                        src={profile.avatar}
                        alt={profile?.username || 'User'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="i-ph:user-fill" />
                    )}
                  </div>
                  <span className={styles.accountName}>
                    {authUser.user_metadata?.full_name || authUser.email || profile?.username || '내 계정'}
                  </span>
                  <SettingsButton onClick={handleSettingsClick} />
                </div>
                <a href="/pricing" className={styles.pricingLink}>
                  요금제
                </a>
              </>
            ) : (
              isPlatformSupabaseConfigured && (
                <a href="/login" className={styles.loginLink}>
                  로그인
                </a>
              )
            )}
            {/* 게스트도 무료 체험 횟수는 봐야 해서 authUser 분기 밖(둘 다 표시) — QuotaBar 자체가 문구를 구분한다. */}
            <QuotaBar />
          </div>
        </div>

        <DialogRoot open={dialogContent !== null}>
          <Dialog onBackdrop={closeDialog} onClose={closeDialog}>
            {dialogContent?.type === 'delete' && (
              <>
                <div className="p-6" style={{ background: '#FBF5EE' }}>
                  <DialogTitle style={{ color: '#1A1A1A' }}>대화를 삭제할까요?</DialogTitle>
                  <DialogDescription className="mt-2" style={{ color: '#8B7E70' }}>
                    <p>
                      <span style={{ color: '#1A1A1A', fontWeight: 500 }}>{dialogContent.item.description}</span> 대화를
                      삭제해요.
                    </p>
                    <p className="mt-2">삭제하면 되돌릴 수 없어요.</p>
                  </DialogDescription>
                </div>
                <div className="flex justify-end gap-3 px-6 py-4" style={{ background: '#F5EDE3' }}>
                  <DialogButton type="secondary" onClick={closeDialog}>
                    취소
                  </DialogButton>
                  <DialogButton
                    type="danger"
                    onClick={() => {
                      deleteItem({} as React.UIEvent, dialogContent.item);
                      closeDialog();
                    }}
                  >
                    삭제
                  </DialogButton>
                </div>
              </>
            )}
            {dialogContent?.type === 'bulkDelete' && (
              <>
                <div className="p-6" style={{ background: '#FBF5EE' }}>
                  <DialogTitle style={{ color: '#1A1A1A' }}>
                    {dialogContent.items.length > 1 ? '앱을 삭제할까요?' : '대화를 삭제할까요?'}
                  </DialogTitle>
                  <DialogDescription className="mt-2" style={{ color: '#8B7E70' }}>
                    <p>대화 {dialogContent.items.length}개를 삭제해요:</p>
                    <div
                      className="mt-2 max-h-32 overflow-auto rounded-md p-2"
                      style={{ border: '1px solid rgba(26,26,26,0.1)', background: '#F5EDE3' }}
                    >
                      <ul className="list-disc pl-5 space-y-1">
                        {dialogContent.items.map((item) => (
                          <li key={item.id} className="text-sm">
                            <span style={{ color: '#1A1A1A', fontWeight: 500 }}>{item.description}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <p className="mt-3">삭제하면 되돌릴 수 없어요.</p>
                  </DialogDescription>
                </div>
                <div className="flex justify-end gap-3 px-6 py-4" style={{ background: '#F5EDE3' }}>
                  <DialogButton type="secondary" onClick={closeDialog}>
                    취소
                  </DialogButton>
                  <DialogButton
                    type="danger"
                    onClick={() => {
                      const itemsToDeleteNow = dialogContent.items.map((item) => item.id);
                      deleteSelectedItems(itemsToDeleteNow);
                      closeDialog();
                    }}
                  >
                    삭제
                  </DialogButton>
                </div>
              </>
            )}
          </Dialog>
        </DialogRoot>
      </motion.div>

      <Suspense fallback={null}>
        <ControlPanel open={isSettingsOpen} onClose={handleSettingsClose} />
      </Suspense>
    </>
  );
};
