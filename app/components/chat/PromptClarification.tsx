import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { classNames } from '~/utils/classNames';
import styles from './PromptClarification.module.scss';
import {
  Q1_OPTIONS,
  Q2_OPTIONS,
  Q3_GRID,
  Q4_CATEGORIES,
  type Q1Value,
  type Q2Value,
  type SkeletonId,
} from '~/lib/onboarding/question-bank';
import {
  buildSkeletonAndPerspectiveDirective,
  mapQ2ToDirectives,
  mergeDirectives,
  type GenerationDirectives,
} from '~/lib/onboarding/answer-directives';
import { mapIndustryToSkeleton } from '~/utils/mapIndustryToSkeleton';
import { PALETTES, activePaletteId, type PaletteId } from '~/lib/palettes';
import { ONBOARDING_ADDITIONS_MARKER } from '~/utils/constants';
import { chatId, ensureChatId } from '~/lib/persistence';
import { useReducedMotion } from '~/lib/hooks';

interface PromptClarificationProps {
  initialPrompt: string;
  onComplete: (finalPrompt: string, directives: GenerationDirectives) => void;
}

type Step = 'q1' | 'q2' | 'q3' | 'q4' | 'q5' | 'summary';

const STEP_ORDER: Step[] = ['q1', 'q2', 'q3', 'q4', 'q5', 'summary'];

interface Q3Answer {
  gridItemId: string | null;
  raw: string | null;
  skeleton: SkeletonId | null;
}

const EMPTY_DIRECTIVES: GenerationDirectives = { promptAdditions: [] };

