import { useEffect, useState } from 'react';
import { clarifyPrompt, type ClarifyQuestion } from '~/utils/clarifyPrompt';

interface PromptClarificationProps {
  initialPrompt: string;
  onComplete: (finalPrompt: string) => void;
}

type Status = 'loading' | 'questions' | 'summary';

const BRAND = {
  background: '#FAF7F2',
  accent: '#FF5A36',
  text: '#1A1A1A',
  border: '#EAE0D5',
};

function buildFinalPrompt(initialPrompt: string, questions: ClarifyQuestion[], answers: string[]): string {
  const details = questions
    .map((question, index) => (answers[index] ? `- ${question.question}: ${answers[index]}` : null))
    .filter((line): line is string => Boolean(line))
    .join('\n');

  return details ? `${initialPrompt}\n\n추가로 알려주신 내용:\n${details}` : initialPrompt;
}

export default function PromptClarification({ initialPrompt, onComplete }: PromptClarificationProps) {
  const [status, setStatus] = useState<Status>('loading');
  const [questions, setQuestions] = useState<ClarifyQuestion[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [finalPrompt, setFinalPrompt] = useState(initialPrompt);

  useEffect(() => {
    let cancelled = false;

    clarifyPrompt(initialPrompt).then((result) => {
      if (cancelled) {
        return;
      }

      if (!result) {
        onComplete(initialPrompt);
        return;
      }

      setQuestions(result);
      setStatus('questions');
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSkip = () => onComplete(initialPrompt);

  const handleAnswer = (answer: string) => {
    const trimmed = answer.trim();

    if (!trimmed) {
      return;
    }

    const nextAnswers = [...answers, trimmed];
    setAnswers(nextAnswers);
    setCustomInput('');
    setShowCustomInput(false);

    if (currentStep + 1 < questions.length) {
      setCurrentStep(currentStep + 1);
    } else {
      setFinalPrompt(buildFinalPrompt(initialPrompt, questions, nextAnswers));
      setStatus('summary');
    }
  };

  const stepLabel =
    status === 'loading' ? '질문 준비 중' : status === 'summary' ? '마지막 확인' : `질문 ${currentStep + 1}/${questions.length}`;

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

        {status === 'loading' && (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="i-svg-spinners:90-ring-with-bg text-4xl" style={{ color: BRAND.accent }} />
            <p className="text-base" style={{ color: BRAND.text }}>
              조금만 더 알려주세요, 딱 맞는 질문을 준비하고 있어요
            </p>
          </div>
        )}

        {status === 'questions' && questions[currentStep] && (
          <div className="flex flex-col gap-4">
            <h2 className="text-xl lg:text-2xl font-bold leading-snug" style={{ color: BRAND.text }}>
              {questions[currentStep].question}
            </h2>
            <div className="flex flex-col gap-3">
              {questions[currentStep].options.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleAnswer(option)}
                  className="w-full min-h-14 text-left rounded-2xl border-2 px-5 py-4 text-base font-medium transition-colors hover:brightness-95 active:scale-[0.99]"
                  style={{ borderColor: BRAND.border, color: BRAND.text, backgroundColor: '#FFFFFF' }}
                >
                  {option}
                </button>
              ))}
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
                      handleAnswer(customInput);
                    }
                  }}
                  placeholder="직접 입력해주세요"
                  className="w-full min-h-14 rounded-2xl border-2 px-5 py-4 text-base outline-none"
                  style={{ borderColor: BRAND.accent, color: BRAND.text, backgroundColor: '#FFFFFF' }}
                />
                <button
                  type="button"
                  onClick={() => handleAnswer(customInput)}
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
              onClick={() => onComplete(finalPrompt.trim() || initialPrompt)}
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
