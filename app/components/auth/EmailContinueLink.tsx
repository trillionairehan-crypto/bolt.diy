import { useEffect, useState } from 'react';
import { useNavigate } from '@remix-run/react';
import { sendEmailOtp, verifyEmailOtp, getLastLoginMethod, type LoginMethod } from '~/lib/stores/auth';
import { classNames } from '~/utils/classNames';
import { AUTH_BUTTON_CLASS, RecentLoginBadge } from './SocialAuthButtons';

interface EmailContinueLinkProps {
  /** 로그인 화면에서만 true — 회원가입에는 최근 로그인 배지를 안 보여준다. */
  showRecentBadge?: boolean;
}

/**
 * 4-3: "이메일로 계속하기" starts as a plain text link; clicking it expands the email/code OTP
 * form inline, in the same spot, no page navigation. Shared by /login and /signup so the OTP
 * state machine (ported from the old login.tsx) only exists once.
 */
export function EmailContinueLink({ showRecentBadge = false }: EmailContinueLinkProps) {
  const navigate = useNavigate();
  const [lastMethod, setLastMethod] = useState<LoginMethod | null>(null);

  useEffect(() => {
    if (showRecentBadge) {
      setLastMethod(getLastLoginMethod());
    }
  }, [showRecentBadge]);

  const [expanded, setExpanded] = useState(false);
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="relative text-sm hover:underline"
        style={{ color: '#6E645B', minHeight: 44, background: 'transparent', border: 'none' }}
      >
        이메일로 계속하기
        {lastMethod === 'email' && <RecentLoginBadge />}
      </button>
    );
  }

  return (
    <div className="w-full flex flex-col gap-3">
      {step === 'email' ? (
        <>
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
            autoFocus
            className={classNames(
              'w-full px-3.5 rounded-[10px] text-sm',
              'bg-white text-[#1A1A1A] placeholder-[#6E645B]',
              'focus:outline-none disabled:opacity-50',
            )}
            style={{ height: 52, border: '1px solid #EFE4D6' }}
            onFocus={(e) => (e.currentTarget.style.borderColor = '#FF5330')}
            onBlur={(e) => (e.currentTarget.style.borderColor = '#EFE4D6')}
          />

          {error && (
            <p className="text-sm" style={{ color: '#FF5330' }}>
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handleSendCode}
            disabled={loading || !email}
            className={`${AUTH_BUTTON_CLASS} text-white disabled:opacity-50 disabled:cursor-not-allowed`}
            style={{ background: '#FF5330' }}
          >
            {loading ? (
              <>
                <div className="i-ph:spinner-gap animate-spin" style={{ width: 18, height: 18 }} />
                발송 중...
              </>
            ) : (
              '인증 코드 받기'
            )}
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-center" style={{ color: '#6E645B' }}>
            <span style={{ color: '#1A1A1A', fontWeight: 500 }}>{email}</span>(으)로 발송된 6자리 인증 코드를
            입력해주세요.
          </p>

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
              'w-full px-3.5 rounded-[10px] text-sm text-center tracking-[0.4em]',
              'bg-white text-[#1A1A1A] placeholder-[#6E645B]',
              'focus:outline-none disabled:opacity-50',
            )}
            style={{ height: 52, border: '1px solid #EFE4D6' }}
            onFocus={(e) => (e.currentTarget.style.borderColor = '#FF5330')}
            onBlur={(e) => (e.currentTarget.style.borderColor = '#EFE4D6')}
          />

          {error && (
            <p className="text-sm" style={{ color: '#FF5330' }}>
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handleVerifyCode}
            disabled={loading || code.length !== 6}
            className={`${AUTH_BUTTON_CLASS} text-white disabled:opacity-50 disabled:cursor-not-allowed`}
            style={{ background: '#FF5330' }}
          >
            {loading ? (
              <>
                <div className="i-ph:spinner-gap animate-spin" style={{ width: 18, height: 18 }} />
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
            className="text-sm hover:underline disabled:opacity-50"
            style={{ color: '#6E645B', minHeight: 44, background: 'transparent', border: 'none' }}
          >
            이메일 다시 입력
          </button>
        </>
      )}
    </div>
  );
}
