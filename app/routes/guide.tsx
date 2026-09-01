import type { MetaFunction } from '@remix-run/cloudflare';
import { PageShell } from '~/components/ui/PageShell';
import styles from '~/components/guide/GuidePage.module.scss';

export const meta: MetaFunction = () => {
  return [
    { title: '이용 가이드 | 코랄레드' },
    { name: 'description', content: '코랄레드를 처음 쓸 때 궁금한 것들을 모아뒀어요' },
  ];
};

interface GuideArticle {
  slug: string;
  title: string;
  body: React.ReactNode;
}

/*
 * B-4/B-5: 두 항목 다 실제 동작과 어긋난 채로 남아 있었다.
 * - "내 앱 공개하기"는 bolt.diy 원본 문구가 그대로 남아 Netlify/Vercel 연결을 설명했지만, 실제
 *   배포는 Cloudflare Pages 원클릭뿐이고 외부 계정 연결이 없다(DeployButton.tsx/
 *   CloudflareDeploy.client.tsx 확인) — coralred-app-NN.pages.dev 주소, 재배포 시 같은 주소 갱신.
 * - "저장 기능 켜는 법"은 Supabase를 기본처럼 설명했지만, 실제 다이얼로그(SupabaseConnection.tsx)는
 *   "코랄레드로 바로 켜기(추천)"이 기본 선택지이고 "내 Supabase 연결"은 (고급)으로 분리돼 있다.
 */
const ARTICLES: GuideArticle[] = [
  {
    slug: 'storage',
    title: '저장 기능 켜는 법',
    body: (
      <>
        <p className={styles.paragraph}>
          로그인이나 게시판처럼 정보를 남기는 기능을 쓰려면 저장 기능을 켜야 해요. 작업 화면 위쪽의 "저장 기능 켜기"
          버튼을 누르면 시작할 수 있어요.
        </p>
        <p className={styles.paragraph}>
          기본은 코랄레드 Cloud예요. "코랄레드로 바로 켜기"를 선택하면 가입도 키 복사도 없이 바로 켜지고, 곧바로
          로그인·데이터 저장이 필요한 요청에 쓰여요.
        </p>
        <p className={styles.paragraph}>
          직접 만든 Supabase 프로젝트를 쓰고 싶다면 "내 Supabase 연결(고급)"을 선택하면 돼요. 데이터가 계속 남고, 여러
          기기에서 로그인하는 구조도 만들 수 있어요.
        </p>
        <p className={styles.paragraph}>
          연결을 끊고 싶으면 같은 버튼을 눌러 연결 관리 화면에서 "연결 끊기"를 누르면 돼요.
        </p>
      </>
    ),
  },
  {
    slug: 'publish',
    title: '내 앱 공개하기',
    body: (
      <>
        <p className={styles.paragraph}>
          만든 앱을 실제 주소로 다른 사람에게 보여주고 싶다면 작업 화면 위쪽의 "배포하기" 버튼을 눌러요.
        </p>
        <p className={styles.paragraph}>
          Cloudflare Pages로 원클릭 배포돼요. 외부 서비스에 새로 가입하거나 계정을 연결할 필요가 없어요.
        </p>
        <p className={styles.paragraph}>
          "배포하기"를 처음 누르면 coralred-app-12.pages.dev 같은 주소가 생겨요. 이후 같은 대화에서 다시 누르면 같은
          주소로 최신 버전이 업데이트돼요.
        </p>
      </>
    ),
  },
  {
    slug: 'messages',
    title: '메시지가 뭔가요',
    body: (
      <>
        <p className={styles.paragraph}>
          메시지는 채팅으로 보내는 요청 1건을 말해요. "로그인 화면 만들어줘" 처럼 새로 요청할 때마다 1건씩 줄어들어요.
        </p>
        <p className={styles.paragraph}>
          AI가 미리보기에서 오류를 스스로 발견하고 고치는 자동 수정은 메시지 횟수에서 차감되지 않아요. 마음 편하게
          만들어보셔도 돼요.
        </p>
        <p className={styles.paragraph}>
          유료 플랜은 그 달 다 쓰지 못한 메시지가 다음 달로 이월돼요. 다만 무한정 쌓이진 않고, 월 할당량의 최대
          2배까지만 누적돼요.
        </p>
      </>
    ),
  },
  {
    slug: 'plans',
    title: '요금제 안내',
    body: (
      <>
        <p className={styles.paragraph}>
          코랄레드는 무료로 시작해서 필요할 때 요금제를 올리는 구조예요. 플랜마다 한 달에 쓸 수 있는 메시지 수가 다르고,
          Pro 이상은 코랄레드 표시를 없애고 브랜드 색상도 직접 지정할 수 있어요.
        </p>
        <p className={styles.paragraph}>
          정확한 가격과 플랜별 차이는{' '}
          <a href="/pricing" className={styles.link}>
            요금제 페이지
          </a>
          에서 확인할 수 있어요.
        </p>
      </>
    ),
  },
  {
    slug: 'where-are-my-apps',
    title: '만든 앱은 어디서 봐요?',
    body: (
      <p className={styles.paragraph}>
        사이드바의 대화 목록, 채팅 홈의 "내가 만든 앱" 섹션, 그리고{' '}
        <a href="/apps" className={styles.link}>
          내가 만든 앱 페이지
        </a>
        에서 한눈에 확인할 수 있어요.
      </p>
    ),
  },
  {
    slug: 'data-retention',
    title: '데이터는 얼마나 보관돼요?',
    body: (
      <p className={styles.paragraph}>
        배포하지 않은 앱은 만든 날로부터 7일 동안 보관돼요. 배포한 앱은 배포일로부터 30일 동안 보관되고, 다시 배포할
        때마다 그 시점으로부터 30일이 다시 적용돼요.
      </p>
    ),
  },
  {
    slug: 'kakao-login',
    title: '카카오 로그인을 붙이고 싶어요',
    body: <p className={styles.paragraph}>준비 중이며 곧 가이드가 추가돼요.</p>,
  },
];

export default function Guide() {
  return (
    <PageShell headline="이용 가이드" subheadline="처음 쓸 때 자주 궁금해하는 것들을 모아뒀어요">
      <div className={styles.articleList}>
        {ARTICLES.map((article) => (
          <div key={article.slug} id={article.slug}>
            <h2 className={styles.articleTitle}>{article.title}</h2>
            <div className={styles.articleBody}>{article.body}</div>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
