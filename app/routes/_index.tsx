import { useState } from 'react';
import { useStore } from '@nanostores/react';
import { useSearchParams } from '@remix-run/react';
import { json, type MetaFunction } from '@remix-run/cloudflare';
import { ChatShell } from '~/components/chat/ChatShell';
import { CoralredLandingPage } from '~/components/landing/CoralredLandingPage';
import { authUserStore, authResolvedStore } from '~/lib/stores/auth';

export const meta: MetaFunction = () => {
  return [
    { title: '코랄레드' },
    { name: 'description', content: '코딩 몰라도 한국어 한마디로 웹사이트와 앱을 만들어요' },
  ];
};

export const loader = () => json({});

/**
 * Landing page component for Bolt
 * Note: Settings functionality should ONLY be accessed through the sidebar menu.
 * Do not add settings button/panel to this landing page as it was intentionally removed
 * to keep the UI clean and consistent with the design system.
 */
export default function Index() {
  const authUser = useStore(authUserStore);
  const authResolved = useStore(authResolvedStore);
  const [searchParams] = useSearchParams();

  // 1-3: ?home=1 lets a logged-in visitor preview the landing on purpose (dev/확인용).
  const forceHome = searchParams.get('home') === '1';

  /*
   * Marketing landing (CoralredLandingPage) shows only for a logged-out, first-time visit to
   * this page load — once they click through it stays dismissed for the rest of this page's
   * lifetime. A logged-in visitor never sees it at all (unless ?home=1) — 1-1.
   */
  const [dismissed, setDismissed] = useState(false);

  /*
   * 1-2: authResolvedStore is false for a brief instant on first load, before the session check
   * (now running app-wide from root.tsx) resolves — render a blank cream field, no spinner, no
   * landing flash, until it does.
   */
  if (!authResolved) {
    return <div style={{ width: '100%', height: '100%', minHeight: '100dvh', background: '#FBF5EE' }} />;
  }

  const showMarketingLanding = authUser ? forceHome : !dismissed;

  if (showMarketingLanding) {
    return <CoralredLandingPage onEnter={() => setDismissed(true)} loggedInPreview={!!authUser && forceHome} />;
  }

  return <ChatShell />;
}
