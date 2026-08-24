import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { classNames } from '~/utils/classNames';
import {
  QUESTION_BANK,
  selectQuestions,
  type ClarifyOption,
  type ClarifyQuestionDef,
} from '~/lib/onboarding/question-bank';
import {
  combineDirectives,
  mapAnswerToDirectives,
  mergeDirectives,
  type GenerationDirectives,
} from '~/lib/onboarding/answer-directives';
import { generateAppQuestions } from '~/utils/generateAppQuestions';
import { ONBOARDING_ADDITIONS_MARKER } from '~/utils/constants';

interface PromptClarificationProps {
  initialPrompt: string;
  onComplete: (finalPrompt: string, directives: GenerationDirectives) => void;
}

/*
 * 'waitingForDynamic': the 4 fixed questions are all answered but generateAppQuestions() hasn't
 * resolved yet — held here for up to DYNAMIC_WAIT_MS before concluding with fixed answers only.
 */
type Status = 'questions' | 'waitingForDynamic' | 'summary';

const DYNAMIC_WAIT_MS = 3000;

interface RecordedAnswer {
  optionId: string;
  value: unknown;
  label: string;
}

const EMPTY_DIRECTIVES: GenerationDirectives = { promptAdditions: [] };

function buildFinalPromptAndDirectives(
  initialPrompt: string,
  questions: ClarifyQuestionDef[],
  answers: Record<string, RecordedAnswer>,
): { finalPrompt: string; directives: GenerationDirectives } {
  const perQuestionParts = questions.map((question) => {
    const answer = answers[question.id];

    if (!answer) {
      return {};
    }

    /*
     * "잘 모르겠어요" means silence for fixed questions too (see mapAnswerToDirectives's default
     * cases) — without this check, dynamic questions would leak a useless "질문: 잘 모르겠어요"
     * line into the generation prompt instead of adding nothing like the fixed-question path does.
     */
    if (answer.optionId === 'unsure') {
      return {};
    }

    /*
     * Free-text fallback ("직접 입력") and every app-specific (isDynamic) question have no fixed
     * id answer-directives.ts knows about — both become a plain "질문: 답변" line instead, same
     * as the old behavior. Only the 4 fixed questions go through mapAnswerToDirectives.
     */
    if (answer.optionId === 'custom' || question.isDynamic) {
      return { promptAdditions: [`${question.question} ${answer.label}`] };
    }

    return mapAnswerToDirectives(question.id, answer.value);
  });

  const combined = combineDirectives(Object.fromEntries(Object.entries(answers).map(([id, a]) => [id, a.value])));

  const directives = mergeDirectives([...perQuestionParts, combined]);

  const finalPrompt =
    directives.promptAdditions.length > 0
      ? `${initialPrompt}${ONBOARDING_ADDITIONS_MARKER}${directives.promptAdditions.map((line) => `- ${line}`).join('\n')}`
      : initialPrompt;

  return { finalPrompt, directives };
}

