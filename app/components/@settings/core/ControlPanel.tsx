import { useState, useEffect, useMemo } from 'react';
import { useStore } from '@nanostores/react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { classNames } from '~/utils/classNames';
import { useFeatures } from '~/lib/hooks/useFeatures';
import { useNotifications } from '~/lib/hooks/useNotifications';
import { useConnectionStatus } from '~/lib/hooks/useConnectionStatus';
import { tabConfigurationStore, resetTabConfiguration } from '~/lib/stores/settings';
import { profileStore } from '~/lib/stores/profile';
import { SHOW_DEV_TOOLS } from '~/utils/constants';
import type { TabType, Profile } from './types';
import { TAB_ICONS, TAB_LABELS } from './constants';
import { DialogTitle } from '~/components/ui/Dialog';

// Import all tab components
import ProfileTab from '~/components/@settings/tabs/profile/ProfileTab';
import SettingsTab from '~/components/@settings/tabs/settings/SettingsTab';
import NotificationsTab from '~/components/@settings/tabs/notifications/NotificationsTab';
import FeaturesTab from '~/components/@settings/tabs/features/FeaturesTab';
import { DataTab } from '~/components/@settings/tabs/data/DataTab';
import { EventLogsTab } from '~/components/@settings/tabs/event-logs/EventLogsTab';
import GitHubTab from '~/components/@settings/tabs/github/GitHubTab';
import GitLabTab from '~/components/@settings/tabs/gitlab/GitLabTab';
import SupabaseTab from '~/components/@settings/tabs/supabase/SupabaseTab';
import VercelTab from '~/components/@settings/tabs/vercel/VercelTab';
import NetlifyTab from '~/components/@settings/tabs/netlify/NetlifyTab';
import CloudProvidersTab from '~/components/@settings/tabs/providers/cloud/CloudProvidersTab';
import LocalProvidersTab from '~/components/@settings/tabs/providers/local/LocalProvidersTab';
import McpTab from '~/components/@settings/tabs/mcp/McpTab';

interface ControlPanelProps {
  open: boolean;
  onClose: () => void;

  /** Opens straight to this tab — e.g. the sidebar's "프로필 설정" menu item. */
  initialTab?: TabType | null;
}

/*
 * Developer-facing tabs (connection/deploy integrations non-developers won't use, plus raw
 * debug tooling) — hidden from the coralred target audience behind SHOW_DEV_TOOLS. Reversible
 * by flipping that one flag; nothing here is deleted.
 */
const DEV_ONLY_TAB_IDS = new Set<TabType>([
  'github',
  'gitlab',
  'netlify',
  'vercel',
  'mcp',
  'event-logs',
  'local-providers',
  'cloud-providers',

  /*
   * 개발자용 UI 정리 (overnight5, DEV_UI_HIDE_REPORT.md 참고): features는 프롬프트/컨텍스트 최적화
   * 등 개발자 설정 토글, data는 API 키·앱 설정 JSON 내보내기/가져오기 등 비개발자가 쓸 일이 없는
   * 내용이라 추가.
   */
  'features',
  'data',

  /*
   * 설정·알림·프로필 라운드: "설정" 탭(SettingsTab.tsx)은 언어 10개 드롭다운·타임존·키보드
   * 단축키 등 실제 프로필 스토어(profileStore)가 아니라 예전 bolt_user_profile localStorage
   * 키를 쓰는 등 코랄레드와 무관한 내용이라, 좌측 고정 탭(프로필/저장 기능/알림)에서 뺐다 —
   * 파일 자체는 지우지 않고 이 플래그로만 숨긴다(SHOW_DEV_TOOLS로 되살릴 수 있음).
   */
  'settings',
]);

