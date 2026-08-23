import { useState } from 'react';
import { Dialog, DialogRoot, DialogTitle } from '~/components/ui/Dialog';
import { signInWithGoogle, signInWithKakao } from '~/lib/stores/auth';
import { EmailOtpModal } from './EmailOtpModal';

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * The 3-way login chooser (Google/Kakao/Email), extracted out of Menu.client.tsx so the landing
 * header and the sidebar can both trigger the same flow instead of duplicating the buttons.
 * Only one dialog is ever mounted at a time — the chooser closes itself before EmailOtpModal
 * opens, rather than stacking two dialogs.
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
          <Dialog className="max-w-[380px] p-6">
            <div className="space-y-4">
              <DialogTitle>로그인</DialogTitle>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => signInWithGoogle()}
                  className="w-full flex items-center justify-center gap-2 bg-[#FF5330]/10 dark:bg-[#FF5330]/10 text-[#FF5330] dark:text-[#FF5330] hover:bg-[#FF5330]/20 dark:hover:bg-[#FF5330]/20 rounded-lg px-4 py-2 transition-colors text-sm font-medium"
                >
                  구글로 로그인
                </button>
                <button
                  type="button"
                  onClick={() => signInWithKakao()}
                  className="w-full flex items-center justify-center gap-2 bg-[#FEE500] hover:bg-[#FEE500]/80 text-black rounded-lg px-4 py-2 transition-colors text-sm font-medium"
                >
                  카카오로 로그인
                </button>
                <button
                  type="button"
                  onClick={() => setShowEmail(true)}
                  className="w-full flex items-center justify-center gap-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg px-4 py-2 transition-colors text-sm font-medium"
                >
                  이메일로 로그인
                </button>
              </div>
            </div>
          </Dialog>
        )}
      </DialogRoot>
      <EmailOtpModal open={showEmail} onClose={handleClose} />
    </>
  );
}
