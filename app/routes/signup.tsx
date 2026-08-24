import type { MetaFunction } from '@remix-run/cloudflare';
import { useEffect } from 'react';
import { useNavigate } from '@remix-run/react';
import { useStore } from '@nanostores/react';
import { AuthPageShell } from '~/components/auth/AuthPageShell';
import { SocialAuthButtons } from '~/components/auth/SocialAuthButtons';
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
    <AuthPageShell
      topRight={
        <a
          href="/login"
          className="text-sm font-medium rounded-full px-4 py-1.5 hover:bg-[var(--surface-2)] transition-colors"
          style={{ color: 'var(--text)' }}
        >
          로그인
        </a>
      }
    >
      <h1 className="text-xl font-semibold text-bolt-elements-textPrimary text-center mb-6">
        첫 앱까지, 가입 한 번이면 돼요
      </h1>

      <SocialAuthButtons />

      <div className="text-center mt-4">
        <a href="/login" className="text-sm font-medium" style={{ color: 'var(--accent)' }}>
          이메일로 계속하기 →
        </a>
      </div>

      <p className="text-xs text-bolt-elements-textTertiary text-center mt-6">
        가입하면{' '}
        <a href="/terms" className="underline" style={{ color: 'var(--text)' }}>
          이용약관
        </a>
        과{' '}
        <a href="/privacy" className="underline" style={{ color: 'var(--text)' }}>
          개인정보처리방침
        </a>
        에 동의하는 거예요
      </p>
    </AuthPageShell>
  );
}
