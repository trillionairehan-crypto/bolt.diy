/**
 * 생성물 자동 검토(auto-review) 진행 중 표시 — 딱 한 줄, 과정/체크리스트/수정 내역은 전혀 노출하지
 * 않는다. AutoFixStatus.tsx의 "고치고 있어요" 줄과 같은 코랄 점멸 점 패턴 재사용.
 */
export function AutoReviewStatus() {
  return (
    <div className="rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-4 mb-2">
      <div className="flex items-center gap-2 text-sm" style={{ color: '#1A1A1A' }}>
        <span
          className="w-2 h-2 rounded-full shrink-0 animate-[cr-dot-pulse_1.2s_ease-in-out_infinite]"
          style={{ background: 'var(--accent)' }}
          aria-hidden="true"
        />
        마무리하고 있어요
      </div>
    </div>
  );
}
