import { useEffect, useState } from 'react';
import { Dialog, DialogRoot, DialogClose, DialogTitle, DialogButton } from '~/components/ui/Dialog';
import { classNames } from '~/utils/classNames';
import { sendEmailOtp, verifyEmailOtp } from '~/lib/stores/auth';

interface EmailOtpModalProps {
  open: boolean;
  onClose: () => void;
}

export function EmailOtpModal({ open, onClose }: EmailOtpModalProps) {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStep('email');
      setEmail('');
      setCode('');
      setError(null);
      setLoading(false);
    }
  }, [open]);

  const handleSendCode = async () => {
    if (!email || loading) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await sendEmailOtp(email);
      setStep('code');
    } catch {
      setError('인증 코드 발송에 실패했습니다. 이메일 주소를 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (code.length !== 6 || loading) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await verifyEmailOtp(email, code);
      onClose();
    } catch {
      setError('인증 코드가 올바르지 않습니다. 다시 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogRoot
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
    >
      {open && (
        <Dialog className="max-w-[420px] p-6">
          <div className="space-y-4">
            <DialogTitle>
              <div className="i-ph:envelope-simple-fill w-5 h-5 text-[#FF5330]" />
              이메일로 로그인
            </DialogTitle>

            {step === 'email' ? (
              <>
                <div>
                  <label className="block text-sm text-bolt-elements-textSecondary mb-2">이메일 주소</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    placeholder="you@example.com"
                    className={classNames(
                      'w-full px-3 py-2 rounded-lg text-sm',
                      'bg-[#F8F8F8] dark:bg-[#1A1A1A]',
                      'border border-[#E5E5E5] dark:border-[#333333]',
                      'text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary',
                      'focus:outline-none focus:ring-1 focus:ring-[#FF5330]',
                      'disabled:opacity-50',
                    )}
                  />
                </div>

                {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

                <div className="flex justify-end gap-2 mt-6">
                  <DialogClose asChild>
                    <DialogButton type="secondary">취소</DialogButton>
                  </DialogClose>
                  <button
                    type="button"
                    onClick={handleSendCode}
                    disabled={loading || !email}
                    className={classNames(
                      'px-4 py-2 rounded-lg text-sm flex items-center gap-2',
                      'bg-[#FF5330] text-white',
                      'hover:bg-[#E64F2F]',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                    )}
                  >
                    {loading ? (
                      <>
                        <div className="i-ph:spinner-gap animate-spin" />
                        발송 중...
                      </>
                    ) : (
                      '코드 받기'
                    )}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-bolt-elements-textSecondary">
                  <span className="font-medium text-bolt-elements-textPrimary">{email}</span>(으)로 발송된 6자리 인증
                  코드를 입력해주세요.
                </p>

                <div>
                  <label className="block text-sm text-bolt-elements-textSecondary mb-2">인증 코드</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    disabled={loading}
                    placeholder="123456"
                    className={classNames(
                      'w-full px-3 py-2 rounded-lg text-sm text-center tracking-[0.4em]',
                      'bg-[#F8F8F8] dark:bg-[#1A1A1A]',
                      'border border-[#E5E5E5] dark:border-[#333333]',
                      'text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary',
                      'focus:outline-none focus:ring-1 focus:ring-[#FF5330]',
                      'disabled:opacity-50',
                    )}
                  />
                </div>

                {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

                <div className="flex justify-between mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setStep('email');
                      setCode('');
                      setError(null);
                    }}
                    disabled={loading}
                    className="px-4 py-2 rounded-lg text-sm text-bolt-elements-textSecondary hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
                  >
                    이메일 다시 입력
                  </button>
                  <button
                    type="button"
                    onClick={handleVerifyCode}
                    disabled={loading || code.length !== 6}
                    className={classNames(
                      'px-4 py-2 rounded-lg text-sm flex items-center gap-2',
                      'bg-[#FF5330] text-white',
                      'hover:bg-[#E64F2F]',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                    )}
                  >
                    {loading ? (
                      <>
                        <div className="i-ph:spinner-gap animate-spin" />
                        확인 중...
                      </>
                    ) : (
                      '확인'
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </Dialog>
      )}
    </DialogRoot>
  );
}
