import type { ReactNode } from 'react';
import styles from './SettingRow.module.scss';

interface SettingRowProps {
  label: string;

  /** 8-1/8-2: only for rows that genuinely need it — under the label, never under the value. */
  description?: string;
  children: ReactNode;
}

/** One label-left/value-right settings row — 52px min height, 1px divider except the last row. */
export function SettingRow({ label, description, children }: SettingRowProps) {
  return (
    <div className={styles.row}>
      <div className={styles.labelBlock}>
        <div className={styles.label}>{label}</div>
        {description && <div className={styles.description}>{description}</div>}
      </div>
      <div className={styles.valueBlock}>{children}</div>
    </div>
  );
}

/** 7-1: a read-only value — plain text, no input chrome, text-selectable. */
export function SettingReadOnlyValue({ children }: { children: ReactNode }) {
  return <span style={{ fontSize: 14, color: '#6E645B', cursor: 'text', userSelect: 'text' }}>{children}</span>;
}
