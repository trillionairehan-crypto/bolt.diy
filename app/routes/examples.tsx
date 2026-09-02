import type { MetaFunction } from '@remix-run/cloudflare';
import { useEffect, useState } from 'react';
import Cookies from 'js-cookie';
import { PageShell } from '~/components/ui/PageShell';
import { SkeletonShowcaseCard } from '~/components/landing/SkeletonShowcaseCard';
import { SHOWCASE_APPS } from '~/components/landing/showcaseApps';
import { EXAMPLE_PROMPT_FILL_KEY, CORALRED_NEW_METERING } from '~/utils/constants';
import { hasGenerationsRemaining, hasV2GenerationsRemaining } from '~/lib/freeTrial';
import styles from '~/components/examples/ExamplesPage.module.scss';

export const meta: MetaFunction = () => {
  return [
    { title: '예시로 시작하기 | 코랄레드' },
    { name: 'description', content: '골라서 누르면 바로 만들기 시작해요' },
  ];
};

const QUOTA_EXHAUSTED_LABEL = '이번 달 메시지를 다 쓰셨어요';

/*
 * 카드(또는 호버 버튼)를 누르면 채팅 홈으로 이동해 그 프롬프트를 바로 전송한다 — 채워 넣기만
 * 하고 끝내면 카드에서 본 결과물을 기대한 사용자가 허탈해한다는 피드백으로 바뀜. 실제 전송은
 * Chat.client.tsx가 마운트 시 EXAMPLE_PROMPT_FILL_KEY(1회성)를 읽어 sendMessage를 그대로 호출하는
 * 경로라, 메시지 1건 차감·온보딩 설문 모두 평소 흐름 그대로 탄다. 다른 페이지의 다른 링크들
 * (PageShell의 "← 채팅으로" 등)과 마찬가지로 일반 네비게이션을 쓴다 — 쿠키를 먼저 심어야 해서
 * 순수 <a href>는 못 쓰고 onClick에서 직접 이동시킨다.
 */
function handleCardClick(prompt: string) {
  Cookies.set(EXAMPLE_PROMPT_FILL_KEY, prompt, { expires: 1 });
  window.location.href = '/';
}

export default function Examples() {
  // null = 아직 확인 중 — 확인 전엔 카드가 눌려도 잘못된 상태로 이동하지 않게 클릭을 비활성 상태로 둔다.
  const [hasQuota, setHasQuota] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    const check = CORALRED_NEW_METERING ? hasV2GenerationsRemaining() : hasGenerationsRemaining();

    check
      .then((remaining) => {
        if (!cancelled) {
          setHasQuota(remaining);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHasQuota(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PageShell headline="예시로 시작하기" subheadline="골라서 누르면 바로 만들기 시작해요">
      <div className={styles.grid}>
        {SHOWCASE_APPS.map((app) => (
          <SkeletonShowcaseCard
            key={app.name}
            app={app}
            onClick={hasQuota ? () => handleCardClick(app.prompt) : undefined}
            hoverLabel={hasQuota === null ? undefined : hasQuota ? '이 앱 만들기' : QUOTA_EXHAUSTED_LABEL}
          />
        ))}
      </div>
    </PageShell>
  );
}
