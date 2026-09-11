import type { AppLoadContext } from '@remix-run/cloudflare';
import { RemixServer } from '@remix-run/react';
import { isbot } from 'isbot';
import { renderToReadableStream } from 'react-dom/server';
import { renderHeadToString } from 'remix-island';
import * as Sentry from '@sentry/remix';
import { Head } from './root';
import { themeStore } from '~/lib/stores/theme';

/*
 * Catches loader/action errors Remix's own error boundary machinery handles internally — these
 * never reach the onError below since they don't escape as a thrown render error. Relies on
 * functions/_middleware.ts having already called Sentry.init (sentryPagesPlugin) for this request;
 * this just reports into whatever client is active.
 */
export const handleError = Sentry.sentryHandleError;

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: any,
  _loadContext: AppLoadContext,
) {
  // await initializeModelList({});

  const readable = await renderToReadableStream(<RemixServer context={remixContext} url={request.url} />, {
    signal: request.signal,
    onError(error: unknown) {
      console.error(error);
      Sentry.captureException(error);
      responseStatusCode = 500;
    },
  });

  const body = new ReadableStream({
    start(controller) {
      const head = renderHeadToString({ request, remixContext, Head });

      controller.enqueue(
        new Uint8Array(
          new TextEncoder().encode(
            `<!DOCTYPE html><html lang="ko" data-theme="${themeStore.value}"><head>${head}</head><body><div id="root" class="w-full h-full">`,
          ),
        ),
      );

      const reader = readable.getReader();

      function read() {
        reader
          .read()
          .then(({ done, value }) => {
            if (done) {
              controller.enqueue(new Uint8Array(new TextEncoder().encode('</div></body></html>')));
              controller.close();

              return;
            }

            controller.enqueue(value);
            read();
          })
          .catch((error) => {
            controller.error(error);
            readable.cancel();
          });
      }
      read();
    },

    cancel() {
      readable.cancel();
    },
  });

  if (isbot(request.headers.get('user-agent') || '')) {
    await readable.allReady;
  }

  responseHeaders.set('Content-Type', 'text/html');

  /*
   * COEP require-corp 는 WebContainer(SharedArrayBuffer) 때문에 필요하지만, /brief 미리보기는 WebContainer 를 쓰지 않고
   * R2 공개 버킷 미디어(CORP 헤더 없음)를 그대로 보여줘야 하므로 이 경로만 제외한다.
   */
  if (!new URL(request.url).pathname.startsWith('/brief')) {
    responseHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');
  }

  responseHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');

  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
