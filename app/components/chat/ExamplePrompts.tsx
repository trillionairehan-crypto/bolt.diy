import React from 'react';

const EXAMPLE_PROMPTS = [
  { text: '가계부 앱 만들어줘' },
  { text: '내 포트폴리오 사이트 만들어줘' },
  { text: '독서 기록 앱 만들어줘' },
  { text: '동네 모임 관리 앱 만들어줘' },
  { text: '운동 기록 앱 만들어줘' },
  { text: '간단한 설문조사 사이트 만들어줘' },
];

export function ExamplePrompts(sendMessage?: { (event: React.UIEvent, messageInput?: string): void | undefined }) {
  return (
    <div id="examples" className="relative flex flex-col gap-9 w-full max-w-3xl mx-auto flex justify-center mt-6">
      <div
        className="flex flex-wrap justify-center gap-2"
        style={{
          animation: '.25s ease-out 0s 1 _fade-and-move-in_g2ptj_1 forwards',
        }}
      >
        {EXAMPLE_PROMPTS.map((examplePrompt, index: number) => {
          return (
            <button
              key={index}
              onClick={(event) => {
                sendMessage?.(event, examplePrompt.text);
              }}
              className="rounded-full bg-[rgba(250,247,240,0.14)] hover:bg-[rgba(250,247,240,0.22)] text-[#FAF7F0] px-3 py-1 text-xs transition-theme border-none"
            >
              {examplePrompt.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}
