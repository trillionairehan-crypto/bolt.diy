import type { ReactNode } from 'react';

interface SettingSectionProps {
  title: string;
  children: ReactNode;
}

/**
 * Groups SettingRow children under a title — Claude 설정창 스타일 섹션. The 40px gap between
 * sections is the PARENT's job (wrap multiple sections in a `flex flex-col gap-10` container) —
 * keeping it out of this component avoids first/last-child CSS tricks.
 */
export function SettingSection({ title, children }: SettingSectionProps) {
  return (
    <section>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: '#1A1A1A', margin: '0 0 12px' }}>{title}</h3>
      <div>{children}</div>
    </section>
  );
}
