import type { MetaFunction } from '@remix-run/cloudflare';
import Cookies from 'js-cookie';
import { PageShell } from '~/components/ui/PageShell';
import { SkeletonShowcaseCard } from '~/components/landing/SkeletonShowcaseCard';
import { SHOWCASE_APPS } from '~/components/landing/showcaseApps';
import { EXAMPLE_PROMPT_FILL_KEY } from '~/utils/constants';
import styles from '~/components/examples/ExamplesPage.module.scss';

export const meta: MetaFunction = () => {
  return [
    { title: '예시로 시작하기 | 코랄레드' },
    { name: 'description', content: '골라서 누르면 바로 만들기 시작해요' },
  ];
};

/*
 * 카드를 누르면 채팅 홈으로 이동해 입력창에 프롬프트를 채워 넣는다(전송은 하지 않음) — 온보딩
 * 설문은 유저가 실제로 전송할 때 기존 흐름대로 뜬다. EXAMPLE_PROMPT_FILL_KEY는 Chat.client.tsx가
 * 마운트 시 한 번만 읽고 바로 지우는 1회성 값이라, 새로고침해도 다시 채워지지 않는다. 다른
 * 페이지의 다른 링크들(PageShell의 "← 채팅으로" 등)과 마찬가지로 일반 네비게이션을 쓴다 — 쿠키를
 * 먼저 심어야 해서 순수 <a href>는 못 쓰고 onClick에서 직접 이동시킨다.
 */
function handleCardClick(prompt: string) {
  Cookies.set(EXAMPLE_PROMPT_FILL_KEY, prompt, { expires: 1 });
  window.location.href = '/';
}

export default function Examples() {
  return (
    <PageShell headline="예시로 시작하기" subheadline="골라서 누르면 바로 만들기 시작해요">
      <div className={styles.grid}>
        {SHOWCASE_APPS.map((app) => (
          <SkeletonShowcaseCard key={app.name} app={app} onClick={() => handleCardClick(app.prompt)} />
        ))}
      </div>
    </PageShell>
  );
}
