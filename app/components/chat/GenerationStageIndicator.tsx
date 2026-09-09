const STAGES = ['화면 만들기', '코드 점검', '화면 확인', '마무리'] as const;

interface GenerationStageIndicatorProps {
  /** 1-4, 도달한 최고 단계. 0 이하면 아무것도 렌더링하지 않는다 (호출부가 이미 걸러주지만 방어적으로). */
  stage: number;
}

/**
 * 출시 블로커(2026-09-09) 무한 대기 방지 — 3분 넘게 걸려도 전체 파이프라인 중 어디까지 왔는지
 * 보여준다. 단계는 뒤로 가지 않는다(Chat.client.tsx의 pipelineStage가 이미 단조 증가).
 */
export function GenerationStageIndicator({ stage }: GenerationStageIndicatorProps) {
  if (stage < 1) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 text-xs text-bolt-elements-textSecondary px-1 py-1.5 mb-1">
      {STAGES.map((label, i) => {
        const stepNumber = i + 1;
        const isDone = stepNumber < stage;
        const isCurrent = stepNumber === stage;

        return (
          <div key={label} className="flex items-center gap-2">
            {i > 0 && <div className="w-3 h-px bg-bolt-elements-borderColor" aria-hidden="true" />}
            <div
              className="flex items-center gap-1"
              style={isCurrent ? { color: 'var(--accent)', fontWeight: 600 } : undefined}
            >
              {isCurrent ? (
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0 animate-[cr-dot-pulse_1.2s_ease-in-out_infinite]"
                  style={{ background: 'var(--accent)' }}
                  aria-hidden="true"
                />
              ) : isDone ? (
                <div className="i-ph:check-bold text-[10px]" aria-hidden="true" />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-bolt-elements-borderColor" aria-hidden="true" />
              )}
              {label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
