import type { ReactNode } from 'react';
import { useStore } from '@nanostores/react';
import { LogoAssembly } from '~/components/ui/LogoAssembly';
import { authLogoPulseStore } from '~/lib/stores/auth';

interface AuthPageShellProps {
  children: ReactNode;
  topRight?: ReactNode;
}

// 1: 24px 안팎이던 로고를 64px로 — 이전 크기에서는 조립 애니메이션이 거의 안 보였다.
const LOGO_SIZE = 64;

/**
 * Shared frame for /login and /signup — cream backdrop, no card, logo mark top-center, content
 * anchored around the viewport's 40% vertical mark. top:40%/translateY(-50%)는 로고+콘텐츠를 합친
 * 블록 전체의 실제 렌더 높이를 기준으로 중앙을 잡으므로(1-2), 로고가 28px→64px로 커져도 앵커
 * 재계산 코드 없이 그대로 유지된다 — 이 페이지엔 채팅 홈과 달리 아래에 다른 섹션이 없어서
 * (ChatHome.module.scss가 겪은 min-height 문제와 달리) absolute+translateY를 그대로 써도 안전하다.
 */
export function AuthPageShell({ children, topRight }: AuthPageShellProps) {
  const pulse = useStore(authLogoPulseStore);

  return (
    <div className="relative w-full min-h-screen" style={{ background: '#FBF5EE' }}>
      {topRight && <div className="absolute top-6 right-6">{topRight}</div>}

      <div className="absolute left-0 right-0" style={{ top: '40%', transform: 'translateY(-50%)' }}>
        <div className="w-full max-w-[360px] mx-auto px-6 flex flex-col items-center">
          <a href="/" aria-label="코랄레드 홈으로" style={{ marginBottom: 56 }}>
            <LogoAssembly
              size={LOGO_SIZE}
              scatter="compact"
              durationMs={500}
              staggerMs={40}
              easing="ease-out"
              hoverReaction={false}
              pulse={pulse}
            />
          </a>

          {children}
        </div>
      </div>
    </div>
  );
}
