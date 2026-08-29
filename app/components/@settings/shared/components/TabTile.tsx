import * as Tooltip from '@radix-ui/react-tooltip';
import { classNames } from '~/utils/classNames';
import type { TabVisibilityConfig } from '~/components/@settings/core/types';
import { TAB_LABELS, TAB_ICONS } from '~/components/@settings/core/constants';

interface TabTileProps {
  tab: TabVisibilityConfig;
  onClick?: () => void;
  isActive?: boolean;
  hasUpdate?: boolean;
  statusMessage?: string;
  description?: string;
  isLoading?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const TabTile: React.FC<TabTileProps> = ({
  tab,
  onClick,
  isActive,
  hasUpdate,
  statusMessage,
  description,
  isLoading,
  className,
  children,
}: TabTileProps) => {
  return (
    <Tooltip.Provider delayDuration={0}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <div className={classNames('min-h-[160px] list-none', className || '')}>
            <div className="relative h-full rounded-xl p-0.5" style={{ border: '1px solid rgba(26, 26, 26, 0.1)' }}>
              <div
                onClick={onClick}
                className={classNames(
                  'relative flex flex-col items-center justify-center h-full p-4 rounded-lg',
                  'group cursor-pointer',
                  'transition-colors duration-100 ease-out',
                  isLoading ? 'cursor-wait opacity-70 pointer-events-none' : '',
                )}
                style={{
                  background: isActive ? 'rgba(255, 83, 48, 0.06)' : 'rgba(26, 26, 26, 0.03)',
                }}
              >
                {/* Icon */}
                <div
                  className={classNames('relative', 'w-14 h-14', 'flex items-center justify-center', 'rounded-xl')}
                  style={{
                    background: isActive ? 'rgba(255, 83, 48, 0.1)' : '#FBF5EE',
                    boxShadow: `inset 0 0 0 1px ${isActive ? 'rgba(255, 83, 48, 0.3)' : 'rgba(26, 26, 26, 0.1)'}`,
                  }}
                >
                  {(() => {
                    const IconComponent = TAB_ICONS[tab.id];
                    return (
                      <IconComponent
                        className={classNames('w-8 h-8', isActive ? 'text-[#FF5330]' : 'text-[#8B7E70]')}
                      />
                    );
                  })()}
                </div>

                {/* Label and Description */}
                <div className="flex flex-col items-center mt-4 w-full">
                  <h3
                    className="text-[15px] font-medium leading-snug mb-2"
                    style={{ color: isActive ? '#FF5330' : '#1A1A1A' }}
                  >
                    {TAB_LABELS[tab.id]}
                  </h3>
                  {description && (
                    <p className="text-[13px] leading-relaxed max-w-[85%] text-center" style={{ color: '#8B7E70' }}>
                      {description}
                    </p>
                  )}
                </div>

                {/* Update Indicator with Tooltip */}
                {hasUpdate && (
                  <>
                    <div
                      className="absolute top-4 right-4 w-2 h-2 rounded-full animate-pulse"
                      style={{ background: '#FF5330' }}
                    />
                    <Tooltip.Portal>
                      <Tooltip.Content
                        className={classNames(
                          'px-3 py-1.5 rounded-lg',
                          'bg-[#1A1A1A] text-white',
                          'text-sm font-medium',
                          'select-none',
                          'z-[100]',
                        )}
                        side="top"
                        sideOffset={5}
                      >
                        {statusMessage}
                        <Tooltip.Arrow className="fill-[#1A1A1A]" />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </>
                )}

                {/* Children (e.g. Beta Label) */}
                {children}
              </div>
            </div>
          </div>
        </Tooltip.Trigger>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
};
