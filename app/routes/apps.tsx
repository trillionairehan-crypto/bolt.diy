import type { MetaFunction } from '@remix-run/cloudflare';
import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { Logo } from '~/components/ui/Logo';
import { authUserStore } from '~/lib/stores/auth';
import { getDeployedApps, type DeployedAppRecord } from '~/lib/deployedApps';
import styles from '~/components/apps/AppsPage.module.scss';

export const meta: MetaFunction = () => {
  return [{ title: '내가 만든 앱 | 코랄레드' }, { name: 'description', content: '배포한 앱을 한곳에서 확인해요' }];
};

const PROVIDER_LABEL: Record<string, string> = {
  netlify: 'Netlify',
  vercel: 'Vercel',
  cloudflare: 'Cloudflare Pages',
};

const STORAGE_MODE_LABEL: Record<DeployedAppRecord['storage_mode'], string> = {
  sample: '샘플 데이터',
  cloud: '코랄레드 저장',
  supabase: '내 Supabase 연결',
};

/** "9월 1일 오전 1:30" — 연도 없이 월/일 + 시:분(오전/오후)만. */
function formatDeployedAt(iso: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso));
}

const EXPIRY_WARNING_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

function expiresSoon(storageExpiresAt: string | null): boolean {
  if (!storageExpiresAt) {
    return false;
  }

  const msRemaining = new Date(storageExpiresAt).getTime() - Date.now();

  return msRemaining > 0 && msRemaining <= EXPIRY_WARNING_WINDOW_MS;
}

function formatExpiresAt(iso: string): string {
  return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' }).format(new Date(iso));
}

function AppCard({ app }: { app: DeployedAppRecord }) {
  const providerLabel = PROVIDER_LABEL[app.provider] ?? app.provider;
  const isCloudflare = app.provider === 'cloudflare';

  return (
    <div className={styles.card}>
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

      <div className={styles.metaRow}>
        <p className={styles.deployedMeta}>
          {formatDeployedAt(app.deployed_at)} 배포 · {providerLabel}
        </p>
        <span className={styles.badge}>
          <span className={styles.badgeDot} />
          {STORAGE_MODE_LABEL[app.storage_mode]}
        </span>
      </div>

      {expiresSoon(app.storage_expires_at) && (
        <p className={styles.expiryWarning}>{formatExpiresAt(app.storage_expires_at as string)}에 데이터가 정리돼요</p>
      )}

      <a href={app.url} target="_blank" rel="noreferrer" className={styles.addressLink}>
        <span>{app.url}</span>
        <div className="i-ph:arrow-square-out" />
      </a>

      <a href={`/chat/${app.chat_id}`} className={styles.redeployBtn}>
        {isCloudflare ? '다시 배포하기' : '채팅으로 돌아가기'}
      </a>
    </div>
  );
}

export default function Apps() {
  const authUser = useStore(authUserStore);
  const [apps, setApps] = useState<DeployedAppRecord[] | null>(null);

  useEffect(() => {
    if (!authUser) {
      setApps(null);
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

  return (
    <div className={styles.page}>
      <div className={styles.topRow}>
        <a href="/" className={styles.logoLink}>
          <Logo height={24} showWordmark={false} />
        </a>
        <a href="/" className={styles.backLink}>
          ← 채팅으로
        </a>
      </div>

      <div className={styles.header}>
        <h1 className={styles.headline}>내가 만든 앱</h1>
        <p className={styles.subheadline}>배포한 앱을 한곳에서 확인해요</p>
      </div>

      {!authUser && (
        <div className={styles.loginPrompt}>
          <p className={styles.loginText}>로그인하면 배포한 앱을 여기서 확인할 수 있어요.</p>
          <a href="/login" className={styles.redeployBtn}>
            로그인
          </a>
        </div>
      )}

      {authUser && apps === null && <p className={styles.loadingText}>불러오는 중...</p>}

      {authUser && apps !== null && apps.length === 0 && (
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>아직 배포한 앱이 없어요</p>
          <a href="/" className={styles.primaryBtn}>
            첫 앱 만들기
          </a>
        </div>
      )}

      {authUser && apps !== null && apps.length > 0 && (
        <div className={styles.grid}>
          {apps.map((app) => (
            <AppCard key={app.id} app={app} />
          ))}
        </div>
      )}
    </div>
  );
}
