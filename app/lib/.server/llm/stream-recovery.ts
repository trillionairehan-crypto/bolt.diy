import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('stream-recovery');

export interface StreamRecoveryOptions {
  /** How many stall-triggered retries to allow before giving up. Default 1. */
  maxRetries?: number;
  /** Milliseconds of inactivity before a stream is considered stalled. */
  timeout?: number;
  /** Called each time a stall is detected and a retry is still allowed. */
  onStall?: (attempt: number) => void;
  /** Called once when a stall persists after all retries are exhausted. */
  onGiveUp?: () => void;
}

export class StreamRecoveryManager {
  private _retryCount = 0;
  private _timeoutHandle: NodeJS.Timeout | null = null;
  private _lastActivity: number = Date.now();
  private _isActive = true;

  constructor(private _options: StreamRecoveryOptions = {}) {
    this._options = {
      maxRetries: 1,
      timeout: 30000, // 30 seconds default
      ..._options,
    };
  }

  startMonitoring() {
    this._resetTimeout();
  }

  updateActivity() {
    this._lastActivity = Date.now();
    this._resetTimeout();
  }

  private _resetTimeout() {
    if (this._timeoutHandle) {
      clearTimeout(this._timeoutHandle);
    }

    if (!this._isActive) {
      return;
    }

    this._timeoutHandle = setTimeout(() => {
      if (this._isActive) {
        logger.warn('Stream stall detected (no activity within timeout window)');
        this._handleTimeout();
      }
    }, this._options.timeout);
  }

  private _handleTimeout() {
    if (this._retryCount >= (this._options.maxRetries ?? 1)) {
      logger.error('Max retries reached for stream recovery — giving up');
      this._options.onGiveUp?.();
      this.stop();

      return;
    }

    this._retryCount++;
    logger.info(`Stream stalled — attempting recovery (attempt ${this._retryCount})`);

    this._options.onStall?.(this._retryCount);

    // Reset monitoring so the retried stream gets its own full timeout window.
    this._resetTimeout();
  }

  stop() {
    this._isActive = false;

    if (this._timeoutHandle) {
      clearTimeout(this._timeoutHandle);
      this._timeoutHandle = null;
    }
  }

  getStatus() {
    return {
      isActive: this._isActive,
      retryCount: this._retryCount,
      lastActivity: this._lastActivity,
      timeSinceLastActivity: Date.now() - this._lastActivity,
    };
  }
}
