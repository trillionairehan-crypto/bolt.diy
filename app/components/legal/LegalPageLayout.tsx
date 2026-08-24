import type { ReactNode } from 'react';
import { Logo } from '~/components/ui/Logo';

interface LegalPageLayoutProps {
  title: string;
  effectiveDate: string;
  children: ReactNode;
}

export function LegalPageLayout({ title, effectiveDate, children }: LegalPageLayoutProps) {
  return (
    <div className="min-h-full w-full bg-bolt-elements-background-depth-1">
      <header className="flex items-center px-4 border-b border-bolt-elements-borderColor h-[var(--header-height)]">
        <a href="/" className="flex items-center gap-2">
          <Logo height={24} />
        </a>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-12 sm:py-16">
        <h1 className="text-2xl sm:text-3xl font-bold text-bolt-elements-textPrimary mb-2">{title}</h1>
        <p className="text-sm text-bolt-elements-textSecondary mb-10">시행일자: {effectiveDate}</p>

        <div className="space-y-8 text-sm sm:text-base leading-relaxed text-bolt-elements-textPrimary">{children}</div>

        <div className="mt-16 pt-6 border-t border-bolt-elements-borderColor">
          <a href="/" className="text-sm font-medium hover:underline" style={{ color: 'var(--accent)' }}>
            ← 코랄레드 홈으로 돌아가기
          </a>
        </div>
      </main>
    </div>
  );
}

interface LegalSectionProps {
  title: string;
  children: ReactNode;
}

export function LegalSection({ title, children }: LegalSectionProps) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-bolt-elements-textPrimary mb-3">{title}</h2>
      <div className="space-y-3 text-bolt-elements-textSecondary">{children}</div>
    </section>
  );
}
