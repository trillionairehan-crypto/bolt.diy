import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { useParams } from '@remix-run/react';
import { workbenchStore } from '~/lib/stores/workbench';
import { authUserStore } from '~/lib/stores/auth';
import { getDeployedApps } from '~/lib/deployedApps';
import { description } from '~/lib/persistence/useChatHistory';
import { createScopedLogger } from '~/utils/logger';
import styles from './ChatHome.module.scss';

const logger = createScopedLogger('CompletionCard');

/*
 * 채팅 화면 재설계 — 항목 2. 첫 미리보기가 렌더 성공한 시점(대화당 1회, Messages.client.tsx가
 * "첫 아티팩트를 가진 메시지"를 계산해 그 메시지 바로 아래에만 이 컴포넌트를 렌더)에 박히는
 * "완성 카드". 미니 브라우저 프레임은 ChatHome.module.scss(홈 화면의 "내가 만든 앱" 카드와
 * 정확히 같은 클래스 — 새로 만들지 않고 재사용)를 그대로 쓴다.
 *
 * 주소줄은 두 신호를 합친다:
 * - 세션 신호(workbenchStore.deployAlert, type:'success'일 때의 url) — 방금 이 세션에서
 *   배포했다면 최신 진실.
 * - 1회성 DB 조회(getDeployedApps, 로그인 사용자만) — 새로고침 후 이미 배포돼 있던 채팅을
 *   다시 열었을 때 주소를 복원한다. 재시도/폴링 없음, 카드 자체는 이 조회를 기다리지 않고
 *   먼저 그려지고 주소줄만 나중에 채워진다. 실패는 조용히 삼키지 않고 로그만 남긴다(사용자에게
 *   에러 문구를 보여주지 않음).
 * - 두 값이 동시에 있으면 세션 신호가 우선(방금 배포한 게 최신).
 */
export function CompletionCard() {
  const appName = useStore(description) || '이름 없는 앱';
  const deployAlert = useStore(workbenchStore.deployAlert);
  const authUser = useStore(authUserStore);
  const { id: urlId } = useParams();

  const [sessionUrl, setSessionUrl] = useState<string | null>(null);
  const [dbUrl, setDbUrl] = useState<string | null>(null);

  useEffect(() => {
    if (deployAlert?.type === 'success' && deployAlert.url) {
      setSessionUrl(deployAlert.url);
    }
  }, [deployAlert]);

  useEffect(() => {
    if (!authUser || !urlId) {
      return undefined;
    }

    let cancelled = false;

    getDeployedApps()
      .then((apps) => {
        if (cancelled) {
          return;
        }

        const match = apps.find((app) => app.chat_id === urlId);

        if (match) {
          setDbUrl(match.url);
        }
      })
      .catch((error) => {
        logger.error('완성 카드 주소 복원 실패 (getDeployedApps)', error);
      });

    return () => {
      cancelled = true;
    };
  }, [authUser, urlId]);

  const url = sessionUrl ?? dbUrl;

  return (
    <a
      href={url ?? undefined}
      target={url ? '_blank' : undefined}
      rel={url ? 'noopener noreferrer' : undefined}
      className={styles.card}
      style={{ maxWidth: 480, ...(url ? undefined : { pointerEvents: 'none' as const }) }}
    >
      <div className={styles.browserFrame}>
        <div className={styles.browserBar}>
          <span className={styles.browserDots}>
            <span className={styles.dot} />
            <span className={styles.dot} />
            <span className={styles.dot} />
          </span>
          <span className={styles.addressBar} style={{ color: url ? '#1A1A1A' : '#7A7067' }}>
            {url ? url.replace(/^https?:\/\//, '') : '배포하면 주소가 생겨요'}
          </span>
        </div>
        <div className={styles.browserContent}>
          <p className={styles.appName}>{appName}</p>
        </div>
      </div>
    </a>
  );
}
