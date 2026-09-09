import { RemixBrowser } from '@remix-run/react';
import { startTransition } from 'react';
import { hydrateRoot } from 'react-dom/client';
import * as Sentry from '@sentry/remix';

/*
 * process.env.SENTRY_DSN is inlined at build time by vite.config.ts's `define` — the browser
 * bundle has no runtime access to Cloudflare env vars, so this is the only way to get the DSN
 * (a public value, not a secret) into client code without hardcoding it in source.
 */
Sentry.init({
  dsn: process.env.SENTRY_DSN || undefined,
});

// Dynamic import() failures after a redeploy changes chunk hashes — not caught by window.onerror.
window.addEventListener('vite:preloadError', (event) => {
  Sentry.captureException((event as unknown as { payload?: unknown }).payload ?? event);
});

startTransition(() => {
  hydrateRoot(document.getElementById('root')!, <RemixBrowser />);
});
