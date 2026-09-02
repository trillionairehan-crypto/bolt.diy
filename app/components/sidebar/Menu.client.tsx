import { motion, type Variants } from 'framer-motion';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useParams } from '@remix-run/react';
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
import { Tooltip } from '~/components/ui/Tooltip';
import { MiniBrowserFrame } from '~/components/ui/MiniBrowserFrame';
import { db, deleteById, getAll, type ChatHistoryItem } from '~/lib/persistence';
import { cubicEasingFn } from '~/utils/easings';
import { groupChatsByApp, type AppGroup as AppGroupData } from './groupChatsByApp';
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
import useViewport from '~/lib/hooks';
import styles from './Sidebar.module.scss';

const RECENT_ITEMS_LIMIT = 5;

const NAV_ITEMS = [
  { href: '/', label: '홈', icon: 'i-ph:house' },
  { href: '/apps', label: '내 앱', icon: 'i-ph:squares-four' },
  { href: '/examples', label: '예시로 시작하기', icon: 'i-ph:sparkle' },
  { href: '/guide', label: '이용 가이드', icon: 'i-ph:book-open' },
] as const;

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
 * (0 — no visible box at all, see Menu's .rail for what stands in for it) and the full expanded
 * panel (280px).
 */
const desktopVariants = {
  collapsed: { width: 0, transition: { duration: 0.2, ease: cubicEasingFn } },
  expanded: { width: 280, transition: { duration: 0.2, ease: cubicEasingFn } },
} satisfies Variants;

type DialogContent = { type: 'delete'; item: ChatHistoryItem } | null;

export const Menu = () => {
  const { id: currentUrlId } = useParams();
  const location = useLocation();
  const menuRef = useRef<HTMLDivElement>(null);
  const [list, setList] = useState<ChatHistoryItem[]>([]);
  const open = useStore(sidebarOpenStore);
  const [dialogContent, setDialogContent] = useState<DialogContent>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const profile = useStore(profileStore);
  const authUser = useStore(authUserStore);
  const isSmallViewport = useViewport(1024);
  const [settingsInitialTab, setSettingsInitialTab] = useState<TabType | null>(null);
  const deployedById = useStore(deployedAppsByChatId);

  // 사이드바 마운트(및 로그인 상태 변화) 시 한 번만 받는다 — 항목마다 조회하지 않는다.
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
      return;
    }

    if (db) {
      getAll(db)
        .then((list) => list.filter((item) => item.urlId && item.description))
        .then(setList)
        .catch((error) => toast.error(error.message));
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

  const closeDialog = () => setDialogContent(null);

  useEffect(() => {
    if (open || !authUser) {
      loadEntries();
    }
  }, [open, authUser, loadEntries]);

  /*
   * 바깥(포인터다운) 또는 ESC로 닫힌다 — preventDefault/stopPropagation을 쓰지 않아서 클릭
   * 이벤트가 원래 타겟(예: 입력창)에도 그대로 도달한다. 그래서 사이드바가 열린 채로 입력창을
   * 누르면 "사이드바 닫힘"과 "입력창 포커스"가 같은 클릭에서 동시에 일어난다(두 번 클릭 불필요).
   * menuRef(패널) 안 클릭과 [data-sidebar-toggle] 클릭은 제외 — 패널 안 클릭(항목 선택/삭제)은
   * 원래 닫힘을 유발하면 안 되고, 토글 버튼은 자체 onClick으로 이미 토글하므로 이 리스너가 같은
   * 클릭에서 또 닫아버리면(=순서상 열자마자 닫힘) 안 된다. data-sidebar-toggle 속성 기반이라
   * 레일 토글뿐 아니라 Header.tsx의 모바일 햄버거(별도 컴포넌트, ref 공유 불가)도 같은 방식으로
   * 제외된다. 데스크톱/모바일 오버레이 공용.
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

  const handleOpenSettings = (tab: TabType | null = null) => {
    setSettingsInitialTab(tab);
    setIsSettingsOpen(true);
    setSidebarOpen(false);
  };

  const handleSettingsClose = () => setIsSettingsOpen(false);

  const allGroups = groupChatsByApp(list);
  const recentGroups = allGroups.slice(0, RECENT_ITEMS_LIMIT);
  const hasMoreRecent = allGroups.length > RECENT_ITEMS_LIMIT;

  const accountTrigger = (
    <div className={styles.avatar}>
      {profile?.avatar ? (
        <img src={profile.avatar} alt={profile?.username || 'User'} className="w-full h-full object-cover" />
      ) : (
        <span className="i-ph:user-fill" />
      )}
    </div>
  );

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
        레일(접힘 상태) — 로고/토글이 같은 24x24 박스에 겹쳐 있다가 호버 시 크로스페이드된다.
        낮은 z-index라 패널이 펼쳐지면 자연스럽게 그 아래로 가려진다(패널 내부에 중복으로 두지 않음).
        데스크톱 전용(모바일은 Header.tsx의 햄버거+로고를 그대로 쓴다).
      */}
      {!isSmallViewport && (
        <div className={styles.rail}>
          <div className={styles.railLogoToggleWrap}>
            <Tooltip content="사이드바 열기" side="right" delayDuration={300}>
              <button
                type="button"
                aria-label="사이드바 열기"
                data-sidebar-toggle
                className={styles.railLogoToggle}
                onClick={toggleSidebar}
              >
                <span className={styles.railLogoToggleLogo}>
                  <Logo height={24} showWordmark={false} />
                </span>
                <span className={styles.railLogoToggleIcon}>
                  <span className="i-ph:sidebar-simple" style={{ fontSize: 20 }} />
                </span>
              </button>
            </Tooltip>
          </div>

          <Tooltip content="새 앱 만들기" side="right" delayDuration={300}>
            <a href="/" aria-label="새 앱 만들기" className={styles.railNewAppButton}>
              <span className="i-ph:plus" style={{ fontSize: 18 }} />
            </a>
          </Tooltip>

          <div className={styles.railBottom}>
            {authUser ? (
              <AccountMenu onOpenSettings={handleOpenSettings}>
                <button type="button" className={styles.railAvatarButton} aria-label="계정">
                  {accountTrigger}
                </button>
              </AccountMenu>
            ) : (
              isPlatformSupabaseConfigured && (
                <a href="/login" aria-label="로그인" className={styles.railLoginLink}>
                  <span className="i-ph:sign-in" style={{ fontSize: 16 }} />
                </a>
              )
            )}
          </div>
        </div>
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
          {/* 2-1. 상단 행 — 로고 + 접기 */}
          <div className={styles.expandedTopRow}>
            <Logo height={24} showWordmark={false} />
            <Tooltip content="사이드바 접기" side="bottom" delayDuration={300}>
              <button
                type="button"
                aria-label="사이드바 접기"
                data-sidebar-toggle
                className={styles.collapseButton}
                onClick={toggleSidebar}
              >
                <span className="i-ph:sidebar-simple" style={{ fontSize: 20 }} />
              </button>
            </Tooltip>
          </div>

          {/* 2-2. 새 앱 만들기 */}
          <div className={styles.newAppButtonRow}>
            <a href="/" className={styles.newAppButton}>
              <span className="i-ph:plus-circle" />새 앱 만들기
            </a>
          </div>

          {/* 2-3. 내비게이션 */}
          <nav className={styles.nav}>
            {NAV_ITEMS.map((item) => {
              const isActive = location.pathname === item.href;

              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={classNames(styles.navItem, { [styles.navItemActive]: isActive })}
                >
                  <span className={classNames(item.icon, styles.navIcon)} />
                  <span className={styles.navLabel}>{item.label}</span>
                </a>
              );
            })}
          </nav>

          <div className={styles.navDivider} />

          {/* 2-5~2-7. 최근 작업 — 0개면 헤더까지 통째로 생략 */}
          {recentGroups.length > 0 && (
            <>
              <p className={styles.recentHeader}>최근 작업</p>
              <div className={styles.recentList}>
                {recentGroups.map((group) => {
                  const item = group.items[0];
                  const deployedApp = findDeployedInGroup(group, deployedById);

                  return (
                    <div key={group.key} className={styles.recentItemRow}>
                      <a href={`/chat/${item.urlId}`} className={styles.recentItemLink}>
                        <MiniBrowserFrame
                          size="compact"
                          url={deployedApp?.url ?? ''}
                          title={item.description || '이름 없는 앱'}
                          addressOverride={deployedApp ? undefined : '배포하면 주소가 생겨요'}
                          actions={
                            <button
                              type="button"
                              className={styles.recentDeleteButton}
                              aria-label="대화 삭제"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setDialogContent({ type: 'delete', item });
                              }}
                            >
                              <span className="i-ph:trash" />
                            </button>
                          }
                        />
                      </a>
                    </div>
                  );
                })}
              </div>
              {hasMoreRecent && (
                <div className={styles.viewAllRow}>
                  <a href="/apps" className={styles.viewAllLink}>
                    전체 보기 →
                  </a>
                </div>
              )}
            </>
          )}

          {/* 2-8. 계정 영역 — 이름/아바타를 누르면 프로필·설정·요금제·로그아웃 메뉴가 열린다. */}
          <div className={styles.accountArea}>
            {authUser ? (
              <AccountMenu onOpenSettings={handleOpenSettings}>
                {accountTrigger}
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
                  <DialogDescription className="mt-2" style={{ color: '#6E645B' }}>
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
          </Dialog>
        </DialogRoot>
      </motion.div>

      <Suspense fallback={null}>
        <ControlPanel open={isSettingsOpen} onClose={handleSettingsClose} initialTab={settingsInitialTab} />
      </Suspense>
    </>
  );
};
