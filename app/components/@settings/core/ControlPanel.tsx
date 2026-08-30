import { useEffect, useRef, useState } from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { classNames } from '~/utils/classNames';
import { useNotifications } from '~/lib/hooks/useNotifications';
import { useConnectionStatus } from '~/lib/hooks/useConnectionStatus';
import type { TabType } from './types';
import { TAB_ICONS, TAB_LABELS } from './constants';
import { DialogTitle } from '~/components/ui/Dialog';

import ProfileTab from '~/components/@settings/tabs/profile/ProfileTab';
import NotificationsTab from '~/components/@settings/tabs/notifications/NotificationsTab';
import SupabaseTab from '~/components/@settings/tabs/supabase/SupabaseTab';

interface ControlPanelProps {
  open: boolean;
  onClose: () => void;

  /** Opens straight to this tab — e.g. the sidebar's "프로필 설정" menu item. */
  initialTab?: TabType | null;
}

/*
 * 0: this panel is always exactly these 3 fixed tabs now — no more tile-grid/reordering feature,
 * so no more reading the tab list from tabConfigurationStore (localStorage-persisted, seeded from
 * DEFAULT_TAB_CONFIG — which never included 'profile' in the first place, and wouldn't pick it up
 * retroactively for a browser with an already-saved config even if it did). Hardcoding here means
 * the 3 tabs always show correctly regardless of any stale persisted state.
 */
const PANEL_TABS: TabType[] = ['profile', 'supabase', 'notifications'];

export const ControlPanel = ({ open, onClose, initialTab = null }: ControlPanelProps) => {
  const [activeTab, setActiveTab] = useState<TabType | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // 9-3: instant, no animation, when the visitor has prefers-reduced-motion set.
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  const { hasUnreadNotifications, unreadNotifications, markAllAsRead } = useNotifications();
  const { hasConnectionIssues, currentIssue, acknowledgeIssue } = useConnectionStatus();

  // Pick the initial/requested tab (or the first one) whenever the panel opens.
  useEffect(() => {
    if (!open) {
      setActiveTab(null);
    } else {
      setActiveTab(initialTab ?? PANEL_TABS[0]);
    }
  }, [open]);

  // 10-1: reset the content pane's scroll position on every tab switch.
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  const handleClose = () => {
    setActiveTab(null);
    onClose();
  };

  const getTabComponent = (tabId: TabType) => {
    switch (tabId) {
      case 'profile':
        return <ProfileTab />;
      case 'supabase':
        return <SupabaseTab />;
      case 'notifications':
        return <NotificationsTab />;
      default:
        return null;
    }
  };

  const getTabUpdateStatus = (tabId: TabType): boolean => {
    switch (tabId) {
      case 'notifications':
        return hasUnreadNotifications;
      case 'supabase':
        return hasConnectionIssues;
      default:
        return false;
    }
  };

  const getStatusMessage = (tabId: TabType): string => {
    switch (tabId) {
      case 'notifications':
        return `읽지 않은 알림 ${unreadNotifications.length}개`;
      case 'supabase':
        return currentIssue === 'disconnected'
          ? '연결이 끊겼어요'
          : currentIssue === 'high-latency'
            ? '응답이 느려요'
            : '연결에 문제가 있어요';
      default:
        return '';
    }
  };

  const handleTabClick = (tabId: TabType) => {
    setActiveTab(tabId);

    if (tabId === 'notifications') {
      markAllAsRead();
    } else if (tabId === 'supabase') {
      acknowledgeIssue();
    }
  };

  return (
    <RadixDialog.Root open={open}>
      <RadixDialog.Portal>
        <div className="fixed inset-0 flex items-center justify-center z-[100] modern-scrollbar">
          {/* 9: 160ms open/close, opacity+scale only (no translate), instant under reduced-motion. */}
          <RadixDialog.Overlay
            className="absolute inset-0 bg-black/40 transition-opacity"
            style={{ transitionDuration: reducedMotion ? '0ms' : '160ms' }}
          />

          <RadixDialog.Content
            aria-describedby={undefined}
            onEscapeKeyDown={handleClose}
            onPointerDownOutside={handleClose}
            className="relative z-[101]"
          >
            <div
              className={classNames(
                'w-[95vw] sm:w-[90vw] max-w-[960px] max-h-[80vh] min-h-[560px]',
                'rounded-2xl',
                'flex flex-col overflow-hidden',
                'relative',
                'transform transition-all',
                open ? 'opacity-100 scale-100' : 'opacity-0 scale-98',
              )}
              style={{
                background: '#FBF5EE',
                border: '1px solid #EFE4D6',
                transitionDuration: reducedMotion ? '0ms' : '160ms',
              }}
            >
              <div className="relative z-10 flex flex-col h-full">
                {/* Header — 0-2: no tab-name title, close (X) only */}
                <div
                  className="flex items-center justify-end px-6 py-4 border-b shrink-0"
                  style={{ borderColor: '#EFE4D6' }}
                >
                  <DialogTitle className="sr-only">설정</DialogTitle>
                  <button
                    onClick={handleClose}
                    className="flex items-center justify-center w-8 h-8 rounded-full bg-transparent hover:bg-[#FF5330]/10 group transition-all duration-200"
                  >
                    <div
                      className="i-ph:x w-4 h-4 group-hover:text-[#FF5330] transition-colors"
                      style={{ color: '#8B7E70' }}
                    />
                  </button>
                </div>

                {/* Body — fixed left tab bar + right content pane */}
                <div className="flex-1 flex min-h-0">
                  <nav
                    className="w-[200px] shrink-0 border-r overflow-y-auto py-3 px-2 flex flex-col gap-1"
                    style={{ borderColor: '#EFE4D6' }}
                  >
                    {PANEL_TABS.map((tabId) => {
                      const Icon = TAB_ICONS[tabId];
                      const isActive = activeTab === tabId;
                      const hasUpdate = getTabUpdateStatus(tabId);
                      const statusMessage = hasUpdate ? getStatusMessage(tabId) : undefined;

                      return (
                        <button
                          key={tabId}
                          type="button"
                          title={statusMessage}
                          onClick={() => handleTabClick(tabId)}
                          className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors duration-150"
                          style={{
                            background: isActive ? 'rgba(255, 83, 48, 0.1)' : 'transparent',
                            color: isActive ? '#1A1A1A' : '#7A7067',
                          }}
                        >
                          {Icon && <Icon className="w-4 h-4 shrink-0" />}
                          <span className="flex-1 truncate">{TAB_LABELS[tabId]}</span>
                          {hasUpdate && (
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#FF5330' }} />
                          )}
                        </button>
                      );
                    })}
                  </nav>

                  <div ref={contentRef} className="flex-1 overflow-y-auto p-6">
                    {activeTab && getTabComponent(activeTab)}
                  </div>
                </div>
              </div>
            </div>
          </RadixDialog.Content>
        </div>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
};
