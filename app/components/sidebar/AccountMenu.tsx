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

/** 사이드바 계정 영역(이름/아바타)을 누르면 열리는 메뉴. */
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
            프로필 설정
          </DropdownMenu.Item>
          <DropdownMenu.Item className={styles.accountMenuItem} asChild>
            <a href="/guide">
              <span className="i-ph:question" />
              도움말
            </a>
          </DropdownMenu.Item>
          <DropdownMenu.Item className={styles.accountMenuItem} asChild>
            <a href="mailto:coralred@coralred.kr">
              <span className="i-ph:headset" />
              문의하기
            </a>
          </DropdownMenu.Item>
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger className={styles.accountMenuItem}>
              <span className="i-ph:info" />
              자세히 알아보기
              <span className={styles.accountMenuSubCaret} />
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent className={styles.accountMenuContent} sideOffset={4} alignOffset={-6}>
                <DropdownMenu.Item className={styles.accountMenuItem} asChild>
                  <a href="/terms">
                    <span className="i-ph:file-text" />
                    이용약관
                  </a>
                </DropdownMenu.Item>
                <DropdownMenu.Item className={styles.accountMenuItem} asChild>
                  <a href="/privacy">
                    <span className="i-ph:shield-check" />
                    개인정보처리방침
                  </a>
                </DropdownMenu.Item>
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>
          {authUser && (
            <>
              <DropdownMenu.Separator className={styles.accountMenuSeparator} />
              <DropdownMenu.Item
                className={styles.accountMenuItem}
                onSelect={() => {
                  signOut();
                }}
              >
                <span className="i-ph:sign-out" />
                로그아웃
              </DropdownMenu.Item>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
