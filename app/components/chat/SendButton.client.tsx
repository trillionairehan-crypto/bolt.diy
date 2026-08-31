interface SendButtonProps {
  isStreaming?: boolean;
  disabled?: boolean;
  onClick?: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;

  /** 'sm' — the chat-home/landing card's shorter toolbar row (item 6: card min-height 120px). */
  size?: 'default' | 'sm';

  /*
   * 4-2: 채팅 홈에서 입력창에 텍스트가 있을 때 scale 1↔1.03로 2초 주기 호흡. reduced-motion은
   * animations.scss의 전역 미디어쿼리(cr-send-breathe 정의 옆)가 처리 — 여기서 JS로 따로
   * 안 걸러도 된다(기존 cr-dot-pulse/skeleton-shimmer와 같은 패턴).
   */
  breathe?: boolean;
}

export const SendButton = ({ isStreaming, disabled, onClick, size = 'default', breathe = false }: SendButtonProps) => {
  return (
    <button
      type="button"
      title={isStreaming ? '중단' : '만들기'}
      aria-label={isStreaming ? '중단' : '만들기'}
      className={`flex items-center justify-center ${size === 'sm' ? 'h-9 w-9' : 'h-11 w-11'} rounded-full transition-colors bg-[#FF5330] hover:bg-[#E64B2B] text-[#FBF5EE] disabled:opacity-40 disabled:cursor-not-allowed ${breathe ? 'animate-[cr-send-breathe_2s_ease-in-out_infinite]' : ''}`}
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
