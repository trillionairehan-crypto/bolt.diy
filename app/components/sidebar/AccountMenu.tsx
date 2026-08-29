import type { ReactNode } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useStore } from '@nanostores/react';
import { authUserStore, signOut } from '~/lib/stores/auth';
import type { TabType } from '~/components/@settings/core/types';
import styles from './Sidebar.module.scss';

interface AccountMenuProps {
  onOpenSettings: (tab: TabType | null) => void;
  children: ReactNode;
}

/** 사이드바 계정 영역(이름/아바타)을 누르면 열리는 메뉴 — 프로필/설정/요금제/로그아웃. */
export function AccountMenu({ onOpenSettings, children }: AccountMenuProps) {
  const authUser = useStore(authUserStore);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button type="button" className={styles.accountRow}>
          {children}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className={styles.accountMenuContent} side="top" align="start" sideOffset={8}>
          <DropdownMenu.Item className={styles.accountMenuItem} onSelect={() => onOpenSettings('profile')}>
            <span className="i-ph:user-circle" />
            프로필
          </DropdownMenu.Item>
          <DropdownMenu.Item className={styles.accountMenuItem} onSelect={() => onOpenSettings(null)}>
            <span className="i-ph:gear-six" />
            설정
          </DropdownMenu.Item>
          <DropdownMenu.Item className={styles.accountMenuItem} asChild>
            <a href="/pricing">
              <span className="i-ph:credit-card" />
              요금제
            </a>
          </DropdownMenu.Item>
          {authUser && (
            <DropdownMenu.Item
              className={styles.accountMenuItem}
              onSelect={() => {
                signOut();
              }}
            >
              <span className="i-ph:sign-out" />
              로그아웃
            </DropdownMenu.Item>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
