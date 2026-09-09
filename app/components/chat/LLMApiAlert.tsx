import { AnimatePresence, motion } from 'framer-motion';
import type { LlmErrorAlertType } from '~/types/actions';
import { classNames } from '~/utils/classNames';

interface Props {
  alert: LlmErrorAlertType;
  clearAlert: () => void;
  onRetry?: () => void;
  onContinue?: () => void;
}

export default function LlmErrorAlert({ alert, clearAlert, onRetry, onContinue }: Props) {
  const { title, description, provider, errorType } = alert;
  const isDurationCap = errorType === 'duration_cap';
  const isClientStall = errorType === 'client_stall';

  const getErrorIcon = () => {
    switch (errorType) {
      case 'authentication':
        return 'i-ph:key-duotone';
      case 'rate_limit':
        return 'i-ph:clock-duotone';
      case 'quota':
        return 'i-ph:warning-circle-duotone';
      case 'duration_cap':
        return 'i-ph:hourglass-duotone';
      case 'client_stall':
        return 'i-ph:wifi-slash-duotone';
      default:
        return 'i-ph:warning-duotone';
    }
  };

  const getErrorMessage = () => {
    switch (errorType) {
      case 'authentication':
        return `${provider} 인증에 실패했어요. API 키를 확인해주세요.`;
      case 'rate_limit':
        return `${provider}의 요청 한도를 초과했어요. 잠시 후 다시 시도해주세요.`;
      case 'quota':
        return `${provider}의 사용량을 초과했어요. 계정 한도를 확인해주세요.`;
      case 'duration_cap':
        // 서버가 보낸 문구("~까지 만들었어요. 이어서 만들까요?") 자체가 이미 사용자에게 보여줄 메시지 — 그대로 쓴다.
        return description;
      case 'client_stall':
        // Chat.client.tsx가 보낸 문구 그대로 — 재시도는 무과금.
        return description;
      default:
        return '잠시 문제가 있었어요. 다시 시도해주세요.';
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className="rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-4 mb-2"
      >
        <div className="flex items-start">
          <motion.div
            className="flex-shrink-0"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className={`${getErrorIcon()} text-xl text-bolt-elements-button-danger-text`}></div>
          </motion.div>

          <div className="ml-3 flex-1">
            <motion.h3
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-sm font-medium text-bolt-elements-textPrimary"
            >
              {title}
            </motion.h3>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mt-2 text-sm text-bolt-elements-textSecondary"
            >
              <p>{getErrorMessage()}</p>

              {/* duration_cap/client_stall은 getErrorMessage()가 이미 description 자체를 보여주므로 중복 표시 안 함. */}
              {description && !isDurationCap && !isClientStall && (
                <div className="text-xs text-bolt-elements-textSecondary p-2 bg-bolt-elements-background-depth-3 rounded mt-4 mb-4">
                  오류 상세: {description}
                </div>
              )}
            </motion.div>

            <motion.div
              className="mt-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className="flex gap-2">
                {isDurationCap && onContinue && (
                  <button
                    onClick={onContinue}
                    className={classNames(
                      'px-2 py-1.5 rounded-md text-sm font-medium',
                      'bg-bolt-elements-button-primary-background',
                      'hover:bg-bolt-elements-button-primary-backgroundHover',
                      'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-bolt-elements-button-danger-background',
                      'text-bolt-elements-button-primary-text',
                      'flex items-center gap-1.5',
                    )}
                  >
                    <div className="i-ph:arrow-right-duotone"></div>
                    이어서 만들기
                  </button>
                )}
                {!isDurationCap && onRetry && (
                  <button
                    onClick={onRetry}
                    className={classNames(
                      'px-2 py-1.5 rounded-md text-sm font-medium',
                      'bg-bolt-elements-button-primary-background',
                      'hover:bg-bolt-elements-button-primary-backgroundHover',
                      'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-bolt-elements-button-danger-background',
                      'text-bolt-elements-button-primary-text',
                      'flex items-center gap-1.5',
                    )}
                  >
                    <div className="i-ph:arrow-clockwise-duotone"></div>
                    다시 시도
                  </button>
                )}
                <button
                  onClick={clearAlert}
                  className={classNames(
                    'px-2 py-1.5 rounded-md text-sm font-medium',
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
