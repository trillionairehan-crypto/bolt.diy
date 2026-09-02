import type { MetaFunction } from '@remix-run/cloudflare';
import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { PageShell } from '~/components/ui/PageShell';
import { MiniBrowserFrame } from '~/components/ui/MiniBrowserFrame';
import { classNames } from '~/utils/classNames';
import { authUserStore } from '~/lib/stores/auth';
import { getDeployedApps, type DeployedAppRecord } from '~/lib/deployedApps';
import { db, getAll, type ChatHistoryItem } from '~/lib/persistence';
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

function BuildingCard({ item }: { item: ChatHistoryItem }) {
  return (
    <a href={`/chat/${item.urlId}`} className={styles.buildingCard}>
      <MiniBrowserFrame
        size="compact"
        url=""
        title={item.description || '이름 없는 앱'}
        addressOverride="배포하면 주소가 생겨요"
      />
    </a>
  );
}

type AppsTab = 'deployed' | 'building';

export default function Apps() {
  const authUser = useStore(authUserStore);
  const [activeTab, setActiveTab] = useState<AppsTab>('deployed');
  const [apps, setApps] = useState<DeployedAppRecord[] | null>(null);
  const [buildingChats, setBuildingChats] = useState<ChatHistoryItem[] | null>(null);

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

  /*
   * 4-3: "만드는 중" = deployed_apps에 chat_id가 없는 IndexedDB 대화 전부 — apps(배포됨 목록)가
   * 먼저 로드돼야 그 chat_id Set으로 제외할 수 있어서 apps에도 의존한다. 앱 그룹(포크) 대표만
   * 추리는 사이드바 "최근 작업"과 달리 여기는 스펙이 명시한 대로 전부 나열한다(중복 제거 없음).
   */
  useEffect(() => {
    if (!authUser || apps === null) {
      setBuildingChats(null);
      return undefined;
    }

    if (!db) {
      setBuildingChats([]);
      return undefined;
    }

    let cancelled = false;
    const deployedChatIds = new Set(apps.map((app) => app.chat_id));

    getAll(db)
      .then((list) =>
        list
          .filter((item) => item.urlId && item.description && !deployedChatIds.has(item.urlId))
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
      )
      .then((list) => {
        if (!cancelled) {
          setBuildingChats(list);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authUser, apps]);

  return (
    <PageShell headline="내가 만든 앱" subheadline="배포한 앱을 한곳에서 확인해요">
      {!authUser && (
        <div className={styles.loginPrompt}>
          <p className={styles.loginText}>로그인하면 배포한 앱을 여기서 확인할 수 있어요.</p>
          <a href="/login" className={styles.redeployBtn}>
            로그인
          </a>
        </div>
      )}

      {authUser && (
        <>
          <div className={styles.tabRow}>
            <button
              type="button"
              className={classNames(styles.tab, { [styles.tabActive]: activeTab === 'deployed' })}
              onClick={() => setActiveTab('deployed')}
            >
              배포됨
            </button>
            <button
              type="button"
              className={classNames(styles.tab, { [styles.tabActive]: activeTab === 'building' })}
              onClick={() => setActiveTab('building')}
            >
              만드는 중
            </button>
          </div>

          {activeTab === 'deployed' && (
            <>
              {apps === null && <p className={styles.loadingText}>불러오는 중...</p>}

              {apps !== null && apps.length === 0 && (
                <div className={styles.emptyState}>
                  <p className={styles.emptyText}>아직 배포한 앱이 없어요</p>
                  <a href="/" className={styles.primaryBtn}>
                    첫 앱 만들기
                  </a>
                </div>
              )}

              {apps !== null && apps.length > 0 && (
                <div className={styles.grid}>
                  {apps.map((app) => (
                    <AppCard key={app.id} app={app} />
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === 'building' && (
            <>
              {buildingChats === null && <p className={styles.loadingText}>불러오는 중...</p>}

              {buildingChats !== null && buildingChats.length === 0 && (
                <div className={styles.emptyState}>
                  <p className={styles.emptyText}>만들던 앱이 없어요</p>
                </div>
              )}

              {buildingChats !== null && buildingChats.length > 0 && (
                <div className={styles.grid}>
                  {buildingChats.map((item) => (
                    <BuildingCard key={item.id} item={item} />
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </PageShell>
  );
}
