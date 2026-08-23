import { Component, type ErrorInfo, type ReactNode } from 'react';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('ChatErrorBoundary');

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Last line of defense for render/commit crashes anywhere under the chat route (removeChild
 * desyncs have now surfaced in DiffView, streaming Markdown, and BaseChat's free-trial notice —
 * each got its own scoped fix, but nothing wrapped the route itself) — catches it so the whole
 * app doesn't go blank, just this screen.
 */
export class ChatErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('Chat crashed', error, errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full w-full gap-4 p-8 text-center bg-bolt-elements-background-depth-1">
          <div className="i-ph:warning-circle-duotone text-4xl text-bolt-elements-textTertiary" />
          <p className="text-sm text-bolt-elements-textSecondary">화면에 문제가 생겼어요</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: '#FF5330', color: '#FAF7F0' }}
          >
            다시 불러오기
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
