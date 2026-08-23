import { IconButton } from '~/components/ui/IconButton';
import { classNames } from '~/utils/classNames';
import React from 'react';

export const SpeechRecognitionButton = ({
  isListening,
  onStart,
  onStop,
  disabled,
}: {
  isListening: boolean;
  onStart: () => void;
  onStop: () => void;
  disabled: boolean;
}) => {
  return (
    <IconButton
      title={isListening ? '듣기 중지' : '음성으로 입력하기'}
      disabled={disabled}
      className={classNames('flex items-center h-8 gap-1.5 px-2 !text-bolt-elements-textSecondary', {
        '!text-bolt-elements-item-contentAccent': isListening,
      })}
      onClick={isListening ? onStop : onStart}
    >
      {isListening ? (
        <div className="i-ph:microphone-slash text-base" />
      ) : (
        <div className="i-ph:microphone text-base" />
      )}
      <span className="text-[13px]">음성</span>
    </IconButton>
  );
};
