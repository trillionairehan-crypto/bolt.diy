import { Contact, Cursor, HeroScene, Nav, Preloader, ScrollChapter, useSmoothScroll } from '@kit/index';

// 2026-09-11 실생성(빵집)에서 나온 실제 R2 미디어 — 킷 데모는 "생성물 재료 그대로" 조립한다.
const MEDIA = 'https://pub-b08f99b5ccf040e4b6b0293f2d95f744.r2.dev/media/jmtwp1apg-09a82dc44b71';
// 같은 잡의 히어로에서 만든 루프(Kling). Seedance 루프(cmpmtwplbxz)는 다른 사진에서 나온 거라 이미지와 안 맞는다.
const HERO_VIDEO = `${MEDIA}/hero-kling.mp4`;

export default function App() {
  useSmoothScroll();

  return (
    <div className="ck-page">
      <Preloader brand="밀도" />
      <Cursor />
      <Nav brand="밀도" links={[{ label: '빵', href: '#bread' }, { label: '오시는 길', href: '#visit' }]} cta={{ label: '전화 문의', href: 'tel:02-332-8841' }} />

      <HeroScene
        image={`${MEDIA}/hero.jpg`}
        video={HERO_VIDEO}
        eyebrow="연남동 · 소금빵 전문"
        title={
          <>
            매일 새벽,
            <br />
            버터 향 가득한 소금빵
          </>
        }
        sub="동네 골목 작은 빵집. 하루 세 번, 그날 구운 만큼만 팝니다."
        cta={{ label: '오시는 길 보기', href: '#visit' }}
        secondaryCta={{ label: '오늘의 빵', href: '#bread' }}
      />

      <div id="bread">
        <ScrollChapter
          index={1}
          image={`${MEDIA}/ch1.jpg`}
          alt="반죽을 손으로 성형하는 모습"
          eyebrow="만드는 과정"
          title="새벽 4시, 반죽이 시작돼요"
          body="국산 밀가루와 발효 버터만 써요. 하루 두 번, 새벽과 오후에 반죽해서 항상 신선한 상태로 구워내요. 대량 생산 없이 그날 팔 만큼만 만들어요."
          align="left"
        />
        <ScrollChapter
          index={2}
          image={`${MEDIA}/ch2.jpg`}
          alt="오븐에서 갓 나온 소금빵"
          eyebrow="시그니처 메뉴"
          title="겉바속촉, 그 한 줄 소금빵"
          body="굵은 소금을 살짝 올려 짭짤함과 단맛의 균형을 맞췄어요. 하루 평균 200개, 오후 2시쯤이면 대부분 품절돼요. 오전 방문을 추천해요."
          align="right"
        />
      </div>

      <div id="visit">
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
            { label: '운영시간', value: '매일 오전 8시 — 오후 8시 (매주 월요일 휴무)' },
            { label: '전화', value: <a href="tel:02-332-8841" style={{ color: 'inherit' }}>02-332-8841</a> },
            { label: '인스타그램', value: '@mildo_saltbread' },
          ]}
          cta={{ label: '전화로 문의하기', href: 'tel:02-332-8841' }}
          note="주차는 근처 공영주차장(도보 3분)을 이용해주세요."
        />
      </div>
    </div>
  );
}
