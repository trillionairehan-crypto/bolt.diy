import { useState } from 'react';
import { Dialog, DialogRoot, DialogTitle } from '~/components/ui/Dialog';
import { Logo } from '~/components/ui/Logo';
import { signInWithGoogle, signInWithKakao } from '~/lib/stores/auth';
import { EmailOtpModal } from './EmailOtpModal';

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * The 3-way login chooser (Kakao/Google/Email), extracted out of Menu.client.tsx so every
 * entry point (landing header, sidebar, hero tile, account dropdown) triggers the same flow
 * instead of duplicating the buttons. Only one dialog is ever mounted at a time — the chooser
 * closes itself before EmailOtpModal opens, rather than stacking two dialogs.
 */
export function LoginModal({ open, onClose }: LoginModalProps) {
  const [showEmail, setShowEmail] = useState(false);

  const handleClose = () => {
    setShowEmail(false);
    onClose();
  };

  return (
    <>
      <DialogRoot
        open={open && !showEmail}
        onOpenChange={(next) => {
          if (!next) {
            handleClose();
          }
        }}
      >
        {open && !showEmail && (
          <Dialog className="max-w-[400px] w-[calc(100%-2rem)] rounded-2xl p-6">
            <div className="flex flex-col items-center text-center mb-6">
              <Logo height={32} />
              <DialogTitle className="!justify-center !text-xl !font-bold !mt-4 !mb-1">시작해볼까요?</DialogTitle>
              <p className="text-sm text-bolt-elements-textSecondary">3초면 충분해요</p>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => signInWithKakao()}
                className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
                style={{ background: '#FEE500', color: '#191919' }}
              >
                <img src="https://cdn.simpleicons.org/kakaotalk" crossOrigin="anonymous" alt="" className="w-4 h-4" />
                카카오로 시작하기
              </button>

              <button
                type="button"
                onClick={() => signInWithGoogle()}
                className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium bg-[var(--surface)] text-[var(--text)] border border-[var(--border-strong)] hover:bg-[var(--surface-2)] transition-colors"
              >
                <img
                  src="https://cdn.simpleicons.org/google/4285F4"
                  crossOrigin="anonymous"
                  alt=""
                  className="w-4 h-4"
                />
                구글로 시작하기
              </button>

              <div className="flex items-center gap-3 my-1">
                <div className="flex-1 h-px bg-bolt-elements-borderColor" />
                <span className="text-xs text-bolt-elements-textTertiary">또는</span>
                <div className="flex-1 h-px bg-bolt-elements-borderColor" />
              </div>

              <button
                type="button"
                onClick={() => setShowEmail(true)}
                className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-3 transition-colors"
              >
                <div className="i-ph:envelope-simple w-4 h-4" />
                이메일로 시작하기
              </button>
            </div>
          </Dialog>
        )}
      </DialogRoot>
      <EmailOtpModal open={showEmail} onClose={handleClose} />
    </>
  );
}