export default function PromptClarification({ initialPrompt, onComplete }: PromptClarificationProps) {
  const [step, setStep] = useState<Step>('q1');
  const [q1, setQ1] = useState<Q1Value | null>(null);
  const [q2, setQ2] = useState<Q2Value | null>(null);
  const [q3, setQ3] = useState<Q3Answer | null>(null);
  const [q4, setQ4] = useState<string[]>([]);
  const [q5, setQ5] = useState<PaletteId | null>(null);
  const [finalPrompt, setFinalPrompt] = useState(initialPrompt);
  const [directives, setDirectives] = useState<GenerationDirectives>(EMPTY_DIRECTIVES);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [mappingIndustry, setMappingIndustry] = useState(false);
  const reducedMotion = useReducedMotion();

  /** Guards against a double-tap on "만들기" firing onComplete (and generateNewApp) twice. */
  const completedRef = useRef(false);

  /*
   * activePaletteId(app/lib/palettes.ts)는 chatId 아톰과 같은 계층(모듈 레벨 nanostore)이라 여러
   * 채팅 세션에 걸쳐 값이 남는다 — 새 온보딩 세션이 시작될 때(이 컴포넌트가 마운트될 때) coral로
   * reset해서, Q5를 건너뛴 이전 채팅의 팔레트가 이번 채팅에 새는 일이 없게 한다.
   */
  useEffect(() => {
    activePaletteId.set('coral');
  }, []);

  const stepIndex = STEP_ORDER.indexOf(step);
  const progressPct = step === 'summary' ? 100 : Math.min(100, (stepIndex / (STEP_ORDER.length - 1)) * 100);

  const selectWithConfirm = (id: string, after: () => void) => {
    if (pendingId) {
      return;
    }

    if (reducedMotion) {
      after();
      return;
    }

    setPendingId(id);
    setTimeout(() => {
      after();
      setPendingId(null);
    }, 220);
  };

  const buildDirectivesAndConclude = (finalQ1: Q1Value, finalQ2: Q2Value, finalQ3: Q3Answer | null) => {
    const skeletonAndPerspectiveLines = buildSkeletonAndPerspectiveDirective(finalQ1, finalQ3?.skeleton ?? null);
    const parts = [{ promptAdditions: skeletonAndPerspectiveLines }, mapQ2ToDirectives(finalQ2)];

    if (finalQ3?.raw) {
      // 직접 입력이 격자 항목에 못 매핑됐으면(기타) 사용자가 실제로 타이핑한 업종 원문을 그대로 알려준다.
      parts.push({ promptAdditions: [`업종: ${finalQ3.raw}`] });
    }

    const industryLabel = finalQ3?.raw ?? Q3_GRID.find((item) => item.id === finalQ3?.gridItemId)?.label;
    parts.push({ skeleton: finalQ3?.skeleton ?? null, industry: industryLabel });

    const merged = mergeDirectives(parts);
    const built =
      merged.promptAdditions.length > 0
        ? `${initialPrompt}${ONBOARDING_ADDITIONS_MARKER}${merged.promptAdditions.map((line) => `- ${line}`).join('\n')}`
        : initialPrompt;

    setFinalPrompt(built);
    setDirectives(merged);
    setStep('summary');
  };

  // --- Q1 ---
  const answerQ1 = (value: Q1Value) => {
    selectWithConfirm(value, () => {
      setQ1(value);
      setStep('q2');
    });
  };

  // --- Q2 ---
  const answerQ2 = (value: Q2Value) => {
    selectWithConfirm(value, () => {
      setQ2(value);
      setStep('q3');
    });
  };

  // --- Q3 ---
  const answerQ3Grid = (item: (typeof Q3_GRID)[number]) => {
    selectWithConfirm(item.id, () => {
      setQ3({ gridItemId: item.id, raw: null, skeleton: item.skeleton });
      setStep('q4');
    });
  };

  const submitQ3Custom = async () => {
    const trimmed = customInput.trim();

    if (!trimmed || mappingIndustry) {
      return;
    }

    setMappingIndustry(true);

    const mapped = await mapIndustryToSkeleton(trimmed).catch(() => ({ gridItemId: null, skeleton: null }));

    setMappingIndustry(false);
    setQ3({ gridItemId: mapped.gridItemId, raw: trimmed, skeleton: mapped.skeleton });
    setCustomInput('');
    setShowCustomInput(false);
    setStep('q4');
  };

  // --- Q4 (수요조사 전용 — DB에만 저장, 지시문/프롬프트로 안 흐른다) ---
  const toggleQ4 = (id: string) => {
    setQ4((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const confirmQ4 = () => setStep('q5');
  const skipQ4 = () => {
    setQ4([]);
    setStep('q5');
  };

  // --- Q5 ---
  const answerQ5 = (paletteId: PaletteId) => {
    selectWithConfirm(paletteId, () => {
      setQ5(paletteId);
      activePaletteId.set(paletteId);

      if (q1 && q2) {
        buildDirectivesAndConclude(q1, q2, q3);
      }
    });
  };

  const skipQ5 = () => {
    setQ5(null);

    if (q1 && q2) {
      buildDirectivesAndConclude(q1, q2, q3);
    }
  };

  const completeOnce = (finalPromptValue: string, finalDirectives: GenerationDirectives) => {
    if (completedRef.current) {
      return;
    }

    completedRef.current = true;

    // 설문 저장 — 실패해도(non-fatal) 생성 진행에 영향 없다. 결과를 기다리지 않는다.
    void saveOnboardingResponse({ q1, q2, q3, q4, q5 }).catch(() => {});

    onComplete(finalPromptValue, finalDirectives);
  };

  const currentQ3Recommended = q3?.gridItemId
    ? (Q3_GRID.find((item) => item.id === q3.gridItemId)?.recommendedPalettes ?? [])
    : [];
  const previewPaletteId =
    pendingId && PALETTES.some((p) => p.id === pendingId) ? (pendingId as PaletteId) : (q5 ?? 'coral');
  const previewPalette = PALETTES.find((p) => p.id === previewPaletteId)!;

  return (
    <div className={classNames(styles.screen, 'h-full w-full flex flex-col overflow-y-auto')}>
      <div className={styles.progressTrack}>
        <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
      </div>

      <div
        className={classNames(styles.content, 'flex-1 flex flex-col items-center px-4 lg:px-0 w-full pb-10')}
        style={{ paddingTop: 'clamp(40px, 12vh, 140px)' }}
      >
        <AnimatePresence mode="wait">
          {step === 'q1' && (
            <StepShell key="q1" reducedMotion={reducedMotion} title="누가 쓰나요">
              <div className={classNames(styles.options, 'w-full max-w-[520px]')}>
                {Q1_OPTIONS.map((option) => (
                  <OptionButton
                    key={option.id}
                    pending={pendingId === option.id}
                    disabled={!!pendingId}
                    onClick={() => answerQ1(option.id)}
                  >
                    {option.label}
                  </OptionButton>
                ))}
              </div>
            </StepShell>
          )}

          {step === 'q2' && (
            <StepShell key="q2" reducedMotion={reducedMotion} title="데이터를 저장할까요">
              {q1 === 'public' && (
                <p className="text-sm mb-4 text-center" style={{ color: '#8B7E70' }}>
                  손님 데이터가 쌓이려면 저장이 필요해요
                </p>
              )}
              <div className={classNames(styles.options, 'w-full max-w-[520px]')}>
                {Q2_OPTIONS.map((option) => (
                  <OptionButton
                    key={option.id}
                    pending={pendingId === option.id}
                    disabled={!!pendingId}
                    onClick={() => answerQ2(option.id)}
                  >
                    {option.label}
                  </OptionButton>
                ))}
              </div>
            </StepShell>
          )}

          {step === 'q3' && (
            <StepShell key="q3" reducedMotion={reducedMotion} title="어떤 일을 하시나요">
              <div className={classNames(styles.grid, 'w-full max-w-[620px]')}>
                {Q3_GRID.map((item) => (
                  <OptionButton
                    key={item.id}
                    pending={pendingId === item.id}
                    disabled={!!pendingId || mappingIndustry}
                    onClick={() => answerQ3Grid(item)}
                    compact
                  >
                    {item.label}
                  </OptionButton>
                ))}
                <button
                  type="button"
                  disabled={!!pendingId || mappingIndustry}
                  onClick={() => setShowCustomInput(true)}
                  className={classNames(styles.optionButton, styles.optionButtonCompact)}
                >
                  직접 입력
                </button>
              </div>

              {showCustomInput && (
                <div className="flex flex-col gap-2 mt-5 w-full max-w-[520px]">
                  <input
                    autoFocus
                    type="text"
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                        void submitQ3Custom();
                      }
                    }}
                    placeholder="예: 배달 도시락 가게"
                    disabled={mappingIndustry}
                    className="w-full min-h-[52px] rounded-xl border px-5 py-3.5 text-base outline-none bg-transparent"
                    style={{ borderColor: 'var(--accent)', color: 'var(--text)' }}
                  />
                  <button
                    type="button"
                    onClick={() => void submitQ3Custom()}
                    disabled={!customInput.trim() || mappingIndustry}
                    className="self-end min-h-11 rounded-full px-5 text-sm font-semibold text-[var(--on-accent)] disabled:opacity-40 transition-opacity duration-150"
                    style={{ backgroundColor: 'var(--accent)' }}
                  >
                    {mappingIndustry ? '확인하는 중…' : '확인'}
                  </button>
                </div>
              )}
            </StepShell>
          )}

          {step === 'q4' && (
            <StepShell key="q4" reducedMotion={reducedMotion} title="필요한 연동이 있나요">
              <p className="text-sm mb-5 text-center" style={{ color: '#8B7E70' }}>
                아직 준비 중이에요. 필요한 걸 알려주시면 먼저 만들어요.
              </p>
              <div className={classNames(styles.accordion, 'w-full max-w-[520px]')}>
                {Q4_CATEGORIES.map((category) => {
                  const checked = q4.includes(category.id);

                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => toggleQ4(category.id)}
                      className={classNames(styles.checklistRow, checked && styles.checklistRowChecked)}
                      aria-pressed={checked}
                    >
                      <span
                        className={classNames(styles.checkbox, checked && styles.checkboxChecked)}
                        aria-hidden="true"
                      >
                        {checked && <span className="i-ph:check-bold text-xs" />}
                      </span>
                      <span>{category.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-col items-center gap-3 mt-6 w-full max-w-[520px]">
                <button
                  type="button"
                  onClick={confirmQ4}
                  className="w-full min-h-14 rounded-xl px-5 py-4 text-base font-bold text-[var(--on-accent)] transition-opacity duration-150 hover:opacity-90 active:opacity-80"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  다음
                </button>
                <button type="button" onClick={skipQ4} className={styles.weakLink}>
                  건너뛰기
                </button>
              </div>
            </StepShell>
          )}

          {step === 'q5' && (
            <StepShell key="q5" reducedMotion={reducedMotion} title="색">
              <div
                className="w-full max-w-[420px] rounded-2xl p-5 mb-6 flex flex-col gap-2"
                style={{ background: previewPalette.bgBase, border: `1px solid ${previewPalette.border}` }}
              >
                <span className="text-xs font-medium" style={{ color: previewPalette.textSub }}>
                  미리보기
                </span>
                <span className="text-lg font-bold" style={{ color: previewPalette.textMain }}>
                  {previewPalette.name}
                </span>
                <span
                  className="self-start rounded-full px-4 py-2 text-sm font-semibold"
                  style={{
                    background: previewPalette.accent,
                    color: previewPalette.accentTextOverride ?? '#FFFFFF',
                  }}
                >
                  강조 버튼
                </span>
              </div>

              <div className={classNames(styles.paletteRow, 'w-full max-w-[620px]')}>
                {PALETTES.map((palette) => {
                  const recommended = currentQ3Recommended.includes(palette.id);

                  return (
                    <button
                      key={palette.id}
                      type="button"
                      disabled={!!pendingId}
                      onClick={() => answerQ5(palette.id)}
                      className={classNames(styles.paletteCard, pendingId === palette.id && styles.paletteCardActive)}
                      style={{ background: palette.bgBase, borderColor: palette.border }}
                    >
                      {recommended && <span className={styles.paletteBadge}>추천</span>}
                      <span className={styles.paletteSwatch} style={{ background: palette.accent }} />
                      <span style={{ color: palette.textMain }}>{palette.name}</span>
                    </button>
                  );
                })}
              </div>

              <button type="button" onClick={skipQ5} className={classNames(styles.weakLink, 'mt-6')}>
                건너뛰기
              </button>
            </StepShell>
          )}
        </AnimatePresence>

        {step === 'summary' && (
          <div className="flex flex-col gap-4 w-full max-w-[520px]">
            <h2 className={styles.question}>이렇게 만들게요</h2>
            <textarea
              value={finalPrompt}
              onChange={(e) => setFinalPrompt(e.target.value)}
              rows={6}
              className="w-full rounded-xl border px-5 py-4 text-sm leading-relaxed outline-none resize-none bg-transparent"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
            />
            <button
              type="button"
              onClick={() => completeOnce(finalPrompt.trim() || initialPrompt, directives)}
              className="w-full min-h-14 rounded-xl px-5 py-4 text-base font-bold text-[var(--on-accent)] transition-opacity duration-150 hover:opacity-90 active:opacity-80"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              만들기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StepShell({
  children,
  title,
  reducedMotion,
}: {
  children: React.ReactNode;
  title: string;
  reducedMotion: boolean;
}) {
  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reducedMotion ? undefined : { opacity: 0, transition: { duration: 0.12 } }}
      transition={{ duration: 0.16 }}
      className="flex flex-col items-center w-full"
    >
      <h2 className={styles.question}>{title}</h2>
      {children}
    </motion.div>
  );
}

function OptionButton({
  children,
  onClick,
  pending,
  disabled,
  compact,
}: {
  children: React.ReactNode;
  onClick: () => void;
  pending: boolean;
  disabled: boolean;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={classNames(
        styles.optionButton,
        pending && styles.optionButtonActive,
        compact && styles.optionButtonCompact,
      )}
    >
      <span>{children}</span>
      {pending && (
        <motion.span
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.15 }}
          className="i-ph:check-circle-fill text-xl shrink-0"
          style={{ color: 'var(--accent)' }}
        />
      )}
    </button>
  );
}

/**
 * 설문 저장 — message_usage와 같은 방식(app/lib/cloud/messageUsage.ts): 서버 라우트가
 * PLATFORM_SUPABASE_SERVICE_ROLE_KEY로 쓰고, ctx.waitUntil로 응답 이후에도 살아남게 한다. 여기서는
 * chat_id만 미리 확정해서(ensureChatId — message_usage와 같은 식별자) 서버로 보낸다.
 */
async function saveOnboardingResponse(answers: {
  q1: Q1Value | null;
  q2: Q2Value | null;
  q3: Q3Answer | null;
  q4: string[];
  q5: PaletteId | null;
}): Promise<void> {
  const resolvedChatId = await ensureChatId();

  await fetch('/api/onboarding', {
    method: 'POST',
    body: JSON.stringify({
      chatId: resolvedChatId ?? chatId.get(),
      q1Audience: answers.q1,
      q2Storage: answers.q2,
      q3Industry: answers.q3?.gridItemId ?? null,
      q3Raw: answers.q3?.raw ?? null,
      q3MappedSkeleton: answers.q3?.skeleton ?? null,
      q4Integrations: answers.q4,
      q5Palette: answers.q5,
    }),
  });
}
