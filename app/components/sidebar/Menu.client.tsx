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
import { Logo } from '~/components/ui/Logo';
import { db, deleteById, getAll, type ChatHistoryItem, useChatHistory } from '~/lib/persistence';
import { cubicEasingFn } from '~/utils/easings';
import { groupChatsByApp, type AppGroup as AppGroupData } from './groupChatsByApp';
import { groupChatsByDate } from './groupChatsByDate';
import { AppGroup } from './AppGroup';
import { QuotaBar } from './QuotaBar';
import { AccountMenu } from './AccountMenu';
import type { TabType } from '~/components/@settings/core/types';
import { classNames } from '~/utils/classNames';
import { useStore } from '@nanostores/react';
import { profileStore } from '~/lib/stores/profile';
import { sidebarOpenStore, setSidebarOpen, toggleSidebar } from '~/lib/stores/sidebar';
import { authUserStore } from '~/lib/stores/auth';
import { isPlatformSupabaseConfigured } from '~/lib/supabase/platform-client';
import { deployedAppsByChatId, refreshDeployedApps, type DeployedAppRecord } from '~/lib/deployedApps';
import { Skeleton } from '~/components/ui/Skeleton';
import useViewport from '~/lib/hooks';
import styles from './Sidebar.module.scss';

const VISIBLE_GROUPS_LIMIT = 20;

