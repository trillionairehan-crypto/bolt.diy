import type { ReactNode } from 'react';
import { Logo } from '~/components/ui/Logo';

interface AuthPageShellProps {
  children: ReactNode;
  topRight?: ReactNode;
}

/**
 * Shared frame for /login and /signup — cream page backdrop in light mode (falls back to the
 * normal --bg in dark, see --auth-page-bg in variables.scss), centered card, Coralred logo.
 * Kept as one component since the two pages' chrome is otherwise byte-for-byte identical and
 * would just drift out of sync if copy-pasted.
 */
export function AuthPageShell({ children, topRight }: AuthPageShellProps) {
  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center px-4 py-12 relative"
      style={{ background: 'var(--auth-page-bg)' }}
    >
      {topRight && <div className="absolute top-6 right-6">{topRight}</div>}

      <a href="/" className="mb-8" aria-label="코랄레드 홈으로">
        <Logo height={28} showWordmark={false} />
      </a>

      <div
        className="w-full max-w-[400px] rounded-2xl p-8"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-overlay, 0 20px 50px rgba(23, 16, 14, 0.12))',
        }}
      >
        {children}
      </div>
    </div>
  );
}
