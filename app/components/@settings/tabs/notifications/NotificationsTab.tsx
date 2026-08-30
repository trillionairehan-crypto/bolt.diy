import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { logStore } from '~/lib/stores/logs';
import { useStore } from '@nanostores/react';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { classNames } from '~/utils/classNames';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

interface NotificationDetails {
  type?: string;
  message?: string;
  currentVersion?: string;
  latestVersion?: string;
  branch?: string;
  updateUrl?: string;
}

type FilterType = 'all' | 'system' | 'error' | 'warning' | 'update' | 'info' | 'provider' | 'network';

const NotificationsTab = () => {
  const [filter, setFilter] = useState<FilterType>('all');
  const logs = useStore(logStore.logs);

  useEffect(() => {
    const startTime = performance.now();

    return () => {
      const duration = performance.now() - startTime;
      logStore.logPerformanceMetric('NotificationsTab', 'mount-duration', duration);
    };
  }, []);

  const handleClearNotifications = () => {
    const count = Object.keys(logs).length;
    logStore.logInfo('Cleared notifications', {
      type: 'notification_clear',
      message: `Cleared ${count} notifications`,
      clearedCount: count,
      component: 'notifications',
    });
    logStore.clearLogs();
  };

  const handleUpdateAction = (updateUrl: string) => {
    logStore.logInfo('Update link clicked', {
      type: 'update_click',
      message: 'User clicked update link',
      updateUrl,
      component: 'notifications',
    });
    window.open(updateUrl, '_blank');
  };

  const handleFilterChange = (newFilter: FilterType) => {
    logStore.logInfo('Notification filter changed', {
      type: 'filter_change',
      message: `Filter changed to ${newFilter}`,
      previousFilter: filter,
      newFilter,
      component: 'notifications',
    });
    setFilter(newFilter);
  };

  /*
   * 4: category === 'system'/'performance'는 앱 초기화·테마 전환·디버그 모드 토글·자기 자신의
   * 마운트 시간 측정 같은 순수 내부 이벤트라(app/root.tsx, useSettings.ts, theme.ts 등), 사용자
   * 화면에서는 필터와 무관하게 항상 뺀다 — "시스템" 필터 옵션 자체는 남겨두되(명시적으로
   * 선택했을 때는 보여줌), 기본("전체") 상태에서 노이즈가 안 섞이게 하는 블랙리스트.
   */
  const filteredLogs = Object.values(logs)
    .filter((log) => {
      if (filter === 'all') {
        return log.category !== 'system' && log.category !== 'performance';
      }

      if (filter === 'update') {
        return log.details?.type === 'update';
      }

      if (filter === 'system') {
        return log.category === 'system';
      }

      if (filter === 'provider') {
        return log.category === 'provider';
      }

      if (filter === 'network') {
        return log.category === 'network';
      }

      return log.level === filter;
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const getNotificationStyle = (level: string, type?: string) => {
    if (type === 'update') {
      return {
        icon: 'i-ph:arrow-circle-up',
        color: 'text-[#FF5330] dark:text-[#FF5330]',
        bg: 'hover:bg-[#FF5330]/10 dark:hover:bg-[#FF5330]/20',
      };
    }

    switch (level) {
      case 'error':
        return {
          icon: 'i-ph:warning-circle',
          color: 'text-[#FF5330] dark:text-[#FF5330]',
          bg: 'hover:bg-[#FF5330]/10 dark:hover:bg-[#FF5330]/20',
        };
      case 'warning':
        return {
          icon: 'i-ph:warning',
          color: 'text-[#7A7067] dark:text-[#7A7067]',
          bg: 'hover:bg-[#7A7067]/10 dark:hover:bg-[#7A7067]/20',
        };
      case 'info':
        return {
          icon: 'i-ph:info',
          color: 'text-[#1A1A1A] dark:text-bolt-elements-textPrimary',
          bg: 'hover:bg-[#1A1A1A]/5 dark:hover:bg-white/5',
        };
      default:
        return {
          icon: 'i-ph:bell',
          color: 'text-bolt-elements-textSecondary',
          bg: 'hover:bg-gray-500/10 dark:hover:bg-gray-500/20',
        };
    }
  };

  const renderNotificationDetails = (details: NotificationDetails) => {
    if (details.type === 'update') {
      return (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-bolt-elements-textSecondary">{details.message}</p>
          <div className="flex flex-col gap-1 text-xs text-bolt-elements-textTertiary">
            <p>현재 버전: {details.currentVersion}</p>
            <p>최신 버전: {details.latestVersion}</p>
            <p>브랜치: {details.branch}</p>
          </div>
          <button
            onClick={() => details.updateUrl && handleUpdateAction(details.updateUrl)}
            className={classNames(
              'mt-2 inline-flex items-center gap-2',
              'rounded-lg px-3 py-1.5',
              'text-sm font-medium',
              'bg-[#FAFAFA] dark:bg-[#0A0A0A]',
              'border border-[#E5E5E5] dark:border-[#1A1A1A]',
              'text-bolt-elements-textPrimary',
              'hover:bg-[#FF5330]/10 dark:hover:bg-[#FF5330]/20',
              'transition-all duration-200',
            )}
          >
            <span className="i-ph:git-branch text-lg" />
            변경 사항 보기
          </button>
        </div>
      );
    }

    return details.message ? <p className="text-sm text-bolt-elements-textSecondary">{details.message}</p> : null;
  };

  const filterOptions: { id: FilterType; label: string; icon: string; color: string }[] = [
    { id: 'all', label: '전체 알림', icon: 'i-ph:bell', color: '#1A1A1A' },
    { id: 'system', label: '시스템', icon: 'i-ph:gear', color: '#7A7067' },
    { id: 'update', label: '업데이트', icon: 'i-ph:arrow-circle-up', color: '#FF5330' },
    { id: 'error', label: '에러', icon: 'i-ph:warning-circle', color: '#FF5330' },
    { id: 'warning', label: '경고', icon: 'i-ph:warning', color: '#7A7067' },
    { id: 'info', label: '정보', icon: 'i-ph:info', color: '#1A1A1A' },
    { id: 'provider', label: 'AI 모델', icon: 'i-ph:robot', color: '#1A1A1A' },
    { id: 'network', label: '네트워크', icon: 'i-ph:wifi-high', color: '#1A1A1A' },
  ];

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex items-center justify-between">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              className={classNames(
                'flex items-center gap-2',
                'rounded-lg px-3 py-1.5',
                'text-sm text-bolt-elements-textPrimary',
                'bg-[#FAFAFA] dark:bg-[#0A0A0A]',
                'border border-[#E5E5E5] dark:border-[#1A1A1A]',
                'hover:bg-[#FF5330]/10 dark:hover:bg-[#FF5330]/20',
                'transition-all duration-200',
              )}
            >
              <span
                className={classNames('text-lg', filterOptions.find((opt) => opt.id === filter)?.icon || 'i-ph:funnel')}
                style={{ color: filterOptions.find((opt) => opt.id === filter)?.color }}
              />
              {filterOptions.find((opt) => opt.id === filter)?.label || '필터'}
              <span className="i-ph:caret-down text-lg text-bolt-elements-textSecondary" />
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="min-w-[200px] bg-bolt-elements-background-depth-2 rounded-lg shadow-lg py-1 z-[250] animate-in fade-in-0 zoom-in-95 border border-bolt-elements-borderColor"
              sideOffset={5}
              align="start"
              side="bottom"
            >
              {filterOptions.map((option) => (
                <DropdownMenu.Item
                  key={option.id}
                  className="group flex items-center px-4 py-2.5 text-sm text-bolt-elements-textPrimary hover:bg-[#FF5330]/10 dark:hover:bg-[#FF5330]/20 cursor-pointer transition-colors"
                  onClick={() => handleFilterChange(option.id)}
                >
                  <div className="mr-3 flex h-5 w-5 items-center justify-center">
                    <div
                      className={classNames(option.icon, 'text-lg group-hover:text-[#FF5330] transition-colors')}
                      style={{ color: option.color }}
                    />
                  </div>
                  <span className="group-hover:text-[#FF5330] transition-colors">{option.label}</span>
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        <button
          onClick={handleClearNotifications}
          className={classNames(
            'group flex items-center gap-2',
            'rounded-lg px-3 py-1.5',
            'text-sm text-bolt-elements-textPrimary',
            'bg-[#FAFAFA] dark:bg-[#0A0A0A]',
            'border border-[#E5E5E5] dark:border-[#1A1A1A]',
            'hover:bg-[#FF5330]/10 dark:hover:bg-[#FF5330]/20',
            'transition-all duration-200',
          )}
        >
          <span className="i-ph:trash text-lg text-bolt-elements-textSecondary group-hover:text-[#FF5330] transition-colors" />
          모두 지우기
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {filteredLogs.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={classNames(
              'flex flex-col items-center justify-center gap-4',
              'rounded-lg p-8 text-center',
              'bg-[#FAFAFA] dark:bg-[#0A0A0A]',
              'border border-[#E5E5E5] dark:border-[#1A1A1A]',
            )}
          >
            <span className="i-ph:bell-slash text-4xl text-bolt-elements-textTertiary" />
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-medium text-bolt-elements-textPrimary">알림이 없어요</h3>
              <p className="text-sm text-bolt-elements-textSecondary">새로운 소식이 오면 여기에 표시돼요</p>
            </div>
          </motion.div>
        ) : (
          filteredLogs.map((log) => {
            const style = getNotificationStyle(log.level, log.details?.type);
            return (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={classNames(
                  'flex flex-col gap-2',
                  'rounded-lg p-4',
                  'bg-[#FAFAFA] dark:bg-[#0A0A0A]',
                  'border border-[#E5E5E5] dark:border-[#1A1A1A]',
                  style.bg,
                  'transition-all duration-200',
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className={classNames('text-lg', style.icon, style.color)} />
                    <div className="flex flex-col gap-1">
                      <h3 className="text-sm font-medium text-bolt-elements-textPrimary">{log.message}</h3>
                      {log.details && renderNotificationDetails(log.details as NotificationDetails)}
                      <p className="text-xs text-bolt-elements-textSecondary">
                        카테고리: {log.category}
                        {log.subCategory ? ` > ${log.subCategory}` : ''}
                      </p>
                    </div>
                  </div>
                  <time className="shrink-0 text-xs text-bolt-elements-textSecondary">
                    {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true, locale: ko })}
                  </time>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default NotificationsTab;
