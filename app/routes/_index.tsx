import { useState } from 'react';
import { useStore } from '@nanostores/react';
import { json, type MetaFunction } from '@remix-run/cloudflare';
import { ChatShell } from '~/components/chat/ChatShell';
import { CoralredLandingPage } from '~/components/landing/CoralredLandingPage';
import { authUserStore } from '~/lib/stores/auth';

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

  /*
   * Marketing landing (CoralredLandingPage) shows only for a logged-out, first-time visit to
   * this page load — once they click through (or once auth resolves to a real user) it stays
   * dismissed for the rest of this page's lifetime. Both sides start from the same nanostore
   * initial value (null before the session check resolves), so there's no SSR/hydration
   * mismatch from gating on authUser here.
   */
  const [dismissed, setDismissed] = useState(false);
  const showMarketingLanding = !authUser && !dismissed;

  if (showMarketingLanding) {
    return <CoralredLandingPage onEnter={() => setDismissed(true)} />;
  }

  return <ChatShell />;
}
