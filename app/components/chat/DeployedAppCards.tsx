import type { DeployedAppRecord } from '~/lib/deployedApps';
import { formatRelativeTime } from '~/utils/relativeTime';
import styles from './ChatHome.module.scss';

interface DeployedAppCardsProps {
  apps: DeployedAppRecord[];
}

/**
 * Home-screen "내가 만든 앱" cards — same mini-browser-frame shape as the landing page's showcase
 * (dots + address bar). Data comes from useChatHomeSections.ts (shared with RecentChatsCards for
 * the dedup rule) instead of fetching independently. Nothing rendered at all when there's nothing
 * deployed yet — no empty state copy, per the request.
 */
export function DeployedAppCards({ apps }: DeployedAppCardsProps) {
  if (apps.length === 0) {
    return null;
  }

  return (
    <div className={styles.section}>
      <p className={styles.sectionTitle}>내가 만든 앱</p>
      <div className={styles.cardsWrap}>
        {apps.map((app) => (
          <a key={app.id} href={app.url} target="_blank" rel="noopener noreferrer" className={styles.card}>
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
              </div>
            </div>
            <p className={styles.deployedAt}>{formatRelativeTime(app.deployed_at)} 배포</p>
          </a>
        ))}
      </div>
      <div className={styles.viewAllRow}>
        <a href="/apps" className={styles.viewAllLink}>
          전체 보기
        </a>
      </div>
    </div>
  );
}
