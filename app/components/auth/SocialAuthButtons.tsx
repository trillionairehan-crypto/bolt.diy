import { useEffect, useState } from 'react';
import {
  signInWithGoogle,
  signInWithKakao,
  authLogoPulseStore,
  getLastLoginMethod,
  type LoginMethod,
} from '~/lib/stores/auth';

/** KakaoTalk's speech-bubble symbol (not the full square app icon, which reads as a muddy blob at button size). */
function KakaoSymbol() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#000000"
        fillOpacity="0.85"
        d="M12.0009 3C17.7999 3 22.501 6.66445 22.501 11.1847C22.501 15.705 17.7999 19.3694 12.0009 19.3694C11.4127 19.3694 10.8361 19.331 10.2742 19.2586L5.86611 22.1419C5.36471 22.4073 5.18769 22.3778 5.39411 21.7289L6.28571 18.0513C3.40572 16.5919 1.50098 14.0619 1.50098 11.1847C1.50098 6.66445 6.20194 3 12.0009 3ZM17.908 11.0591L19.3783 9.63617C19.5656 9.45485 19.5705 9.15617 19.3893 8.96882C19.2081 8.78172 18.9094 8.77668 18.7219 8.95788L16.7937 10.8239V9.28226C16.7937 9.02172 16.5825 8.81038 16.3218 8.81038C16.0613 8.81038 15.8499 9.02172 15.8499 9.28226V11.8393C15.8321 11.9123 15.8325 11.9879 15.8499 12.0611V13.5C15.8499 13.7606 16.0613 13.9719 16.3218 13.9719C16.5825 13.9719 16.7937 13.7606 16.7937 13.5V12.1373L17.2213 11.7236L18.6491 13.7565C18.741 13.8873 18.8873 13.9573 19.0357 13.9573C19.1295 13.9573 19.2241 13.9293 19.3066 13.8714C19.5199 13.7217 19.5713 13.4273 19.4215 13.214L17.908 11.0591ZM14.9503 12.9839H13.4904V9.29702C13.4904 9.03648 13.2791 8.82514 13.0184 8.82514C12.7579 8.82514 12.5467 9.03648 12.5467 9.29702V13.4557C12.5467 13.7164 12.7579 13.9276 13.0184 13.9276H14.9503C15.211 13.9276 15.4222 13.7164 15.4222 13.4557C15.4222 13.1952 15.211 12.9839 14.9503 12.9839ZM9.09318 11.8925L9.78919 10.1849L10.4265 11.8925H9.09318ZM11.6159 12.3802C11.6161 12.3748 11.6175 12.3699 11.6175 12.3645C11.6175 12.2405 11.5687 12.1287 11.4906 12.0445L10.4452 9.24376C10.3468 8.9639 10.1005 8.77815 9.81761 8.77028C9.53948 8.76277 9.28066 8.93672 9.16453 9.21669L7.50348 13.2924C7.40519 13.5337 7.52107 13.8092 7.76242 13.9076C8.00378 14.006 8.2792 13.89 8.37749 13.6486L8.70852 12.8364H10.7787L11.077 13.6356C11.1479 13.8254 11.3278 13.9426 11.5193 13.9425C11.5741 13.9425 11.6298 13.9329 11.6842 13.9126C11.9284 13.8216 12.0524 13.5497 11.9612 13.3054L11.6159 12.3802ZM8.29446 9.30194C8.29446 9.0414 8.08312 8.83006 7.82258 8.83006H4.57822C4.31755 8.83006 4.10622 9.0414 4.10622 9.30194C4.10622 9.56249 4.31755 9.77382 4.57822 9.77382H5.73824V13.5099C5.73824 13.7705 5.94957 13.9817 6.21012 13.9817C6.47078 13.9817 6.68212 13.7705 6.68212 13.5099V9.77382H7.82258C8.08312 9.77382 8.29446 9.56249 8.29446 9.30194Z"
      />
    </svg>
  );
}

/** Google's official 4-color "G" mark — brand colors are fixed, no theme tokens. */
function GoogleSymbol() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20c11.045 0 20-8.955 20-20 0-1.341-.138-2.65-.389-3.917Z"
      />
      <path
        fill="#FF3D00"
        d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691Z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44Z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917Z"
      />
    </svg>
  );
}

