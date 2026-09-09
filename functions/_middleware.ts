import * as Sentry from '@sentry/cloudflare';

/*
 * Sentry entry point for the whole Pages Function chain — must run before functions/[[path]].ts
 * (Cloudflare runs _middleware in filename order before the catch-all route handler) so it can
 * see every unhandled exception, not just the ones Remix's own handleError hook reaches.
 * sentryPagesPlugin reads env per-request from Cloudflare's context, so this works regardless of
 * whether process.env is populated (see wrangler.toml note in the PR description) and needs no
 * wrangler.toml change — env.SENTRY_DSN just has to exist as a Pages env var/secret.
 */
export const onRequest = [
  Sentry.sentryPagesPlugin((context) => ({
    dsn: (context.env as { SENTRY_DSN?: string }).SENTRY_DSN,
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request) {
        delete event.request.cookies;
        delete event.request.data;

        if (event.request.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
        }
      }

      return event;
    },
  })),
];
