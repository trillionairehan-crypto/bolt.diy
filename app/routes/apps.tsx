import type { LinksFunction, MetaFunction } from '@remix-run/cloudflare';
import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { Logo } from '~/components/ui/Logo';
import { authUserStore } from '~/lib/stores/auth';
import { getDeployedApps, type DeployedAppRecord } from '~/lib/deployedApps';
import { CustomDomainConnect } from '~/components/deploy/CustomDomainConnect';
import coralredUiCssUrl from '~design-handoff/coralred-ui.css?url';

export const links: LinksFunction = () => [{ rel: 'stylesheet', href: coralredUiCssUrl }];

export const meta: MetaFunction = () => {
  return [{ title: '내 앱 | 코랄레드' }, { name: 'description', content: '배포한 앱을 한곳에서 확인해요' }];
};

const PROVIDER_LABEL: Record<string, string> = {
  netlify: 'Netlify',
  vercel: 'Vercel',
  cloudflare: 'Cloudflare Pages',
};

function formatDeployedAt(iso: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso));
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
    <div className="cr-page" style={{ paddingTop: 24, paddingBottom: 48 }}>
      <a href="/" className="cr-row-8" style={{ width: 'fit-content' }}>
        <Logo height={24} />
      </a>

      <section className="cr-section cr-stack-16" style={{ paddingBottom: 32 }}>
        <span className="cr-eyebrow">MY APPS</span>
        <h1 className="cr-display">내 앱</h1>
        <p className="cr-body">배포한 앱을 한곳에서 확인해요.</p>
      </section>

      {!authUser && (
        <section className="cr-card cr-stack-16" style={{ maxWidth: 420 }}>
          <p className="cr-body">로그인하면 배포한 앱을 여기서 확인할 수 있어요.</p>
          <a href="/login" className="cr-btn" style={{ width: 'fit-content' }}>
            로그인
          </a>
        </section>
      )}

      {authUser && apps === null && <p className="cr-caption">불러오는 중...</p>}

      {authUser && apps !== null && apps.length === 0 && (
        <section className="cr-card cr-stack-8" style={{ maxWidth: 420 }}>
          <p className="cr-body">다음 배포부터 여기 쌓여요.</p>
          <p className="cr-caption">작업 화면 위쪽의 "배포하기" 버튼으로 앱을 공개하면 여기에 나타나요.</p>
        </section>
      )}

      {authUser && apps !== null && apps.length > 0 && (
        <section className="cr-stack-16">
          {apps.map((app) => (
            <div key={app.id} className="cr-stack-8">
              <div className="cr-card cr-row-16" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <div className="cr-stack-8" style={{ minWidth: 0 }}>
                  <div className="cr-row-8">
                    <h2 className="cr-h2">{app.app_name}</h2>
                    <span className="cr-badge">{PROVIDER_LABEL[app.provider] ?? app.provider}</span>
                  </div>
                  <a href={app.url} target="_blank" rel="noreferrer" className="cr-mono">
                    {app.url}
                  </a>
                  <p className="cr-caption">{formatDeployedAt(app.deployed_at)}에 배포됨</p>
                  {app.provider === 'cloudflare' && (
                    <p className="cr-caption">채팅에서 배포하기를 다시 누르면 같은 주소로 업데이트돼요.</p>
                  )}
                </div>
                <a href={`/chat/${app.chat_id}`} className="cr-btn outline" style={{ flexShrink: 0 }}>
                  {app.provider === 'cloudflare' ? '다시 배포하기' : '채팅으로 돌아가기'}
                </a>
              </div>

              {app.provider === 'cloudflare' && app.project_name && (
                <CustomDomainConnect projectName={app.project_name} />
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
