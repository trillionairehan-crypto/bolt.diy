import { useEffect, useState } from 'react';
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

const BRAND = {
  background: '#FAF7F2',
  accent: '#FF5A36',
  text: '#1A1A1A',
  border: '#EAE0D5',
};

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
      ? `${initialPrompt}\n\n추가로 알려주신 내용:\n${directives.promptAdditions.map((line) => `- ${line}`).join('\n')}`
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      return;
    }

    if (dynamicStatus === 'resolved') {
      if (currentStep < questions.length) {
        setStatus('questions');
      } else {
        concludeWithAnswers(answers);
      }

      return;
    }

    const timeoutId = setTimeout(() => {
      concludeWithAnswers(answers);
    }, DYNAMIC_WAIT_MS);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, dynamicStatus, questions.length, currentStep]);

  const handleSkip = () => onComplete(initialPrompt, EMPTY_DIRECTIVES);

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

  const handleCustomAnswer = () => {
    const trimmed = customInput.trim();

    if (!trimmed) {
      return;
    }

    recordAnswer({ id: 'custom', label: trimmed, value: trimmed });
  };

  const stepLabel =
    status === 'summary'
      ? '마지막 확인'
      : status === 'waitingForDynamic'
        ? '질문 확인 중'
        : `질문 ${currentStep + 1}/${questions.length}`;

  const currentQuestion = questions[currentStep];
  const normalOptions = currentQuestion?.options.filter((option) => !option.isUnsure) ?? [];
  const unsureOption = currentQuestion?.options.find((option) => option.isUnsure);

  return (
    <div className="mt-[10vh] max-w-xl mx-auto px-4 lg:px-0 w-full animate-fade-in">
      <div className="rounded-3xl p-6 lg:p-8" style={{ backgroundColor: BRAND.background }}>
        <div className="flex items-center justify-between mb-6">
          <span className="text-sm font-medium" style={{ color: BRAND.text, opacity: 0.6 }}>
            {stepLabel}
          </span>
          <button
            type="button"
            onClick={handleSkip}
            className="text-sm font-semibold underline underline-offset-4 decoration-2 py-2 px-1"
            style={{ color: BRAND.accent }}
          >
            바로 만들기
          </button>
        </div>

        {status === 'waitingForDynamic' && (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="i-svg-spinners:90-ring-with-bg text-4xl" style={{ color: BRAND.accent }} />
            <p className="text-base" style={{ color: BRAND.text }}>
              이 앱에 맞는 질문을 확인하고 있어요
            </p>
          </div>
        )}

        {status === 'questions' && currentQuestion && (
          <div className="flex flex-col gap-4">
            <h2 className="text-xl lg:text-2xl font-bold leading-snug" style={{ color: BRAND.text }}>
              {currentQuestion.question}
            </h2>
            <div className="flex flex-col gap-3">
              {normalOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => recordAnswer(option)}
                  className="w-full min-h-14 text-left rounded-2xl border-2 px-5 py-4 text-base font-medium transition-colors hover:brightness-95 active:scale-[0.99]"
                  style={{ borderColor: BRAND.border, color: BRAND.text, backgroundColor: '#FFFFFF' }}
                >
                  {option.label}
                </button>
              ))}

              {/* "잘 모르겠어요" is visually de-emphasized (dashed border, muted text, no fill) so
                  picking it feels like a low-stakes pass rather than a real fifth choice. */}
              {unsureOption && (
                <button
                  type="button"
                  onClick={() => recordAnswer(unsureOption)}
                  className="w-full min-h-11 text-left rounded-2xl border-2 border-dashed px-5 py-3 text-sm font-medium transition-colors hover:brightness-95 active:scale-[0.99]"
                  style={{
                    borderColor: BRAND.border,
                    color: BRAND.text,
                    opacity: 0.55,
                    backgroundColor: 'transparent',
                  }}
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
                    if (e.key === 'Enter') {
                      handleCustomAnswer();
                    }
                  }}
                  placeholder="직접 입력해주세요"
                  className="w-full min-h-14 rounded-2xl border-2 px-5 py-4 text-base outline-none"
                  style={{ borderColor: BRAND.accent, color: BRAND.text, backgroundColor: '#FFFFFF' }}
                />
                <button
                  type="button"
                  onClick={handleCustomAnswer}
                  disabled={!customInput.trim()}
                  className="self-end min-h-11 rounded-full px-5 text-sm font-semibold text-white disabled:opacity-40"
                  style={{ backgroundColor: BRAND.accent }}
                >
                  확인
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowCustomInput(true)}
                className="text-sm font-medium text-left py-2 underline underline-offset-4"
                style={{ color: BRAND.text, opacity: 0.6 }}
              >
                직접 입력할게요
              </button>
            )}
          </div>
        )}

        {status === 'summary' && (
          <div className="flex flex-col gap-4">
            <h2 className="text-xl lg:text-2xl font-bold" style={{ color: BRAND.text }}>
              이렇게 만들게요
            </h2>
            <textarea
              value={finalPrompt}
              onChange={(e) => setFinalPrompt(e.target.value)}
              rows={6}
              className="w-full rounded-2xl border-2 px-5 py-4 text-sm leading-relaxed outline-none resize-none"
              style={{ borderColor: BRAND.border, color: BRAND.text, backgroundColor: '#FFFFFF' }}
            />
            <button
              type="button"
              onClick={() => onComplete(finalPrompt.trim() || initialPrompt, directives)}
              className="w-full min-h-14 rounded-2xl px-5 py-4 text-base font-bold text-white"
              style={{ backgroundColor: BRAND.accent }}
            >
              만들기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