export default function PromptClarification({ initialPrompt, onComplete }: PromptClarificationProps) {
  /*
   * Starts with just the 4 fixed questions — synchronous, no loading state needed. Up to 2
   * app-specific questions get appended once generateAppQuestions() resolves (see the mount
   * effect below); if the user reaches the end of the fixed 4 before that happens, the
   * 'waitingForDynamic' status briefly holds for them — see the effect further down.
   */
  const [questions, setQuestions] = useState<ClarifyQuestionDef[]>(() => selectQuestions(undefined, QUESTION_BANK));
  const [dynamicStatus, setDynamicStatus] = useState<'pending' | 'resolved'>('pending');
  const [status, setStatus] = useState<Status>('questions');
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, RecordedAnswer>>({});
  const [customInput, setCustomInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [finalPrompt, setFinalPrompt] = useState(initialPrompt);
  const [directives, setDirectives] = useState<GenerationDirectives>(EMPTY_DIRECTIVES);
  const [pendingOptionId, setPendingOptionId] = useState<string | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  /** onComplete unmounts this component; guards against a double-tap firing it (and generateNewApp) twice. */
  const completedRef = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);

    const handler = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    mq.addEventListener('change', handler);

    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    let cancelled = false;

    generateAppQuestions(initialPrompt).then((result) => {
      if (cancelled) {
        return;
      }

      const dynamicQuestions = result ?? [];

      if (dynamicQuestions.length > 0) {
        setQuestions((prev) => [...prev, ...dynamicQuestions]);
      }

      setDynamicStatus('resolved');
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const concludeWithAnswers = (finalAnswers: Record<string, RecordedAnswer>) => {
    const built = buildFinalPromptAndDirectives(initialPrompt, questions, finalAnswers);
    setFinalPrompt(built.finalPrompt);
    setDirectives(built.directives);
    setStatus('summary');
  };

  /*
   * Handles both directions of the wait: if generateAppQuestions already resolved by the time we
   * enter 'waitingForDynamic' (fast path — either new questions already landed, or it came back
   * empty), resolve immediately; otherwise wait up to DYNAMIC_WAIT_MS for it to resolve mid-wait.
   */
  useEffect(() => {
    if (status !== 'waitingForDynamic') {
      return undefined;
    }

    if (dynamicStatus === 'resolved') {
      if (currentStep < questions.length) {
        setStatus('questions');
      } else {
        concludeWithAnswers(answers);
      }

      return undefined;
    }

    const timeoutId = setTimeout(() => {
      concludeWithAnswers(answers);
    }, DYNAMIC_WAIT_MS);

    return () => clearTimeout(timeoutId);
  }, [status, dynamicStatus, questions.length, currentStep]);

  const completeOnce = (finalPromptValue: string, finalDirectives: GenerationDirectives) => {
    if (completedRef.current) {
      return;
    }

    completedRef.current = true;
    onComplete(finalPromptValue, finalDirectives);
  };

  const handleSkip = () => completeOnce(initialPrompt, EMPTY_DIRECTIVES);

  const recordAnswer = (option: ClarifyOption) => {
    const question = questions[currentStep];
    const nextAnswers: Record<string, RecordedAnswer> = {
      ...answers,
      [question.id]: { optionId: option.id, value: option.value, label: option.label },
    };

    setAnswers(nextAnswers);
    setCustomInput('');
    setShowCustomInput(false);

    if (currentStep + 1 < questions.length) {
      setCurrentStep(currentStep + 1);
      return;
    }

    /*
     * Reached the end of what we currently know about. Advance the pointer regardless — if
     * generateAppQuestions appends more questions, this is exactly the index they land on.
     */
    setCurrentStep(currentStep + 1);

    if (dynamicStatus === 'pending') {
      setStatus('waitingForDynamic');
    } else {
      concludeWithAnswers(nextAnswers);
    }
  };

  /** Brief "confirmed" beat (coral border + check) before advancing, skipped under reduced-motion. */
  const selectOption = (option: ClarifyOption) => {
    if (pendingOptionId) {
      return;
    }

    if (reducedMotion) {
      recordAnswer(option);
      return;
    }

    setPendingOptionId(option.id);
    setTimeout(() => {
      recordAnswer(option);
      setPendingOptionId(null);
    }, 220);
  };

  const handleCustomAnswer = () => {
    const trimmed = customInput.trim();

    if (!trimmed) {
      return;
    }

    recordAnswer({ id: 'custom', label: trimmed, value: trimmed });
  };

  const currentQuestion = questions[currentStep];
  const normalOptions = currentQuestion?.options.filter((option) => !option.isUnsure) ?? [];
  const unsureOption = currentQuestion?.options.find((option) => option.isUnsure);

  const progressPct = status === 'summary' ? 100 : Math.min(100, (currentStep / Math.max(questions.length, 1)) * 100);

  return (
    <div className="mt-[10vh] max-w-[560px] mx-auto px-4 lg:px-0 w-full">
      <div
        className="relative rounded-[20px] p-6 lg:p-8 overflow-hidden border border-bolt-elements-borderColor"
        style={{ background: 'var(--surface)' }}
      >
        <div className="absolute top-0 left-0 right-0 h-1 bg-bolt-elements-borderColor overflow-hidden">
          <div
            className="h-full transition-[width] duration-300 ease-out"
            style={{ width: `${progressPct}%`, background: 'var(--accent)' }}
          />
        </div>

        <div className="flex items-center justify-end mb-6 mt-2">
          <button
            type="button"
            onClick={handleSkip}
            className="min-h-11 inline-flex items-center text-sm font-medium px-3 rounded-full text-bolt-elements-textSecondary hover:bg-bolt-elements-item-backgroundActive hover:text-bolt-elements-textPrimary transition-colors duration-150"
          >
            바로 만들기
          </button>
        </div>

        {status === 'waitingForDynamic' && (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="i-svg-spinners:90-ring-with-bg text-4xl" style={{ color: 'var(--accent)' }} />
            <p className="text-base text-bolt-elements-textPrimary">이 앱에 맞는 질문을 확인하고 있어요</p>
          </div>
        )}

        <AnimatePresence mode="wait">
          {status === 'questions' && currentQuestion && (
            <motion.div
              key={currentQuestion.id}
              initial={reducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducedMotion ? undefined : { opacity: 0, transition: { duration: 0.12 } }}
              transition={{ duration: 0.16 }}
              className="flex flex-col gap-4"
            >
              <h2 className="text-xl lg:text-2xl font-bold leading-snug text-bolt-elements-textPrimary">
                {currentQuestion.question}
              </h2>
              <div className="flex flex-col gap-3">
                {normalOptions.map((option) => {
                  const isPending = pendingOptionId === option.id;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => selectOption(option)}
                      disabled={pendingOptionId !== null}
                      className={classNames(
                        'w-full min-h-[52px] text-left rounded-xl px-5 py-3.5 text-base font-medium flex items-center justify-between gap-3 transition-colors duration-150 active:scale-[0.98]',
                        !isPending && 'hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]',
                      )}
                      style={{
                        border: isPending ? '2px solid var(--accent)' : '1px solid var(--border)',
                        color: 'var(--text)',
                        background: isPending ? 'var(--accent-soft)' : 'var(--surface)',
                      }}
                    >
                      <span>{option.label}</span>
                      {isPending && (
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
                })}

                {/* "잘 모르겠어요" is visually de-emphasized (dashed border, muted text, no fill) so
                    picking it feels like a low-stakes pass rather than a real fifth choice. */}
                {unsureOption && (
                  <button
                    type="button"
                    onClick={() => selectOption(unsureOption)}
                    disabled={pendingOptionId !== null}
                    className="w-full min-h-11 text-left rounded-xl border border-dashed px-5 py-3 text-sm font-medium transition-colors duration-150 active:scale-[0.98] hover:border-[var(--accent)]"
                    style={{ borderColor: 'var(--border)', color: 'var(--muted)', background: 'transparent' }}
                  >
                    {unsureOption.label}
                  </button>
                )}
              </div>

              {showCustomInput ? (
                <div className="flex flex-col gap-2 mt-1">
                  <input
                    autoFocus
                    type="text"
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                        handleCustomAnswer();
                      }
                    }}
                    placeholder="직접 입력해주세요"
                    className="w-full min-h-[52px] rounded-xl border px-5 py-3.5 text-base outline-none bg-transparent"
                    style={{ borderColor: 'var(--accent)', color: 'var(--text)' }}
                  />
                  <button
                    type="button"
                    onClick={handleCustomAnswer}
                    disabled={!customInput.trim()}
                    className="self-end min-h-11 rounded-full px-5 text-sm font-semibold text-[var(--on-accent)] disabled:opacity-40 transition-opacity duration-150"
                    style={{ backgroundColor: 'var(--accent)' }}
                  >
                    확인
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowCustomInput(true)}
                  className="min-h-11 inline-flex items-center text-sm font-medium text-left underline underline-offset-4 text-bolt-elements-textSecondary"
                >
                  직접 입력할게요
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {status === 'summary' && (
          <div className="flex flex-col gap-4">
            <h2 className="text-xl lg:text-2xl font-bold text-bolt-elements-textPrimary">이렇게 만들게요</h2>
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