/**
 * Kakao-then-Google buttons shared by /login and /signup — same order and styling on both pages,
 * just positioned differently (login: below the email option; signup: at the top). Both button
 * fills (#FEE500 Kakao yellow, and each brand's own mark colors) are fixed third-party brand
 * colors, not theme tokens, same as everywhere else this button appears.
 */
// 4-1/4-5: shared sizing so all auth buttons (social + the email submit button) line up exactly.
export const AUTH_BUTTON_CLASS =
  'relative w-full h-[52px] flex items-center justify-center gap-2 rounded-[10px] text-sm font-medium transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bolt-elements-focus';

/*
 * 4: "최근 로그인" 배지 — 12px, 코랄 배경, 흰 글자, 버튼 우상단. 로그인 화면에서만 쓰고
 * (showRecentBadge prop) 회원가입 화면엔 안 준다. EmailContinueLink도 같은 배지를 쓴다.
 */
export function RecentLoginBadge() {
  return (
    <span
      className="absolute -top-2 -right-2 rounded-full px-2 py-0.5 pointer-events-none"
      style={{ background: '#FF5330', color: '#FFFFFF', fontSize: 12, fontWeight: 600, lineHeight: '16px' }}
    >
      최근 로그인
    </span>
  );
}

/** OAuth 리다이렉트 직전(2): 로고가 한 번 튀는 애니메이션(250ms)이 다 보이도록 그만큼 미루고 이동. */
const LOGO_PULSE_MS = 250;

function startSocialSignIn(signIn: () => Promise<void>) {
  authLogoPulseStore.set(true);
  window.setTimeout(() => {
    signIn();

    /*
     * 리다이렉트가 보통 이 시점에 이미 페이지를 떠나지만, 팝업 차단·사용자 취소 등으로 로그인
     * 화면에 남는 경우도 있다 — false로 되돌려둬야 다음 클릭에서 CSS 애니메이션이 다시 재생된다
     * (같은 값으로 유지되면 클래스가 이미 적용된 상태라 재트리거가 안 됨).
     */
    authLogoPulseStore.set(false);
  }, LOGO_PULSE_MS);
}

interface SocialAuthButtonsProps {
  /** 로그인 화면에서만 true — 회원가입에는 최근 로그인 배지를 안 보여준다. */
  showRecentBadge?: boolean;
}

export function SocialAuthButtons({ showRecentBadge = false }: SocialAuthButtonsProps) {
  const [lastMethod, setLastMethod] = useState<LoginMethod | null>(null);

  useEffect(() => {
    if (showRecentBadge) {
      setLastMethod(getLastLoginMethod());
    }
  }, [showRecentBadge]);

  return (
    <div className="flex flex-col gap-2">
      {/*
       * 마무리 수정 4: 카카오 노란색(#FEE500)은 브랜드 규정상 고정이지만, 테두리가 없어서 옆의
       * 구글 버튼(회갈색 테두리)보다 시각적으로 튀었다 — 두 버튼에 같은 테두리·그림자를 줘서
       * 무게를 맞춘다. font-weight는 이미 AUTH_BUTTON_CLASS(font-medium) 공유라 손댈 게 없음.
       */}
      <button
        type="button"
        onClick={() => startSocialSignIn(signInWithKakao)}
        className={AUTH_BUTTON_CLASS}
        style={{
          background: '#FEE500',
          color: '#191919',
          border: '1px solid #EFE4D6',
          boxShadow: '0 1px 2px rgba(26, 26, 26, 0.04)',
        }}
      >
        <KakaoSymbol />
        카카오로 계속하기
        {lastMethod === 'kakao' && <RecentLoginBadge />}
      </button>

      <button
        type="button"
        onClick={() => startSocialSignIn(signInWithGoogle)}
        className={`${AUTH_BUTTON_CLASS} bg-white hover:bg-[#FBF5EE]`}
        style={{ border: '1px solid #EFE4D6', color: '#1A1A1A', boxShadow: '0 1px 2px rgba(26, 26, 26, 0.04)' }}
      >
        <GoogleSymbol />
        구글로 계속하기
        {lastMethod === 'google' && <RecentLoginBadge />}
      </button>
    </div>
  );
}
