interface AutoFixStatusProps {
  /** chatStore's autoFixAttempts — reaching 2 means both silent auto-fix tries already failed. */
  attempts: number;
  onRetry: () => void;
}

/**
 * 에러 노출 정리: replaces ChatAlert for preview-source errors (the silent auto-fix flow) — never
 * shows the raw error/stack trace, only a friendly one-liner while auto-fix is still trying, and a
 * give-up message + manual retry once it's exhausted both attempts. See BaseChat.tsx's actionAlert
 * (ChatAlert, terminal errors only) vs previewAlert (this component) split.
 */
export function AutoFixStatus({ attempts, onRetry }: AutoFixStatusProps) {
  const exhausted = attempts >= 2;

  return (
    <div className="rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-4 mb-2">
      {exhausted ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm" style={{ color: '#1A1A1A' }}>
            고치지 못했어요. 다시 시도하거나 다르게 요청해보세요
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="px-2.5 py-1.5 rounded-md text-sm font-medium shrink-0"
            style={{ background: '#FF5330', color: '#FBF5EE' }}
          >
            다시 시도
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm" style={{ color: '#1A1A1A' }}>
          <span
            className="w-2 h-2 rounded-full shrink-0 animate-[cr-dot-pulse_1.2s_ease-in-out_infinite]"
            style={{ background: 'var(--accent)' }}
            aria-hidden="true"
          />
          잠깐 문제가 있어서 고치고 있어요
        </div>
      )}
    </div>
  );
}
