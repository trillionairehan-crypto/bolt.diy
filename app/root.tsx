import { useStore } from '@nanostores/react';
import type { LinksFunction } from '@remix-run/cloudflare';
import { Links, Meta, Outlet, Scripts, ScrollRestoration, isRouteErrorResponse, useRouteError } from '@remix-run/react';
import tailwindReset from '@unocss/reset/tailwind-compat.css?url';
import { themeStore } from './lib/stores/theme';
import { stripIndents } from './utils/stripIndent';
import { createHead } from 'remix-island';
import { useEffect } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { ClientOnly } from 'remix-utils/client-only';
import { cssTransition, ToastContainer } from 'react-toastify';
import { createScopedLogger } from './utils/logger';
import { initGlobalErrorRecovery } from './utils/globalErrorRecovery';
import { initAuthListener } from './lib/stores/auth';
import { Logo } from './components/ui/Logo';
import { DARK_MODE_ENABLED } from './utils/featureFlags';

import reactToastifyStyles from 'react-toastify/dist/ReactToastify.css?url';
import globalStyles from './styles/index.scss?url';
import xtermStyles from '@xterm/xterm/css/xterm.css?url';

import 'virtual:uno.css';

const logger = createScopedLogger('root');

const toastAnimation = cssTransition({
  enter: 'animated fadeInRight',
  exit: 'animated fadeOutRight',
});

export const links: LinksFunction = () => [
  {
    rel: 'icon',
    href: '/favicon.svg',
    type: 'image/svg+xml',
  },

  // overnight3 B2: opens the connection to the font CDN before the stylesheet below even parses.
  { rel: 'preconnect', href: 'https://cdn.jsdelivr.net', crossOrigin: 'anonymous' },
  { rel: 'stylesheet', href: reactToastifyStyles },
  { rel: 'stylesheet', href: tailwindReset },
  { rel: 'stylesheet', href: globalStyles },
  { rel: 'stylesheet', href: xtermStyles },
  {
    rel: 'stylesheet',
    href: 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css',
  },
];

/*
 * 다크모드 출시 제외 (overnight5) — DARK_MODE_ENABLED가 꺼져 있으면 localStorage에 저장된 값이나
 * OS의 다크 모드 설정과 상관없이 항상 'light'로 고정한다. 이 스크립트는 하이드레이션 전에 실행돼서
 * 화면 깜빡임(잘못된 테마가 잠깐 보였다가 바뀌는 것)을 막는 용도라, DARK_MODE_ENABLED의 "현재 값"을
 * 빌드 시점에 그대로 문자열에 박아넣는다 — 브라우저에서 이 플래그를 다시 import하는 게 아니다.
 */
const inlineThemeCode = DARK_MODE_ENABLED
  ? stripIndents`
    setTutorialKitTheme();

    function setTutorialKitTheme() {
      let theme = localStorage.getItem('bolt_theme');

      if (!theme) {
        theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }

      document.querySelector('html')?.setAttribute('data-theme', theme);
    }
  `
  : stripIndents`
    document.querySelector('html')?.setAttribute('data-theme', 'light');
  `;

export const Head = createHead(() => (
  <>
    <meta charSet="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    {/*
      Browser auto-translate (esp. Chrome) has mangled brand/plan names — e.g. "Light" → "빛",
      "Pro" → "장점" — since this site has no real multi-language use case (the product itself
      requires Korean prompt input, so a non-Korean-reading visitor can't use it translated or
      not), page-wide notranslate is the right call over chasing every element with translate="no".
    */}
    <meta name="google" content="notranslate" />
    {/* Site-wide OG defaults — individual routes still control <title>/description via their own
        meta() export; these just make sure link previews (e.g. KakaoTalk) always have an image. */}
    <meta property="og:site_name" content="코랄레드" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="코랄레드" />
    <meta property="og:description" content="코딩 몰라도 한국어 한마디로 웹사이트와 앱을 만들어요" />
    <meta property="og:image" content="https://coralred.kr/og-image.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:url" content="https://coralred.kr" />
    <meta name="twitter:card" content="summary_large_image" />
    <Meta />
    <Links />
    <script dangerouslySetInnerHTML={{ __html: inlineThemeCode }} />
  </>
));