export const ControlPanel = ({ open, onClose, initialTab = null }: ControlPanelProps) => {
  const [activeTab, setActiveTab] = useState<TabType | null>(null);

  // Store values
  const tabConfiguration = useStore(tabConfigurationStore);
  const profile = useStore(profileStore) as Profile;

  // Status hooks
  const { hasNewFeatures, unviewedFeatures, acknowledgeAllFeatures } = useFeatures();
  const { hasUnreadNotifications, unreadNotifications, markAllAsRead } = useNotifications();
  const { hasConnectionIssues, currentIssue, acknowledgeIssue } = useConnectionStatus();

  // Add visibleTabs logic using useMemo with optimized calculations
  const visibleTabs = useMemo(() => {
    if (!tabConfiguration?.userTabs || !Array.isArray(tabConfiguration.userTabs)) {
      console.warn('Invalid tab configuration, resetting to defaults');
      resetTabConfiguration();

      return [];
    }

    const notificationsDisabled = profile?.preferences?.notifications === false;

    // Optimize user mode tab filtering
    return tabConfiguration.userTabs
      .filter((tab) => {
        if (!tab?.id) {
          return false;
        }

        if (tab.id === 'notifications' && notificationsDisabled) {
          return false;
        }

        /*
         * Developer-facing connection/debug tabs — hidden from the non-developer target
         * audience, but the flag alone re-reveals them (no data lost, nothing deleted).
         */
        if (!SHOW_DEV_TOOLS && DEV_ONLY_TAB_IDS.has(tab.id)) {
          return false;
        }

        return tab.visible && tab.window === 'user';
      })
      .sort((a, b) => a.order - b.order);
  }, [tabConfiguration, profile?.preferences?.notifications]);

  // Pick the initial/requested tab (or the first visible one) whenever the panel opens.
  useEffect(() => {
    if (!open) {
      setActiveTab(null);
    } else {
      setActiveTab(initialTab ?? visibleTabs[0]?.id ?? null);
    }
  }, [open]);

  const handleClose = () => {
    setActiveTab(null);
    onClose();
  };

  const getTabComponent = (tabId: TabType) => {
    switch (tabId) {
      case 'profile':
        return <ProfileTab />;
      case 'settings':
        return <SettingsTab />;
      case 'notifications':
        return <NotificationsTab />;
      case 'features':
        return <FeaturesTab />;
      case 'data':
        return <DataTab />;
      case 'cloud-providers':
        return <CloudProvidersTab />;
      case 'local-providers':
        return <LocalProvidersTab />;
      case 'github':
        return <GitHubTab />;
      case 'gitlab':
        return <GitLabTab />;
      case 'supabase':
        return <SupabaseTab />;
      case 'vercel':
        return <VercelTab />;
      case 'netlify':
        return <NetlifyTab />;
      case 'event-logs':
        return <EventLogsTab />;
      case 'mcp':
        return <McpTab />;

      default:
        return null;
    }
  };

  const getTabUpdateStatus = (tabId: TabType): boolean => {
    switch (tabId) {
      case 'features':
        return hasNewFeatures;
      case 'notifications':
        return hasUnreadNotifications;
      case 'github':
      case 'gitlab':
      case 'supabase':
      case 'vercel':
      case 'netlify':
        return hasConnectionIssues;
      default:
        return false;
    }
  };

  const getStatusMessage = (tabId: TabType): string => {
    switch (tabId) {
      case 'features':
        return `새 기능 ${unviewedFeatures.length}개`;
      case 'notifications':
        return `읽지 않은 알림 ${unreadNotifications.length}개`;
      case 'github':
      case 'gitlab':
      case 'supabase':
      case 'vercel':
      case 'netlify':
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

    // Acknowledge notifications based on tab
    switch (tabId) {
      case 'features':
        acknowledgeAllFeatures();
        break;
      case 'notifications':
        markAllAsRead();
        break;
      case 'github':
      case 'gitlab':
      case 'supabase':
      case 'vercel':
      case 'netlify':
        acknowledgeIssue();
        break;
    }
  };

  return (
    <RadixDialog.Root open={open}>
      <RadixDialog.Portal>
        <div className="fixed inset-0 flex items-center justify-center z-[100] modern-scrollbar">
          <RadixDialog.Overlay className="absolute inset-0 bg-black/70 dark:bg-black/80 backdrop-blur-sm transition-opacity duration-200" />

          <RadixDialog.Content
            aria-describedby={undefined}
            onEscapeKeyDown={handleClose}
            onPointerDownOutside={handleClose}
            className="relative z-[101]"
          >
            <div
              className={classNames(
                'w-[95vw] sm:w-[90vw] max-w-[1200px] h-[85vh]',
                'rounded-2xl',
                'flex flex-col overflow-hidden',
                'relative',
                'transform transition-all duration-200 ease-out',
                open ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4',
              )}
              style={{ background: '#FBF5EE', border: '1px solid #EFE4D6' }}
            >
              <div className="relative z-10 flex flex-col h-full">
                {/* Header */}
                <div
                  className="flex items-center justify-between px-6 py-4 border-b"
                  style={{ borderColor: '#EFE4D6' }}
                >
                  <DialogTitle className="text-xl font-semibold" style={{ color: '#1A1A1A' }}>
                    {activeTab ? TAB_LABELS[activeTab] : '설정'}
                  </DialogTitle>

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
                    {visibleTabs.map((tab) => {
                      const Icon = TAB_ICONS[tab.id as TabType];
                      const isActive = activeTab === tab.id;
                      const hasUpdate = getTabUpdateStatus(tab.id as TabType);
                      const statusMessage = hasUpdate ? getStatusMessage(tab.id as TabType) : undefined;

                      return (
                        <button
                          key={tab.id}
                          type="button"
                          title={statusMessage}
                          onClick={() => handleTabClick(tab.id as TabType)}
                          className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors duration-150"
                          style={{
                            background: isActive ? 'rgba(255, 83, 48, 0.08)' : 'transparent',
                            color: isActive ? '#FF5330' : '#1A1A1A',
                          }}
                        >
                          {Icon && <Icon className="w-4 h-4 shrink-0" />}
                          <span className="flex-1 truncate">{TAB_LABELS[tab.id as TabType]}</span>
                          {hasUpdate && (
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#FF5330' }} />
                          )}
                        </button>
                      );
                    })}
                  </nav>

                  <div className="flex-1 overflow-y-auto p-6">{activeTab && getTabComponent(activeTab)}</div>
                </div>
              </div>
            </div>
          </RadixDialog.Content>
        </div>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
};