function findDeployedInGroup(
  group: AppGroupData,
  deployedById: Map<string, DeployedAppRecord>,
): DeployedAppRecord | undefined {
  for (const item of group.items) {
    const record = item.urlId ? deployedById.get(item.urlId) : undefined;

    if (record) {
      return record;
    }
  }

  return undefined;
}

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
 * Desktop: always visible, pinned at left:0 — only its own width animates between fully collapsed
 * (0 — no visible box at all, see Menu's .railHamburger/.railHomeLink for what stands in for it) and the full
 * expanded panel.
 */
const desktopVariants = {
  collapsed: { width: 0, transition: { duration: 0.2, ease: cubicEasingFn } },
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
  const [settingsInitialTab, setSettingsInitialTab] = useState<TabType | null>(null);
  const deployedById = useStore(deployedAppsByChatId);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllGroups, setShowAllGroups] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 2-7: 사이드바 마운트(및 로그인 상태 변화) 시 한 번만 받는다 — 항목마다 조회하지 않는다.
  useEffect(() => {
    if (authUser) {
      refreshDeployedApps();
    }
  }, [authUser]);

  /*
   * 게스트 상태에서는 대화 목록을 아예 렌더하지 않는다(로그인 여부 조건) — 공용 PC에서 로그아웃한
   * 다음 사용자가 이전 계정의 목록을 보는 걸 막기 위한 개인정보 조치. IndexedDB 자체는 로컬
   * 전용이라 계정으로 구분되지 않으므로, 로그인 여부로 화면 노출을 막는 게 지금 유일한 방어선.
   */
  const loadEntries = useCallback(() => {
    if (!authUser) {
      setList([]);
      setIsLoadingList(false);

      return;
    }

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
  }, [authUser]);

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
    if (open || !authUser) {
      loadEntries();
    }
  }, [open, authUser, loadEntries]);

  /*
   * 3: 바깥(포인터다운) 또는 ESC로 닫힌다 — preventDefault/stopPropagation을 쓰지 않아서 클릭
   * 이벤트가 원래 타겟(예: 입력창)에도 그대로 도달한다. 그래서 사이드바가 열린 채로 입력창을
   * 누르면 "사이드바 닫힘"과 "입력창 포커스"가 같은 클릭에서 동시에 일어난다(두 번 클릭 불필요).
   * menuRef(패널) 안 클릭과 [data-sidebar-toggle] 클릭은 제외 — 패널 안 클릭(앱 선택/삭제)은
   * 원래 닫힘을 유발하면 안 되고, 토글 버튼은 자체 onClick으로 이미 토글하므로 이 리스너가 같은
   * 클릭에서 또 닫아버리면(=순서상 열자마자 닫힘) 안 된다. data-sidebar-toggle 속성 기반이라
   * 데스크톱 레일 햄버거뿐 아니라 Header.tsx의 모바일 햄버거(별도 컴포넌트, ref 공유 불가)도
   * 같은 방식으로 제외된다. 데스크톱/모바일 오버레이 공용.
   */
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      const targetEl = target instanceof Element ? target : (target as ChildNode).parentElement;

      if (menuRef.current?.contains(target) || targetEl?.closest('[data-sidebar-toggle]')) {
        return;
      }

      setSidebarOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSidebarOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const handleDuplicate = async (id: string) => {
    await duplicateCurrentChat(id);
    loadEntries();
  };

  const handleOpenSettings = (tab: TabType | null = null) => {
    setSettingsInitialTab(tab);
    setIsSettingsOpen(true);
    setSidebarOpen(false);
  };

  const handleSettingsClose = () => setIsSettingsOpen(false);

  const setDialogContentWithLogging = useCallback((content: DialogContent) => {
    setDialogContent(content);
  }, []);

  const normalizedQuery = searchQuery.trim().toLowerCase().replace(/\s+/g, '');
  const isSearching = normalizedQuery.length > 0;
  const filteredList = isSearching
    ? list.filter((item) => (item.description ?? '').toLowerCase().replace(/\s+/g, '').includes(normalizedQuery))
    : list;

  const allGroups = groupChatsByApp(filteredList);
  const visibleGroups = isSearching || showAllGroups ? allGroups : allGroups.slice(0, VISIBLE_GROUPS_LIMIT);
  const hiddenGroupsCount = allGroups.length - visibleGroups.length;
  const dateBuckets = groupChatsByDate(visibleGroups, (group) => group.latestTimestamp);

  const handleRailSearchClick = () => {
    setSidebarOpen(true);
    requestAnimationFrame(() => searchInputRef.current?.focus());
  };

  return (
    <>
      {open && isSmallViewport && (
        <motion.div
          className={styles.backdrop}
          initial="closed"
          animate="open"
          exit="closed"
          variants={dialogBackdropVariants}
        />
      )}
      {/*
        좌상단 순서 = 위 로고(홈) / 아래 햄버거(토글), 40x40 동일 히트 영역·같은 왼쪽 정렬축.
        햄버거는 별도의 position:fixed 요소로 분리해 z-logo(998, .panel의 z-sidebar=997보다 위)를
        줘서 사이드바가 펼쳐져도 같은 좌표·같은 아이콘으로 그 위에 남는다 — "같은 자리 같은
        아이콘 = 토글"을 몸으로 알 수 있게. 로고는 항상 낮은 z-index로 남아 패널이 펼쳐지면 그
        아래 자연스럽게 가려진다(패널 내부에 중복으로 두지 않음). 데스크톱 전용(모바일은 이 대체
        UI 자체가 필요 없음 — 접혔을 때 화면 밖으로 완전히 사라지는 기존 동작 그대로).
      */}
      {!isSmallViewport && (
        <>
          <a href="/" title="홈" aria-label="홈" className={styles.railHomeLink}>
            <Logo height={24} showWordmark={false} />
          </a>
          <button
            type="button"
            title="메뉴"
            aria-label="메뉴"
            data-sidebar-toggle
            className={classNames(styles.railHamburger, 'z-logo')}
            onClick={toggleSidebar}
          >
            <div className={classNames('i-ph:list', styles.railHamburgerIcon)} style={{ fontSize: 20 }} />
          </button>
          {!open && (
            <button
              type="button"
              title="대화 검색"
              aria-label="대화 검색"
              className={classNames(styles.railSearchButton, 'z-logo')}
              onClick={handleRailSearchClick}
            >
              <span className="i-ph:magnifying-glass" style={{ fontSize: 18 }} />
            </button>
          )}
        </>
      )}
      <motion.div
        ref={menuRef}
        initial={isSmallViewport ? 'closed' : 'collapsed'}
        animate={isSmallViewport ? (open ? 'open' : 'closed') : open ? 'expanded' : 'collapsed'}
        variants={isSmallViewport ? mobileVariants : desktopVariants}
        style={isSmallViewport ? { width: 'min(340px, calc(100vw - 40px))' } : undefined}
        className={classNames(
          styles.panel,
          { [styles.panelExpanded]: open },
          'selection-accent',
          isSettingsOpen ? 'z-40' : 'z-sidebar',
        )}
      >
        <div className={styles.contentLayer}>
          {/* 1. 대화 검색 + 새 앱 만들기 — 로고는 좌상단 고정 아이콘 하나로 통일, 패널 내부엔 중복으로 두지 않는다. */}
          <div className={styles.topRow}>
            <div className={styles.searchBox}>
              <span className={classNames('i-ph:magnifying-glass', styles.searchBoxIcon)} />
              <input
                ref={searchInputRef}
                type="text"
                className={styles.searchBoxInput}
                placeholder="대화 검색"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className={styles.searchClearButton}
                  aria-label="검색어 지우기"
                  onClick={() => setSearchQuery('')}
                >
                  <span className="i-ph:x" />
                </button>
              )}
            </div>
            <a href="/" className={styles.newAppButton}>
              <span className="i-ph:plus-circle" />새 앱 만들기
            </a>
          </div>

          {/* 2. 내 앱 목록 — 날짜 구간(3) 안에 앱 그룹, 배포된 앱은 compact 프레임(2) */}
          <div className={styles.appList}>
            {isLoadingList ? (
              <div className="space-y-2 px-1 pt-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : list.length === 0 ? (
              <p className={styles.emptyCaption}>아직 만든 앱이 없어요</p>
            ) : isSearching && allGroups.length === 0 ? (
              <p className={styles.emptyCaption}>찾는 대화가 없어요</p>
            ) : (
              <>
                {dateBuckets.map((bucket) => (
                  <div key={bucket.label}>
                    <p className={styles.dateHeader}>{bucket.label}</p>
                    {bucket.items.map((group) => (
                      <AppGroup
                        key={group.key}
                        group={group}
                        deployedApp={findDeployedInGroup(group, deployedById)}
                        exportChat={exportChat}
                        onDuplicate={handleDuplicate}
                        onDeleteChat={(event, item) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setDialogContentWithLogging({ type: 'delete', item });
                        }}
                        onDeleteGroup={(group) =>
                          setDialogContentWithLogging({ type: 'bulkDelete', items: group.items })
                        }
                        defaultExpanded={group.items.some((item) => item.urlId === currentUrlId)}
                      />
                    ))}
                  </div>
                ))}
                {hiddenGroupsCount > 0 && (
                  <button type="button" className={styles.moreLink} onClick={() => setShowAllGroups(true)}>
                    이전 대화 {hiddenGroupsCount}개 더 보기
                  </button>
                )}
              </>
            )}
          </div>

          {/* 3. 계정 영역 — 이름/아바타를 누르면 프로필·설정·요금제·로그아웃 메뉴가 열린다. */}
          <div className={styles.accountArea}>
            {authUser ? (
              <AccountMenu onOpenSettings={handleOpenSettings}>
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
                <span className="i-ph:caret-up-down" style={{ color: '#6E645B', flexShrink: 0 }} />
              </AccountMenu>
            ) : (
              <>
                {isPlatformSupabaseConfigured && (
                  <a href="/login" className={styles.loginLink}>
                    로그인
                  </a>
                )}
                {/* D-1: 로그인 계정의 사용량 텍스트는 계정 메뉴로 옮겼다(AccountUsageBlock) — 게스트는
                    계정 메뉴 자체가 없어 QuotaBar를 그대로 둔다. */}
                <QuotaBar />
              </>
            )}
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
        <ControlPanel open={isSettingsOpen} onClose={handleSettingsClose} initialTab={settingsInitialTab} />
      </Suspense>
    </>
  );
};
