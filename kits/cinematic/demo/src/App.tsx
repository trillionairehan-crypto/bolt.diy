import { Contact, Cursor, HeroScene, Nav, Preloader, Scene, SceneNav, useSmoothScroll } from '@kit/index';

/*
 * 데모 = wearebrand.io 문법: 한 화면 한 장면, 전면 이미지 + 큰 헤드라인 하나, 화살표로 장면 이동, 사람 없음.
 * 2026-09-11 실생성(빵집) R2 미디어 그대로. 히어로 영상은 같은 사진에서 만든 Kling 루프.
 */
const MEDIA = 'https://pub-b08f99b5ccf040e4b6b0293f2d95f744.r2.dev/media/jmtwp1apg-09a82dc44b71';
const HERO_VIDEO = `${MEDIA}/hero-kling.mp4`;

export default function App() {
  useSmoothScroll({ snap: true });

  return (
    <div className="ck-page ck-page--bold">
      <Preloader brand="밀도" />
      <Cursor />
      <Nav brand="밀도." cta={{ label: '전화 문의', href: 'tel:02-332-8841' }} />
      <SceneNav />

      <HeroScene
        image={`${MEDIA}/hero.jpg`}
        video={HERO_VIDEO}
        title={
          <>
            매일 새벽
            <br />
            구워요
          </>
        }
        sub="연남동 소금빵 전문. 하루 세 번, 그날 구운 만큼만."
        cta={{ label: '더 보기', href: '#story' }}
        overlay={0.45}
      />

      <Scene
        id="story"
        image={`${MEDIA}/ch1.jpg`}
        title={
          <>
            겉은 바삭
            <br />
            속은 촉촉
          </>
        }
        body="국산 밀가루와 발효 버터만. 굵은 소금 한 줌으로 단맛과 짠맛의 균형."
        place="right"
        overlay={0.3}
      />

      <Scene
        image={`${MEDIA}/ch2.jpg`}
        title={
          <>
            오후 2시면
            <br />
            품절
          </>
        }
        body="하루 평균 200개. 오전 방문을 추천해요."
        place="top-left"
        overlay={0.3}
      />

      <Contact
        title={
          <>
            밀도에서
            <br />
            기다릴게요
          </>
        }
        image={`${MEDIA}/ch3.jpg`}
        rows={[
          { label: '위치', value: '서울 마포구 연남동 223-14' },
          { label: '운영시간', value: '매일 08:00 — 20:00 · 월요일 휴무' },
          { label: '전화', value: <a href="tel:02-332-8841" style={{ color: 'inherit' }}>02-332-8841</a> },
          { label: '인스타그램', value: '@mildo_saltbread' },
        ]}
        cta={{ label: '전화로 문의하기', href: 'tel:02-332-8841' }}
        note="주차는 근처 공영주차장(도보 3분)."
      />
    </div>
  );
}
