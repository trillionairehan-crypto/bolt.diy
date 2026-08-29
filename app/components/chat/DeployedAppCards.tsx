import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { authUserStore } from '~/lib/stores/auth';
import { getDeployedApps, type DeployedAppRecord } from '~/lib/deployedApps';
import styles from './ChatHome.module.scss';

function formatDeployedAt(iso: string): string {
  return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' }).format(new Date(iso));
}

/**
 * Home-screen "내가 만든 앱" cards — same mini-browser-frame shape as the landing page's showcase
 * (dots + address bar), reusing the real deployed-apps data source the /apps route already uses
 * (app/lib/deployedApps.ts). Nothing rendered at all when there's nothing deployed yet — no empty
 * state copy, per the request.
 */
export function DeployedAppCards() {
  const authUser = useStore(authUserStore);
  const [apps, setApps] = useState<DeployedAppRecord[]>([]);

  useEffect(() => {
    if (!authUser) {
      setApps([]);
      return undefined;
    }

    let cancelled = false;

    getDeployedApps().then((records) => {
      if (!cancelled) {
        setApps(records);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [authUser]);

  if (apps.length === 0) {
    return null;
  }

  const recent = apps.slice(0, 4);

  return (
    <>
      <div className={styles.cardsWrap}>
        {recent.map((app) => (
          <a key={app.id} href={`/chat/${app.chat_id}`} className={styles.card}>
            <div className={styles.browserFrame}>
              <div className={styles.browserBar}>
                <span className={styles.browserDots}>
                  <span className={styles.dot} />
                  <span className={styles.dot} />
                  <span className={styles.dot} />
                </span>
                <span className={styles.addressBar}>{app.url.replace(/^https?:\/\//, '')}</span>
              </div>
              <div className={styles.browserContent}>
                <p className={styles.appName}>{app.app_name}</p>
                <p className={styles.deployedAt}>{formatDeployedAt(app.deployed_at)} 배포</p>
              </div>
            </div>
          </a>
        ))}
      </div>
      <div className={styles.viewAllRow}>
        <a href="/apps" className={styles.viewAllLink}>
          전체 보기
        </a>
      </div>
    </>
  );
}
