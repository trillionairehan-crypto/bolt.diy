import type { MetaFunction } from '@remix-run/cloudflare';
import { useEffect } from 'react';
import { useNavigate } from '@remix-run/react';
import { useStore } from '@nanostores/react';
import { AuthPageShell } from '~/components/auth/AuthPageShell';
import { SocialAuthButtons } from '~/components/auth/SocialAuthButtons';
import { EmailContinueLink } from '~/components/auth/EmailContinueLink';
import { authUserStore } from '~/lib/stores/auth';

export const meta: MetaFunction = () => {
  return [{ title: '로그인 | 코랄레드' }, { name: 'description', content: '코랄레드에 로그인하세요' }];
};

export default function Login() {
  const navigate = useNavigate();
  const authUser = useStore(authUserStore);

  useEffect(() => {
    if (authUser) {
      navigate('/', { replace: true });
    }
  }, [authUser, navigate]);

  return (
    <AuthPageShell>
      {/* 3-1: Vercel 로그인 화면 정도의 비중 — 32px/600/잉크/가운데. */}
      <h1 className="text-center" style={{ fontSize: 32, fontWeight: 600, color: '#1A1A1A', marginBottom: 32 }}>
        다시 오셨네요
      </h1>

      <div className="w-full">
        <SocialAuthButtons />
      </div>

      <div style={{ marginTop: 24 }}>
        <EmailContinueLink />
      </div>

      <p className="text-sm text-center" style={{ color: '#7A7067', marginTop: 40 }}>
        계정이 없으신가요?{' '}
        <a href="/signup" className="font-medium" style={{ color: '#FF5330' }}>
          회원가입
        </a>
      </p>
    </AuthPageShell>
  );
}
