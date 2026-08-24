import { signInWithGoogle, signInWithKakao } from '~/lib/stores/auth';

/**
 * Kakao-then-Google buttons shared by /login and /signup — same order and styling on both pages,
 * just positioned differently (login: below the email option; signup: at the top). Kakao's
 * #FEE500/#191919 is a fixed third-party brand color, not a theme token, same as everywhere else
 * this button appears.
 */
export function SocialAuthButtons() {
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => signInWithKakao()}
        className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-opacity duration-150 ease-out hover:opacity-90 active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bolt-elements-focus"
        style={{ background: '#FEE500', color: '#191919' }}
      >
        <img src="https://cdn.simpleicons.org/kakaotalk" crossOrigin="anonymous" alt="" className="w-4 h-4" />
        카카오로 계속하기
      </button>

      <button
        type="button"
        onClick={() => signInWithGoogle()}
        className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium bg-[var(--surface)] text-[var(--text)] border border-[var(--border-strong)] hover:bg-[var(--surface-2)] active:bg-[var(--border)] transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bolt-elements-focus"
      >
        <img src="https://cdn.simpleicons.org/google/4285F4" crossOrigin="anonymous" alt="" className="w-4 h-4" />
        구글로 계속하기
      </button>
    </div>
  );
}
