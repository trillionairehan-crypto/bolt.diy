import { Component, type ErrorInfo, type ReactNode } from 'react';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('MessageErrorBoundary');

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Wraps a single message (see Messages.client.tsx's map loop) so a Markdown/removeChild crash —
 * see the DiffView removeChild crash this mirrors — takes out only that one message, not the
 * whole chat. Deliberately scoped per-message, not around the whole Messages list.
 */
export class MessageErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('Message render crashed', error, errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center gap-2 py-3 px-2 text-sm text-bolt-elements-textSecondary">
          <div className="i-ph:warning-circle-duotone text-lg text-bolt-elements-textTertiary" />이 메시지를 표시하는 중
          문제가 생겼어요.
        </div>
      );
    }

    return this.props.children;
  }
}
