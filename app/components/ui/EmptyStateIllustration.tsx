interface EmptyStateIllustrationProps {
  caption: string;
  className?: string;
}

/**
 * Reused across sidebar (no chats / no search results) and the file tree (empty) — a small,
 * consistent motif (the logo's rounded squares) instead of three unrelated ad-hoc messages.
 */
export function EmptyStateIllustration({ caption, className }: EmptyStateIllustrationProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-8 text-center ${className ?? ''}`}>
      <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
        <rect x="4" y="4" width="22" height="22" rx="7" fill="var(--border)" />
        <rect x="30" y="4" width="22" height="22" rx="7" fill="var(--accent-soft)" />
        <rect x="17" y="30" width="22" height="22" rx="7" fill="var(--border-strong)" opacity="0.6" />
      </svg>
      <p className="text-sm" style={{ color: 'var(--muted)' }}>
        {caption}
      </p>
    </div>
  );
}
