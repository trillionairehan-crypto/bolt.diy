import * as Dialog from '@radix-ui/react-dialog';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { classNames } from '~/utils/classNames';
import { useGitLabConnection } from '~/lib/hooks';

interface GitLabAuthDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GitLabAuthDialog({ isOpen, onClose }: GitLabAuthDialogProps) {
  const { isConnecting, error, connect } = useGitLabConnection();
  const [token, setToken] = useState('');
  const [gitlabUrl, setGitlabUrl] = useState('https://gitlab.com');

  const handleConnect = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!token.trim()) {
      toast.error('연결 키를 입력해주세요');
      return;
    }

    try {
      // useGitLabConnection's connect() already shows a success/error toast — don't double it here.
      await connect(token, gitlabUrl);
      setToken('');
      onClose();
    } catch (error) {
      // Error handling is done in the hook
      console.error('GitLab connect failed:', error);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10000]" />
        <div className="fixed inset-0 flex items-center justify-center z-[10000]">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="w-[90vw] md:w-[500px]"
          >
            <Dialog.Content
              className="bg-[var(--surface-2)] rounded-lg p-6 border border-bolt-elements-borderColor shadow-xl"
              aria-describedby="gitlab-auth-description"
            >
              <Dialog.Title className="text-lg font-medium text-bolt-elements-textPrimary mb-4">
                GitLab 연결
              </Dialog.Title>

              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
                  <svg viewBox="0 0 24 24" className="w-5 h-5">
                    <path
                      fill="currentColor"
                      d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-medium text-bolt-elements-textPrimary">GitLab 계정 연결</h3>
                  <p id="gitlab-auth-description" className="text-sm text-bolt-elements-textSecondary">
                    깃랩 계정을 연결하면 프로젝트를 올릴 수 있어요
                  </p>
                </div>
              </div>

              <form onSubmit={handleConnect} className="space-y-4">
                <div>
                  <label className="block text-sm text-bolt-elements-textSecondary mb-2">GitLab 주소</label>
                  <input
                    type="url"
                    value={gitlabUrl}
                    onChange={(e) => setGitlabUrl(e.target.value)}
                    disabled={isConnecting}
                    placeholder="https://gitlab.com"
                    className={classNames(
                      'w-full px-3 py-2 rounded-lg text-sm',
                      'bg-bolt-elements-background-depth-2 dark:bg-bolt-elements-background-depth-3',
                      'border border-bolt-elements-borderColor',
                      'text-bolt-elements-textPrimary',
                      'placeholder-bolt-elements-textTertiary',
                      'focus:outline-none focus:ring-2 focus:ring-orange-500',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                    )}
                  />
                </div>

                <div>
                  <label className="block text-sm text-bolt-elements-textSecondary mb-2">연결 키</label>
                  <input
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    disabled={isConnecting}
                    placeholder="연결 키를 입력해주세요"
                    className={classNames(
                      'w-full px-3 py-2 rounded-lg text-sm',
                      'bg-bolt-elements-background-depth-2 dark:bg-bolt-elements-background-depth-3',
                      'border border-bolt-elements-borderColor',
                      'text-bolt-elements-textPrimary',
                      'placeholder-bolt-elements-textTertiary',
                      'focus:outline-none focus:ring-2 focus:ring-orange-500',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                    )}
                    required
                  />
                  <div className="mt-2 text-xs text-bolt-elements-textSecondary">
                    <a
                      href={`${gitlabUrl}/-/user_settings/personal_access_tokens`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-orange-500 hover:text-orange-600 hover:underline inline-flex items-center gap-1"
                    >
                      연결 키 발급받기
                      <div className="i-ph:arrow-square-out w-3 h-3" />
                    </a>
                    <span className="mx-2">•</span>
                    <span>필요한 권한: api, read_repository</span>
                  </div>
                </div>

                {error && (
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700">
                    <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <motion.button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-lg bg-bolt-elements-background-depth-2 dark:bg-bolt-elements-background-depth-3 text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-3 dark:hover:bg-bolt-elements-background-depth-4 text-sm border border-bolt-elements-borderColor"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={isConnecting}
                  >
                    취소
                  </motion.button>
                  <motion.button
                    type="submit"
                    disabled={isConnecting || !token.trim()}
                    className={classNames(
                      'px-4 py-2 rounded-lg text-sm inline-flex items-center gap-2',
                      'bg-orange-500 text-white hover:bg-orange-600',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                    )}
                    whileHover={!isConnecting && token.trim() ? { scale: 1.02 } : {}}
                    whileTap={!isConnecting && token.trim() ? { scale: 0.98 } : {}}
                  >
                    {isConnecting ? (
                      <>
                        <div className="i-ph:spinner-gap animate-spin w-4 h-4" />
                        연결하는 중...
                      </>
                    ) : (
                      <>
                        <div className="i-ph:plug-charging w-4 h-4" />
                        연결하기
                      </>
                    )}
                  </motion.button>
                </div>
              </form>
            </Dialog.Content>
          </motion.div>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
