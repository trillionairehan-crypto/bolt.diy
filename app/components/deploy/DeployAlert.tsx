import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { toast } from 'react-toastify';
import { useStore } from '@nanostores/react';
import { classNames } from '~/utils/classNames';
import type { DeployAlert } from '~/types/actions';
import { supabaseConnection } from '~/lib/stores/supabase';

interface DeployAlertProps {
  alert: DeployAlert;
  clearAlert: () => void;
  postMessage: (message: string) => void;
}

export default function DeployChatAlert({ alert, clearAlert, postMessage }: DeployAlertProps) {
  const { type, title, description, content, url, stage, buildStatus, deployStatus, reason } = alert;
  const [copied, setCopied] = useState(false);
  const supabaseConn = useStore(supabaseConnection);

  const handleCopyUrl = async () => {
    if (!url) {
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('링크를 복사하지 못했어요.');
    }
  };

  // Determine if we should show the deployment progress
  const showProgress = stage && (buildStatus || deployStatus);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className={`rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-4 mb-2`}
      >
        <div className="flex items-start">
          {/* Icon */}
          <motion.div
            className="flex-shrink-0"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div
              className={classNames(
                'text-xl',
                type === 'success'
                  ? 'i-ph:check-circle-duotone text-bolt-elements-icon-success'
                  : type === 'error'
                    ? 'i-ph:warning-duotone text-bolt-elements-button-danger-text'
                    : 'i-ph:info-duotone text-bolt-elements-loader-progress',
              )}
            ></div>
          </motion.div>
          {/* Content */}
          <div className="ml-3 flex-1">
            <motion.h3
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className={`text-sm font-medium text-bolt-elements-textPrimary`}
            >
              {title}
            </motion.h3>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className={`mt-2 text-sm text-bolt-elements-textSecondary`}
            >
              <p>{description}</p>

              {/* Deployment Progress Visualization */}
              {showProgress && (
                <div className="mt-4 mb-2">
                  <div className="flex items-center space-x-2 mb-3">
                    {/* Build Step */}
                    <div className="flex items-center">
                      <div
                        className={classNames(
                          'w-6 h-6 rounded-full flex items-center justify-center',
                          buildStatus === 'running'
                            ? 'bg-bolt-elements-loader-progress'
                            : buildStatus === 'complete'
                              ? 'bg-bolt-elements-icon-success'
                              : buildStatus === 'failed'
                                ? 'bg-bolt-elements-button-danger-background'
                                : 'bg-bolt-elements-textTertiary',
                        )}
                      >
                        {buildStatus === 'running' ? (
                          <div className="i-svg-spinners:90-ring-with-bg text-white text-xs"></div>
                        ) : buildStatus === 'complete' ? (
                          <div className="i-ph:check text-white text-xs"></div>
                        ) : buildStatus === 'failed' ? (
                          <div className="i-ph:x text-white text-xs"></div>
                        ) : (
                          <span className="text-white text-xs">1</span>
                        )}
                      </div>
                      <span className="ml-2">빌드</span>
                    </div>

                    {/* Connector Line */}
                    <div
                      className={classNames(
                        'h-0.5 w-8',
                        buildStatus === 'complete' ? 'bg-bolt-elements-icon-success' : 'bg-bolt-elements-textTertiary',
                      )}
                    ></div>

                    {/* Deploy Step */}
                    <div className="flex items-center">
                      <div
                        className={classNames(
                          'w-6 h-6 rounded-full flex items-center justify-center',
                          deployStatus === 'running'
                            ? 'bg-bolt-elements-loader-progress'
                            : deployStatus === 'complete'
                              ? 'bg-bolt-elements-icon-success'
                              : deployStatus === 'failed'
                                ? 'bg-bolt-elements-button-danger-background'
                                : 'bg-bolt-elements-textTertiary',
                        )}
                      >
                        {deployStatus === 'running' ? (
                          <div className="i-svg-spinners:90-ring-with-bg text-white text-xs"></div>
                        ) : deployStatus === 'complete' ? (
                          <div className="i-ph:check text-white text-xs"></div>
                        ) : deployStatus === 'failed' ? (
                          <div className="i-ph:x text-white text-xs"></div>
                        ) : (
                          <span className="text-white text-xs">2</span>
                        )}
                      </div>
                      <span className="ml-2">배포</span>
                    </div>
                  </div>
                </div>
              )}

              {content && (
                <div className="text-xs text-bolt-elements-textSecondary p-2 bg-bolt-elements-background-depth-3 rounded mt-4 mb-4">
                  {content}
                </div>
              )}
              {url && type === 'success' && (
                <div className="mt-2 flex items-center gap-3 flex-wrap">
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-bolt-elements-item-contentAccent hover:underline flex items-center"
                  >
                    <span className="mr-1">배포된 사이트 보기</span>
                    <div className="i-ph:arrow-square-out"></div>
                  </a>
                  <button
                    type="button"
                    onClick={handleCopyUrl}
                    className="text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary flex items-center gap-1 text-sm"
                  >
                    <div className={copied ? 'i-ph:check' : 'i-ph:copy'}></div>
                    {copied ? '복사됐어요' : '링크 복사'}
                  </button>
                </div>
              )}

              {url && type === 'success' && stage === 'complete' && (
                <div className="mt-4 grid gap-2">
                  <p className="text-xs font-medium text-bolt-elements-textTertiary">다음 단계</p>

                  {!supabaseConn.isConnected && (
                    <button
                      type="button"
                      onClick={() => document.dispatchEvent(new CustomEvent('open-supabase-connection'))}
                      className="flex items-center gap-2 p-2.5 rounded-md bg-bolt-elements-background-depth-3 hover:bg-bolt-elements-item-backgroundActive text-left"
                    >
                      <div className="i-ph:database text-base text-bolt-elements-textSecondary shrink-0" />
                      <span className="flex-1 text-xs text-bolt-elements-textPrimary">
                        저장 기능을 켜면 회원가입, 목록 저장 같은 기능이 실제로 동작해요
                      </span>
                      <div className="i-ph:caret-right text-bolt-elements-textTertiary shrink-0" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleCopyUrl}
                    className="flex items-center gap-2 p-2.5 rounded-md bg-bolt-elements-background-depth-3 hover:bg-bolt-elements-item-backgroundActive text-left"
                  >
                    <div
                      className={classNames(
                        'text-base text-bolt-elements-textSecondary shrink-0',
                        copied ? 'i-ph:check' : 'i-ph:share-network',
                      )}
                    />
                    <span className="flex-1 text-xs text-bolt-elements-textPrimary">
                      {copied ? '링크를 복사했어요' : '링크를 복사해서 다른 사람에게 공유해요'}
                    </span>
                  </button>

                  <div className="flex items-center gap-2 p-2.5 rounded-md bg-bolt-elements-background-depth-3">
                    <div className="i-ph:chat-circle-text text-base text-bolt-elements-textSecondary shrink-0" />
                    <span className="flex-1 text-xs text-bolt-elements-textPrimary">
                      수정하고 싶은 부분이 있으면 채팅으로 말해주세요. 다시 배포하기를 누르면 같은 주소로 업데이트돼요
                    </span>
                  </div>
                </div>
              )}
            </motion.div>

            {/* Actions */}
            <motion.div
              className="mt-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className={classNames('flex gap-2')}>
                {/*
                  TRUST_FIX_REPORT.md 작업 3 — 로그인이 안 돼 있어서 실패한 경우, AI에게
                  물어봐도 고칠 수 있는 문제가 아니라서 그 버튼 대신 로그인 페이지로 바로
                  이동하는 버튼을 보여준다. 로그인 후 이 채팅으로 돌아오는 복귀 경로는 아직
                  없다 — TRUST_FIX_REPORT.md에 기록.
                */}
                {type === 'error' && reason === 'auth_required' ? (
                  <a
                    href="/login"
                    className={classNames(
                      `px-2 py-1.5 rounded-md text-sm font-medium`,
                      'bg-bolt-elements-button-primary-background',
                      'hover:bg-bolt-elements-button-primary-backgroundHover',
                      'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-bolt-elements-button-danger-background',
                      'text-bolt-elements-button-primary-text',
                      'flex items-center gap-1.5',
                    )}
                  >
                    <div className="i-ph:sign-in-duotone"></div>
                    로그인하기
                  </a>
                ) : (
                  type === 'error' && (
                    <button
                      onClick={() => postMessage(`*이 배포 오류를 고쳐줘*\n\`\`\`\n${content || description}\n\`\`\`\n`)}
                      className={classNames(
                        `px-2 py-1.5 rounded-md text-sm font-medium`,
                        'bg-bolt-elements-button-primary-background',
                        'hover:bg-bolt-elements-button-primary-backgroundHover',
                        'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-bolt-elements-button-danger-background',
                        'text-bolt-elements-button-primary-text',
                        'flex items-center gap-1.5',
                      )}
                    >
                      <div className="i-ph:chat-circle-duotone"></div>
                      코랄레드에게 물어보기
                    </button>
                  )
                )}
                <button
                  onClick={clearAlert}
                  className={classNames(
                    `px-2 py-1.5 rounded-md text-sm font-medium`,
                    'bg-bolt-elements-button-secondary-background',
                    'hover:bg-bolt-elements-button-secondary-backgroundHover',
                    'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-bolt-elements-button-secondary-background',
                    'text-bolt-elements-button-secondary-text',
                  )}
                >
                  닫기
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
