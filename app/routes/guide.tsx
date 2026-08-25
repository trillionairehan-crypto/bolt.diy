import type { LinksFunction, MetaFunction } from '@remix-run/cloudflare';
import { Logo } from '~/components/ui/Logo';
import coralredUiCssUrl from '~design-handoff/coralred-ui.css?url';

export const links: LinksFunction = () => [{ rel: 'stylesheet', href: coralredUiCssUrl }];

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

const ARTICLES: GuideArticle[] = [
  {
    slug: 'storage',
    title: '저장 기능 켜는 법',
    body: (
      <>
        <p className="cr-body">
          로그인이나 게시판처럼 정보를 남기는 기능을 쓰려면 저장 기능을 켜야 해요. 작업 화면 위쪽의 "저장 기능 켜기"
          버튼을 누르면 시작할 수 있어요.
        </p>
        <p className="cr-body">
          Supabase 계정으로 연결해요. 계정이 없다면 버튼을 누른 뒤 뜨는 안내를 따라 액세스 토큰을 발급받아 붙여넣으면
          돼요. 연결이 끝나면 프로젝트를 선택하거나 새로 만들 수 있고, 그 뒤부터는 로그인·데이터 저장이 필요한 요청을 할
          때 자동으로 이 저장 공간을 써요.
        </p>
        <p className="cr-body">연결을 끊고 싶으면 같은 버튼을 눌러 연결 관리 화면에서 "연결 끊기"를 누르면 돼요.</p>
      </>
    ),
  },
  {
    slug: 'publish',
    title: '내 앱 공개하기',
    body: (
      <>
        <p className="cr-body">
          만든 앱을 실제 주소로 다른 사람에게 보여주고 싶다면 작업 화면 위쪽의 "배포하기" 버튼을 눌러요.
        </p>
        <p className="cr-body">
          지금은 Netlify나 Vercel 같은 외부 서비스에 연결해서 공개하는 방식이에요. 계정이 없다면 버튼을 누른 뒤 안내를
          따라 새로 만들면 되고, 한 번 연결해두면 다음부터는 버튼 한 번으로 최신 버전을 다시 올릴 수 있어요.
        </p>
        <p className="cr-body">
          공개된 앱은 연결한 서비스가 만들어주는 주소로 접속할 수 있어요. 나만의 도메인을 쓰고 싶다면 해당 서비스의
          도메인 연결 설정에서 추가하면 돼요.
        </p>
      </>
    ),
  },
  {
    slug: 'messages',
    title: '메시지가 뭔가요',
    body: (
      <>
        <p className="cr-body">
          메시지는 채팅으로 보내는 요청 1건을 말해요. "로그인 화면 만들어줘" 처럼 새로 요청할 때마다 1건씩 줄어들어요.
        </p>
        <p className="cr-body">
          AI가 미리보기에서 오류를 스스로 발견하고 고치는 자동 수정은 메시지 횟수에서 차감되지 않아요. 마음 편하게
          만들어보셔도 돼요.
        </p>
        <p className="cr-body">
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
        <p className="cr-body">
          코랄레드는 무료로 시작해서 필요할 때 요금제를 올리는 구조예요. 플랜마다 한 달에 쓸 수 있는 메시지 수가 다르고,
          Pro 이상은 코랄레드 표시를 없애고 브랜드 색상도 직접 지정할 수 있어요.
        </p>
        <p className="cr-body">
          정확한 가격과 플랜별 차이는{' '}
          <a href="/pricing" className="cr-mono">
            요금제 페이지
          </a>
          에서 확인할 수 있어요.
        </p>
      </>
    ),
  },
];

export default function Guide() {
  return (
    <div className="cr-page" style={{ paddingTop: 24, paddingBottom: 48 }}>
      <a href="/" className="cr-row-8" style={{ width: 'fit-content' }}>
        <Logo height={24} />
      </a>

      <section className="cr-section cr-stack-16" style={{ paddingBottom: 32 }}>
        <span className="cr-eyebrow">GUIDE</span>
        <h1 className="cr-display">이용 가이드</h1>
        <p className="cr-body">처음 쓸 때 자주 궁금해하는 것들을 모아뒀어요.</p>
      </section>

      <section className="cr-stack-24">
        {ARTICLES.map((article) => (
          <div key={article.slug} id={article.slug} className="cr-card cr-stack-16">
            <h2 className="cr-h1">{article.title}</h2>
            <div className="cr-stack-16" style={{ lineHeight: 1.7 }}>
              {article.body}
            </div>
          </div>
        ))}
      </section>

      <footer className="cr-stack-8" style={{ borderTop: '1px solid var(--border)', paddingTop: 24, marginTop: 48 }}>
        <p className="cr-caption">코랄레드 · 대표자 한성민 · 사업자등록번호 383-23-02498</p>
        <p className="cr-caption">경기도 여주시 가남읍 심석2길 50-6 · coralred.kr</p>
        <p className="cr-caption">
          <a href="mailto:coralred@coralred.kr" className="cr-mono">
            coralred@coralred.kr
          </a>{' '}
          ·{' '}
          <a href="/terms" className="cr-mono">
            이용약관
          </a>{' '}
          ·{' '}
          <a href="/privacy" className="cr-mono">
            개인정보처리방침
          </a>
        </p>
      </footer>
    </div>
  );
}
