import type { MetaFunction } from '@remix-run/cloudflare';
import { useEffect } from 'react';
import { useNavigate } from '@remix-run/react';
import { useStore } from '@nanostores/react';
import { AuthPageShell } from '~/components/auth/AuthPageShell';
import { SocialAuthButtons } from '~/components/auth/SocialAuthButtons';
import { EmailContinueLink } from '~/components/auth/EmailContinueLink';
import { authUserStore } from '~/lib/stores/auth';

export const meta: MetaFunction = () => {
  return [{ title: '회원가입 | 코랄레드' }, { name: 'description', content: '코랄레드 가입하고 첫 앱을 만들어보세요' }];
};

export default function Signup() {
  const navigate = useNavigate();
  const authUser = useStore(authUserStore);

  useEffect(() => {
    if (authUser) {
      navigate('/', { replace: true });
    }
  }, [authUser, navigate]);

  return (
    <AuthPageShell>
      <h1
        className="text-center"
        style={{ fontSize: 32, fontWeight: 600, color: '#1A1A1A', marginBottom: 32, wordBreak: 'keep-all' }}
      >
        첫 앱까지,
        <br />
        가입 한 번이면 돼요
      </h1>

      <div className="w-full">
        <SocialAuthButtons />
      </div>

      <div style={{ marginTop: 24 }}>
        <EmailContinueLink />
      </div>

      {/* 5-3: 약관 문구는 회원가입에만 — 12px 회갈색, 링크는 밑줄만(코랄 아님). */}
      <p className="text-center" style={{ fontSize: 12, color: '#7A7067', marginTop: 24 }}>
        가입하면{' '}
        <a href="/terms" className="underline" style={{ color: '#7A7067' }}>
          이용약관
        </a>
        과{' '}
        <a href="/privacy" className="underline" style={{ color: '#7A7067' }}>
          개인정보처리방침
        </a>
        에 동의하는 거예요
      </p>

      <p className="text-sm text-center" style={{ color: '#7A7067', marginTop: 24 }}>
        이미 계정이 있으신가요?{' '}
        <a href="/login" className="font-medium" style={{ color: '#FF5330' }}>
          로그인
        </a>
      </p>
    </AuthPageShell>
  );
}
