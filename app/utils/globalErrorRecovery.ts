import { createScopedLogger } from './logger';

const logger = createScopedLogger('GlobalErrorRecovery');

/*
 * The signature of a React-DOM commit desync: React (or a browser extension that mutated a
 * React-owned node out from under it) tried to remove/insert/replace a child that's no longer
 * where it expected. This is the one error class known to leave the tree corrupted enough that
 * reloading is the only real recovery — everything else is just logged.
 */
const DOM_DESYNC_MESSAGE_PATTERN = /Failed to execute '(removeChild|insertBefore|appendChild|replaceChild)' on 'Node'/;
const DOM_DESYNC_NAMES = new Set(['NotFoundError', 'HierarchyRequestError']);

let recoveryShown = false;

function getErrorDetails(error: unknown): { name: string; message: string } {
  if (error && typeof error === 'object' && 'message' in error) {
    const err = error as { name?: unknown; message?: unknown };
    return { name: String(err.name ?? ''), message: String(err.message ?? '') };
  }

  return { name: '', message: String(error ?? '') };
}

function isBenignNoise(message: string): boolean {
  return /ResizeObserver loop/i.test(message) || message === 'Script error.' || message === '';
}

function isDomDesyncError(error: unknown): boolean {
  const { name, message } = getErrorDetails(error);
  return DOM_DESYNC_NAMES.has(name) && DOM_DESYNC_MESSAGE_PATTERN.test(message);
}

export function initGlobalErrorRecovery() {
  if (typeof window === 'undefined') {
    return;
  }

  window.addEventListener('error', (event) => {
    const details = getErrorDetails(event.error ?? event.message);

    if (isBenignNoise(details.message || event.message)) {
      return;
    }

    logger.error('Uncaught error', event.error ?? event.message, event.filename, event.lineno, event.colno);

    if (isDomDesyncError(event.error)) {
      showRecoveryOverlay();
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    const details = getErrorDetails(event.reason);

    if (isBenignNoise(details.message)) {
      return;
    }

    logger.error('Unhandled promise rejection', event.reason);

    if (isDomDesyncError(event.reason)) {
      showRecoveryOverlay();
    }
  });
}

/*
 * Deliberately built with raw DOM APIs, not React — this runs specifically for the case where
 * React's own tree may already be corrupted, so it can't depend on React still being able to
 * render anything.
 */
function showRecoveryOverlay() {
  if (recoveryShown) {
    return;
  }

  recoveryShown = true;

  const overlay = document.createElement('div');
  overlay.setAttribute(
    'style',
    [
      'position:fixed',
      'inset:0',
      'z-index:2147483647',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'background:rgba(28,25,23,0.55)',
      'font-family:-apple-system,BlinkMacSystemFont,"Malgun Gothic","Apple SD Gothic Neo",sans-serif',
    ].join(';'),
  );

  const card = document.createElement('div');
  card.setAttribute(
    'style',
    [
      'background:#FAF7F0',
      'border-radius:16px',
      'padding:32px 28px',
      'max-width:320px',
      'width:calc(100% - 48px)',
      'text-align:center',
      'box-shadow:0 20px 60px rgba(0,0,0,0.3)',
    ].join(';'),
  );

  const message = document.createElement('p');
  message.textContent = '화면에 문제가 생겼어요';
  message.setAttribute('style', 'margin:0 0 20px;font-size:15px;color:#1c1917;');

  const button = document.createElement('button');
  button.textContent = '다시 불러오기';
  button.setAttribute(
    'style',
    [
      'background:#FF5330',
      'color:#FAF7F0',
      'border:none',
      'border-radius:8px',
      'padding:10px 20px',
      'font-size:14px',
      'font-weight:500',
      'cursor:pointer',
    ].join(';'),
  );
  button.addEventListener('click', () => window.location.reload());

  card.appendChild(message);
  card.appendChild(button);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
}
