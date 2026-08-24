import type { MetaFunction } from '@remix-run/cloudflare';
import { useEffect, useState } from 'react';
import { useNavigate } from '@remix-run/react';
import { useStore } from '@nanostores/react';
import { AuthPageShell } from '~/components/auth/AuthPageShell';
import { SocialAuthButtons } from '~/components/auth/SocialAuthButtons';
import { authUserStore, sendEmailOtp, verifyEmailOtp } from '~/lib/stores/auth';
import { classNames } from '~/utils/classNames';

export const meta: MetaFunction = () => {
  return [{ title: '로그인 | 코랄레드' }, { name: 'description', content: '코랄레드에 로그인하세요' }];
};

export default function Login() {
  const navigate = useNavigate();
  const authUser = useStore(authUserStore);

  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authUser) {
      navigate('/', { replace: true });
    }
  }, [authUser, navigate]);

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
      setError('인증 코드를 보내지 못했어요. 이메일 주소를 확인해주세요.');
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
      navigate('/', { replace: true });
    } catch {
      setError('인증 코드가 올바르지 않아요. 다시 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageShell>
      <h1 className="text-xl font-semibold text-bolt-elements-textPrimary text-center mb-6">코랄레드에 로그인</h1>

      {step === 'email' ? (
        <>
          <div>
            <label className="block text-sm text-bolt-elements-textSecondary mb-2">이메일 주소</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSendCode();
                }
              }}
              disabled={loading}
              placeholder="you@example.com"
              className={classNames(
                'w-full px-3 py-2.5 rounded-lg text-sm',
                'bg-[var(--bg)] border border-[var(--border-strong)]',
                'text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary',
                'focus:outline-none focus:ring-1 focus:ring-[var(--accent)]',
                'disabled:opacity-50',
              )}
            />
          </div>

          {error && <p className="text-sm text-red-500 dark:text-red-400 mt-2">{error}</p>}

          <button
            type="button"
            onClick={handleSendCode}
            disabled={loading || !email}
            className="w-full mt-4 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-opacity duration-150 ease-out hover:opacity-90 active:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'var(--text)', color: 'var(--bg)' }}
          >
            {loading ? (
              <>
                <div className="i-ph:spinner-gap animate-spin" />
                발송 중...
              </>
            ) : (
              '이메일로 계속하기'
            )}
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-bolt-elements-textSecondary">
            <span className="font-medium text-bolt-elements-textPrimary">{email}</span>(으)로 발송된 6자리 인증 코드를
            입력해주세요.
          </p>

          <div className="mt-4">
            <label className="block text-sm text-bolt-elements-textSecondary mb-2">인증 코드</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleVerifyCode();
                }
              }}
              disabled={loading}
              placeholder="123456"
              autoFocus
              className={classNames(
                'w-full px-3 py-2.5 rounded-lg text-sm text-center tracking-[0.4em]',
                'bg-[var(--bg)] border border-[var(--border-strong)]',
                'text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary',
                'focus:outline-none focus:ring-1 focus:ring-[var(--accent)]',
                'disabled:opacity-50',
              )}
            />
          </div>

          {error && <p className="text-sm text-red-500 dark:text-red-400 mt-2">{error}</p>}

          <button
            type="button"
            onClick={handleVerifyCode}
            disabled={loading || code.length !== 6}
            className="w-full mt-4 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-opacity duration-150 ease-out hover:opacity-90 active:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'var(--text)', color: 'var(--bg)' }}
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

          <button
            type="button"
            onClick={() => {
              setStep('email');
              setCode('');
              setError(null);
            }}
            disabled={loading}
            className="w-full mt-2 px-4 py-2 rounded-lg text-sm text-bolt-elements-textSecondary hover:bg-[var(--surface-2)] disabled:opacity-50"
          >
            이메일 다시 입력
          </button>
        </>
      )}

      {step === 'email' && (
        <>
          <div className="flex items-center gap-3 my-6">
            <div className="h-px flex-1" style={{ background: 'var(--border)' }} />
            <span className="text-xs text-bolt-elements-textTertiary">또는</span>
            <div className="h-px flex-1" style={{ background: 'var(--border)' }} />
          </div>

          <SocialAuthButtons />
        </>
      )}

      <p className="text-sm text-bolt-elements-textSecondary text-center mt-6">
        계정이 없으신가요?{' '}
        <a href="/signup" className="font-medium" style={{ color: 'var(--accent)' }}>
          회원가입
        </a>
      </p>
    </AuthPageShell>
  );
}
