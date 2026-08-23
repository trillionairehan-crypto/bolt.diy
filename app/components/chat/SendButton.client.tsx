interface SendButtonProps {
  isStreaming?: boolean;
  disabled?: boolean;
  onClick?: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
}

export const SendButton = ({ isStreaming, disabled, onClick }: SendButtonProps) => {
  return (
    <button
      type="button"
      className="flex items-center justify-center gap-1.5 h-8 px-3.5 rounded-md text-[13px] font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
      disabled={disabled}
      onClick={(event) => {
        event.preventDefault();

        if (!disabled) {
          onClick?.(event);
        }
      }}
    >
      {isStreaming ? (
        <>
          <div className="i-ph:stop-circle-bold text-base" />
          중단
        </>
      ) : (
        <>
          만들기
          <div className="i-ph:arrow-right text-base" />
        </>
      )}
    </button>
  );
};
