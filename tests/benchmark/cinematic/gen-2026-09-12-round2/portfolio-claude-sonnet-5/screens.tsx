/* src/App.jsx */
import {
  HeroScene,
  PinnedChapters,
  TextReveal,
  Showcase3D,
  BigNumber,
  Marquee,
  Contact,
  Nav,
  Preloader,
  Cursor,
  SceneNav,
  useSmoothScroll,
} from './kit';

const PHOTO = 'https://pub-b08f99b5ccf040e4b6b0293f2d95f744.r2.dev/media/showroom/photo-editorial/still-mtwykpyk-1.jpg';
const HERO_VIDEO = 'https://pub-b08f99b5ccf040e4b6b0293f2d95f744.r2.dev/media/showroom/photo-editorial/hero-loop.mp4';

function App() {
  useSmoothScroll({ snap: true });

  return (
    <>
      <Preloader brand="이든 스튜디오" />
      <Cursor />
      <Nav
        brand="이든 스튜디오"
        links={[
          { label: '작업물', href: '#story' },
          { label: '소개', href: '#about' },
          { label: '연락처', href: '#contact' },
        ]}
        cta={{ label: '문의하기', href: '#contact' }}
      />
      <SceneNav />

      <HeroScene
        image={PHOTO}
        video={HERO_VIDEO}
        eyebrow="PHOTOGRAPHER"
        title="빛이 머무는 순간을 담아요"
        sub="인물, 공간, 브랜드의 결을 오래 남는 사진으로 기록합니다"
        cta={{ label: '작업물 보기', href: '#story' }}
        overlay={0.45}
      />

      <TextReveal
        as="h2"
        className="ck-display ck-display--statement"
        text="사진은 순간을 멈추는 일이 아니라 그 순간의 온도를 기억하는 일이라고 생각해요"
        emphasize={[8, 9]}
      />

      <PinnedChapters
        id="story"
        startIndex={2}
        chapters={[
          {
            image: PHOTO,
            eyebrow: 'EDITORIAL',
            title: '인물 화보',
            body: '자연광 아래에서 인물이 가진 고유한 분위기를 있는 그대로 담아낸 작업이에요. 과한 보정 없이 표정과 결을 살렸어요.',
            treatment: 'grain',
          },
          {
            image: PHOTO,
            eyebrow: 'SPACE',
            title: '공간 기록',
            body: '카페와 스튜디오 공간이 가진 구조와 빛의 흐름을 기록했어요. 사람이 없어도 온기가 느껴지도록 작업했어요.',
            treatment: 'mono',
          },
          {
            image: PHOTO,
            eyebrow: 'BRAND',
            title: '브랜드 캠페인',
            body: '제품과 브랜드가 전하고 싶은 메시지를 한 장의 이미지로 압축하는 작업이에요. 클라이언트와 여러 차례 리서치를 거쳐 완성했어요.',
            treatment: 'none',
          },
        ]}
      />

      <Showcase3D
        id="about"
        eyebrow="ABOUT"
        title="10년 동안 카메라 하나로"
        body="2015년부터 인물과 공간을 기록해온 사진작가예요. 필름 카메라로 시작해 지금은 디지털과 필름을 함께 씁니다. 빛과 여백을 오래 들여다보는 편이에요."
        specs={[
          { label: '작업 경력', value: '10년' },
          { label: '누적 촬영', value: '1,200건' },
          { label: '주요 분야', value: '인물 · 공간 · 브랜드' },
          { label: '사용 장비', value: '필름 · 디지털 병행' },
        ]}
        shape="jar"
        poster={PHOTO}
      />

      <Marquee
        items={['PORTRAIT', 'SPACE', 'BRAND', 'FILM', 'EDITORIAL']}
        emphasize={[1]}
      />

      <Contact
        id="contact"
        title="작업 문의는 언제든 편하게 남겨주세요"
        rows={[
          { label: '이메일', value: 'hello@edenstudio.kr' },
          { label: '인스타그램', value: '@eden.studio.photo' },
          { label: '작업 지역', value: '서울 · 출장 협의 가능' },
        ]}
        cta={{ label: '메일 보내기', href: 'mailto:hello@edenstudio.kr' }}
      />
    </>
  );
}

export default App;