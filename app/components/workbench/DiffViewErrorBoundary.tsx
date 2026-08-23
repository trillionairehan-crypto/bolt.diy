import { Component, type ErrorInfo, type ReactNode } from 'react';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('DiffViewErrorBoundary');

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Last line of defense for the DiffView removeChild crash (see 791ba91, and the mount-only-when-
 * active fix in Workbench.client.tsx) — catches it if it recurs so it takes out only this panel,
 * not the whole app.
 */
export class DiffViewErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('DiffView crashed', error, errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-2 bg-bolt-elements-background-depth-1">
          <div className="i-ph:warning-circle-duotone text-3xl text-bolt-elements-textTertiary" />
          <p className="text-sm text-bolt-elements-textSecondary max-w-sm">
            차이점을 표시하는 중 문제가 생겼어요. 코드 탭에서 확인해주세요.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
