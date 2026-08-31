import type { MetaFunction } from '@remix-run/cloudflare';
import { useEffect, useState } from 'react';
import { useNavigate } from '@remix-run/react';
import { useStore } from '@nanostores/react';
import { AuthPageShell } from '~/components/auth/AuthPageShell';
import { SocialAuthButtons } from '~/components/auth/SocialAuthButtons';
import { EmailContinueLink } from '~/components/auth/EmailContinueLink';
import { authUserStore } from '~/lib/stores/auth';
import { buildLoginHeadline } from '~/utils/greeting';

export const meta: MetaFunction = () => {
  return [{ title: '로그인 | 코랄레드' }, { name: 'description', content: '코랄레드에 로그인하세요' }];
};

/*
 * 05~11시 문구와 같아서 SSR(서버 시간대)·첫 클라이언트 렌더가 우연히도 자주 일치하지만, 서버가
 * UTC로 도는 한 항상 그런 건 아니다 — 아래에서 반드시 useEffect로만 갱신한다.
 */
const DEFAULT_LOGIN_HEADLINE = '다시 오셨네요';

export default function Login() {
  const navigate = useNavigate();
  const authUser = useStore(authUserStore);

  /*
   * new Date()로 시간대를 나누는 헤드라인을 렌더 중에 바로 계산하면 서버(UTC로 도는 Cloudflare
   * Worker)와 클라이언트(사용자의 실제 로컬 시간, 보통 KST) 판정이 갈려 하이드레이션 텍스트
   * 불일치가 난다. 그래서 SSR과 첫 클라이언트 렌더 모두 같은 고정값을 쓰고, 마운트 후
   * useEffect에서만 실제 시간대 문구로 갈아끼운다 — BaseChat.tsx의 채팅 홈 헤드라인과 같은 처리.
   */
  const [headline, setHeadline] = useState(DEFAULT_LOGIN_HEADLINE);

  useEffect(() => {
    setHeadline(buildLoginHeadline());
  }, []);

  useEffect(() => {
    if (authUser) {
      navigate('/', { replace: true });
    }
  }, [authUser, navigate]);

  return (
    <AuthPageShell>
      {/* 3-1: Vercel 로그인 화면 정도의 비중 — 32px/600/잉크/가운데. */}
      <h1
        className="text-center"
        style={{ fontSize: 32, fontWeight: 600, color: '#1A1A1A', marginBottom: 32, wordBreak: 'keep-all' }}
      >
        {headline}
      </h1>

      <div className="w-full">
        <SocialAuthButtons showRecentBadge />
      </div>

      <div style={{ marginTop: 24 }}>
        <EmailContinueLink showRecentBadge />
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
