interface SendButtonProps {
  isStreaming?: boolean;
  disabled?: boolean;
  onClick?: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;

  /** 'sm' — the chat-home/landing card's shorter toolbar row (item 6: card min-height 120px). */
  size?: 'default' | 'sm';
}

export const SendButton = ({ isStreaming, disabled, onClick, size = 'default' }: SendButtonProps) => {
  return (
    <button
      type="button"
      title={isStreaming ? '중단' : '만들기'}
      aria-label={isStreaming ? '중단' : '만들기'}
      className={`flex items-center justify-center ${size === 'sm' ? 'h-9 w-9' : 'h-11 w-11'} rounded-full transition-colors bg-[#FF5330] hover:bg-[#E64B2B] text-[#FBF5EE] disabled:opacity-40 disabled:cursor-not-allowed`}
      disabled={disabled}
      onClick={(event) => {
        event.preventDefault();

        if (!disabled) {
          onClick?.(event);
        }
      }}
    >
      {isStreaming ? (
        <div className="i-ph:stop-circle-bold text-lg" />
      ) : (
        <div className="i-ph:arrow-right-bold text-lg" />
      )}
    </button>
  );
};
