/* src/App.tsx — coralred.kr 프로덕션 3차 생성(도자기 공방, 2026-09-13) */
import {
  useSmoothScroll,
  Preloader,
  Cursor,
  Nav,
  SceneNav,
  HeroScene,
  TextReveal,
  PinnedChapters,
  Showcase3D,
  Marquee,
  Contact,
  type PinnedChapter,
  type ContactRow,
} from './kit';

const HERO_IMAGE = 'https://pub-b08f99b5ccf040e4b6b0293f2d95f744.r2.dev/media/jmtzok8ix-34871df51785/hero.jpg?v=1789295919994';
const HERO_VIDEO = 'https://pub-b08f99b5ccf040e4b6b0293f2d95f744.r2.dev/media/jmtzok8ix-34871df51785/hero-seedance.mp4';
const CH1_IMAGE = 'https://pub-b08f99b5ccf040e4b6b0293f2d95f744.r2.dev/media/jmtzok8ix-34871df51785/ch1.jpg?v=1789295919994';
const CH2_IMAGE = 'https://pub-b08f99b5ccf040e4b6b0293f2d95f744.r2.dev/media/jmtzok8ix-34871df51785/ch2.jpg?v=1789295919994';
const CH3_IMAGE = 'https://pub-b08f99b5ccf040e4b6b0293f2d95f744.r2.dev/media/jmtzok8ix-34871df51785/ch3.jpg?v=1789295919994';

const NAV_LINKS = [
  { label: '작업 이야기', href: '#chapters' },
  { label: '대표 작품', href: '#showcase' },
  { label: '문의하기', href: '#contact' },
];

const CHAPTERS: PinnedChapter[] = [
  {
    eyebrow: '01 · 흙을 빚는 시간',
    title: '손끝에서 시작하는 형태',
    body: '물레 위에서 흙이 둥글게 자리를 잡는 순간부터 가온도자의 하루가 시작돼요.',
    image: CH1_IMAGE,
    treatment: 'grain',
  },
  {
    eyebrow: '02 · 유약과 불의 시간',
    title: '가마 안에서 완성되는 색',
    body: '초벌을 마친 그릇에 유약을 입히고 1250도 가마에 굽는 순간, 흙은 비로소 도자기가 돼요.',
    image: CH2_IMAGE,
    treatment: 'mono',
  },
  {
    eyebrow: '03 · 식탁 위의 시간',
    title: '일상에 스며드는 그릇',
    body: '가온도자의 그릇은 진열장이 아니라 매일의 식탁에 오르길 바라며 만들어요.',
    image: CH3_IMAGE,
    treatment: 'none',
  },
];

const SHOWCASE_SPECS = [
  { label: '형태', value: '달항아리형' },
  { label: '흙', value: '고령토 백자토' },
  { label: '굽는 온도', value: '1250℃ 환원소성' },
  { label: '크기', value: '지름 24cm · 높이 22cm' },
];

const CONTACT_ROWS: ContactRow[] = [
  { label: '위치', value: '경기 광주시 도자로 118' },
  { label: '전화', value: '031-765-2280' },
  { label: '카카오톡', value: '@가온도자' },
  { label: '운영 시간', value: '화~일 11:00 - 18:00 (월요일 휴무)' },
];

const MARQUEE_ITEMS = ['가온도자', '손으로 빚은 그릇', '가온도자', '오늘의 식탁', '가온도자', '흙과 불의 시간'];

function App() {
  useSmoothScroll({ snap: true });

  return (
    <div className="ck-page ck-type-serif">
      <Preloader brand="가온도자" />
      <Cursor />
      <Nav brand="가온도자" links={NAV_LINKS} cta={{ label: '문의하기', href: '#contact' }} />
      <SceneNav />

      <HeroScene
        image={HERO_IMAGE}
        video={HERO_VIDEO}
        eyebrow="가온도자 · GAON CERAMICS"
        title="흙에서 그릇으로, 온기가 머무는 시간"
        sub="경기도 광주 도자기 마을에서 물레를 돌리고 가마를 지피며, 매일의 식탁에 어울리는 그릇을 빚어요."
        cta={{ label: '작업 이야기 보기', href: '#chapters' }}
        secondaryCta={{ label: '방문 문의', href: '#contact' }}
        overlay={0.45}
      />

      <section style={{ padding: 'var(--ck-gutter)', paddingBlock: 'clamp(80px, 14vh, 160px)' }}>
        <TextReveal as="h2" className="ck-display ck-display--statement" mode="word" scrub emphasize={[3, 4]}>
          그릇 하나에도 굽는 사람의 손과 시간이 그대로 담겨요
        </TextReveal>
      </section>

      <div id="chapters">
        <PinnedChapters chapters={CHAPTERS} />
      </div>

      <div id="showcase">
        <Showcase3D
          shape="jar"
          eyebrow="대표 작품"
          title="달항아리"
          description="가온도자를 대표하는 형태예요."
          specs={SHOWCASE_SPECS}
          poster={HERO_IMAGE}
        />
      </div>

      <Marquee items={MARQUEE_ITEMS} />

      <div id="contact">
        <Contact
          eyebrow="찾아오시는 길"
          title="가온도자에 놀러오세요"
          description="공방은 예약 없이도 둘러보실 수 있어요."
          rows={CONTACT_ROWS}
          cta={{ label: '카카오톡으로 문의하기', href: 'https://pf.kakao.com/_gaonceramics' }}
        />
      </div>
    </div>
  );
}

export default App;