export function Layout({ children }: { children: React.ReactNode }) {
  const theme = useStore(themeStore);

  useEffect(() => {
    document.querySelector('html')?.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <>
      <ClientOnly>{() => <DndProvider backend={HTML5Backend}>{children}</DndProvider>}</ClientOnly>
      {/* 토스트 아이콘은 플랫폼 5색 중 코랄(성공)/잉크(에러)만 쓴다 — 초록·빨강 같은 의미색 구분
          금지, 성공/에러는 아이콘 모양(체크/경고)으로만 구분한다. toast.scss 참고. */}
      <ToastContainer
        closeButton={({ closeToast }) => {
          return (
            <button className="Toastify__close-button" onClick={closeToast}>
              <div className="i-ph:x text-lg" />
            </button>
          );
        }}
        icon={({ type }) => {
          switch (type) {
            case 'success': {
              return <div className="i-ph:check-bold text-2xl" style={{ color: '#FF5330' }} />;
            }
            case 'error': {
              return <div className="i-ph:warning-circle-bold text-2xl" style={{ color: '#1A1A1A' }} />;
            }
          }

          return undefined;
        }}
        position="bottom-right"
        pauseOnFocusLoss
        transition={toastAnimation}
        autoClose={3000}
      />
      <ScrollRestoration />
      <Scripts />
    </>
  );
}

import { logStore } from './lib/stores/logs';

export default function App() {
  const theme = useStore(themeStore);

  useEffect(() => {
    initGlobalErrorRecovery();
  }, []);

  /*
   * 1-1/1-2/1-6: this used to only run inside Menu.client.tsx (the sidebar), which never mounts
   * on the landing page or on /login,/signup — so authUserStore stayed at its initial null on
   * those routes even for an already-logged-in visitor with a real session in localStorage.
   * Runs once here at the true app root instead, so every route gets a live, correct authUser.
   */
  useEffect(() => {
    const unsubscribe = initAuthListener();
    return unsubscribe;
  }, []);

  useEffect(() => {
    logStore.logSystem('Application initialized', {
      theme,
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    });

    // Initialize debug logging with improved error handling
    import('./utils/debugLogger')
      .then(({ debugLogger }) => {
        /*
         * The debug logger initializes itself and starts disabled by default
         * It will only start capturing when enableDebugMode() is called
         */
        const status = debugLogger.getStatus();
        logStore.logSystem('Debug logging ready', {
          initialized: status.initialized,
          capturing: status.capturing,
          enabled: status.enabled,
        });
      })
      .catch((error) => {
        logStore.logError('Failed to initialize debug logging', error);
      });
  }, []);

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

/**
 * Framework-level fallback for errors that escape all the way to the route (loader/action
 * failures, or a render error with no boundary beneath it) — without this export Remix falls
 * back to its own generic error page instead of coralred's recovery UI. Rendered inside
 * `Layout` automatically by Remix, so no need to repeat the document shell here.
 */
export function ErrorBoundary() {
  const error = useRouteError();
  const is404 = isRouteErrorResponse(error) && error.status === 404;

  useEffect(() => {
    logger.error('Root route error boundary caught', error);
  }, [error]);

  if (is404) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100dvh',
          width: '100%',
          gap: '1rem',
          textAlign: 'center',
          padding: '2rem',
          background: '#FF5330',
          color: '#FAF7F0',
        }}
      >
        <div style={{ display: 'flex', gap: '8px', marginBottom: '0.5rem' }} aria-hidden="true">
          <div style={{ width: 20, height: 20, borderRadius: 7, background: '#FAF7F0' }} />
          <div style={{ width: 20, height: 20, borderRadius: 7, background: '#FFB5A3', marginTop: 10 }} />
          <div style={{ width: 20, height: 20, borderRadius: 7, background: '#FAF7F0', opacity: 0.7 }} />
        </div>
        <Logo variant="onCoral" height={32} />
        <p style={{ fontSize: '1rem', margin: 0, marginTop: '0.5rem' }}>이 페이지는 없어요</p>
        <p style={{ fontSize: '0.85rem', opacity: 0.8, margin: 0 }}>주소를 다시 확인해주세요</p>
        <a
          href="/"
          className="not-found-home-link"
          style={{
            background: '#FAF7F0',
            color: '#FF5330',
            borderRadius: '999px',
            padding: '10px 20px',
            fontSize: '0.875rem',
            fontWeight: 600,
            textDecoration: 'none',
            marginTop: '0.5rem',
            transition: 'opacity 150ms ease, transform 150ms ease',
          }}
        >
          홈으로 가기
        </a>
        <style>{`
          .not-found-home-link:hover { opacity: 0.9; }
          .not-found-home-link:active { transform: scale(0.97); }
          .not-found-home-link:focus-visible { outline: 2px solid #FAF7F0; outline-offset: 3px; }
        `}</style>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100dvh',
        width: '100%',
        gap: '1.25rem',
        textAlign: 'center',
        padding: '2rem',
      }}
    >
      <p style={{ fontSize: '0.9rem', color: 'var(--bolt-elements-textSecondary)', margin: 0 }}>
        화면에 문제가 생겼어요
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{
          background: 'var(--accent)',
          color: 'var(--on-accent)',
          border: 'none',
          borderRadius: '8px',
          padding: '10px 20px',
          fontSize: '0.875rem',
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        다시 불러오기
      </button>
    </div>
  );
}
