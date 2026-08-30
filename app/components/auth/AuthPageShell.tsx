import type { ReactNode } from 'react';
import { Logo } from '~/components/ui/Logo';

interface AuthPageShellProps {
  children: ReactNode;
  topRight?: ReactNode;
}

/**
 * Shared frame for /login and /signup — cream backdrop, no card, logo mark top-center, content
 * anchored around the viewport's 40% vertical mark (same top:40%/translateY(-50%) pattern as the
 * chat-home headline block in ChatHome.module.scss, so the anchor holds steady as the email
 * step expands/collapses the content's height).
 */
export function AuthPageShell({ children, topRight }: AuthPageShellProps) {
  return (
    <div className="relative w-full min-h-screen" style={{ background: '#FBF5EE' }}>
      {topRight && <div className="absolute top-6 right-6">{topRight}</div>}

      <div className="absolute left-0 right-0" style={{ top: '40%', transform: 'translateY(-50%)' }}>
        <div className="w-full max-w-[360px] mx-auto px-6 flex flex-col items-center">
          <a href="/" aria-label="코랄레드 홈으로" style={{ marginBottom: 56 }}>
            <Logo height={28} showWordmark={false} />
          </a>

          {children}
        </div>
      </div>
    </div>
  );
}
