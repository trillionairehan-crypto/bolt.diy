import { BigNumber, Contact, Cursor, HeroScene, Marquee, Nav, PinnedChapters, Preloader, SceneNav, Showcase3D, TextReveal, useSmoothScroll } from '@kit/index';

/*
 * 데모 v0.2 = CSSDA 8.5~8.9 원형(제품 스토리 + 라이트 에디토리얼) 시퀀스:
 * 프리로더 → 히어로(영상 루프를 셰이더로 통과 + 한글 헤드라인 400) → 선언문(어절 스크럽 리빌) → 핀 챕터 ×3(ch1~ch3)
 * → 3D 오브젝트(드래그 회전) → 큰 숫자 → 마퀴 → 연락처 + 풀블리드 워드마크.
 * 2026-09-11 밤 재생성(smoke-1789128016839, 인물 없는 샷리스트) R2 미디어 그대로. 히어로 영상은 같은 hero.jpg에서 만든 Seedance 2.0 fast 루프.
 */
/*
 * dev는 같은 오리진 경로 — vite 프록시가 R2 공개 버킷으로 넘긴다(버킷에 Access-Control-Allow-Origin이 없어
 * 직접 주소로는 WebGL 텍스처가 막힌다). 빌드본은 프록시가 없으니 원 주소를 쓰고, 그 경우 히어로는
 * onError 폴백으로 <video>를 깐다 — 운영에서 WebGL 히어로를 쓰려면 버킷에 CORS 규칙이 필요하다.
 */
const R2 = 'https://pub-b08f99b5ccf040e4b6b0293f2d95f744.r2.dev';
const BASE = import.meta.env.DEV ? '/r2' : R2;
const MEDIA = `${BASE}/media/smoke-1789128016839`;
const HERO_VIDEO = `${BASE}/media/cmpmtwwnz17/hero-seedance.mp4`;

export default function App() {
  useSmoothScroll({ snap: true });

  /*
   * 채점·대조군용 히어로 모드 — 기본(webgl) = 영상 텍스처를 셰이더에 통과, video = 셰이더 없이 <video>,
   * image = 정지 사진. ?hero=video 처럼 준다.
   */
  const heroMode = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('hero') : null;
  const noVideo = heroMode === 'image';

  return (
    <div className="ck-page">
      <Preloader brand="밀도" />
      <Cursor />
      <Nav brand="밀도" links={[{ label: '이야기', href: '#story' }, { label: '오시는 길', href: '#contact' }]} cta={{ label: '전화 문의', href: 'tel:02-332-8841' }} />
      <SceneNav />

      <HeroScene
        image={`${MEDIA}/hero.jpg`}
        video={noVideo ? undefined : HERO_VIDEO}
        eyebrow="Yeonnam-dong · Since 2021"
        title={
          <>
            매일 새벽 네 시,
            <br />
            그날 구운 <span className="ck-em">만큼만</span>
          </>
        }
        effect={heroMode === 'video' || heroMode === 'image' ? 'none' : 'displace'}
        sub="연남동 소금빵 전문. 하루 세 번 굽고, 다 팔리면 문을 닫습니다."
        cta={{ label: '이야기 보기', href: '#story' }}
        overlay={0.45}
      />

      <section data-ck="scene" style={{ minHeight: '100svh', display: 'grid', alignItems: 'center', padding: 'clamp(96px, 16vh, 200px) var(--ck-gutter)' }}>
        <div style={{ display: 'grid', gap: '28px' }}>
          <span className="ck-eyebrow">01 — Why</span>
          <TextReveal
            as="h2"
            className="ck-display ck-display--statement"
            text="빵집 하나가 동네를 바꾸진 않습니다. 하지만 매일 같은 시간에 같은 냄새가 나는 골목은, 조금 다른 골목이 됩니다."
            emphasize={[8, 9]}
          />
        </div>
      </section>

      <PinnedChapters
        id="story"
        startIndex={2}
        chapters={[
          {
            image: `${MEDIA}/ch1.jpg`,
            eyebrow: 'Dough',
            title: (
              <>
                국산 밀, 발효 버터,
                <br />
                굵은 소금 한 줌
              </>
            ),
            body: '재료는 네 가지뿐입니다. 대신 밀가루는 매주 제분소에서, 버터는 발효 버터만 씁니다.',
            treatment: 'grain',
          },
          {
            image: `${MEDIA}/ch2.jpg`,
            eyebrow: 'Ferment',
            title: (
              <>
                열네 시간,
                <br />
                낮은 온도에서 천천히
              </>
            ),
            body: '급하게 부풀린 반죽은 급하게 꺼집니다. 저온 발효로 결이 촘촘하고 오래 가는 빵을 만듭니다.',
            treatment: 'mono',
          },
          {
            image: `${MEDIA}/ch3.jpg`,
            eyebrow: 'Bake',
            title: (
              <>
                하루 세 번,
                <br />
                그날 구운 만큼만
              </>
            ),
            body: '오전 8시, 11시, 오후 2시. 다 팔리면 문을 닫습니다. 오후 두 시면 대개 품절입니다.',
            treatment: 'none',
          },
        ]}
      />

      <Showcase3D
        eyebrow="04 — Object"
        title={
          <>
            마지막 한 줌을 담는
            <br />
            소금 단지
          </>
        }
        body="구움이 끝난 빵 위에 뿌리는 소금은 이 단지에서 나옵니다. 매대 옆 같은 자리에 5년째 놓여 있습니다."
        specs={[
          { label: 'Salt', value: '게랑드 천일염' },
          { label: 'Vessel', value: '분청 도자, 청주 가마' },
          { label: 'Since', value: '2021년 개업일부터' },
        ]}
        shape="jar"
        poster="/showcase-jar.jpg"
      />

      <section data-ck="scene" style={{ padding: 'clamp(96px, 14vh, 180px) var(--ck-gutter)', borderTop: '1px solid var(--ck-line)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 'clamp(32px, 5vw, 80px)' }}>
          <BigNumber value={200} suffix="개 / 하루" label="하루 평균 판매량" />
          <BigNumber value={14} suffix="시간" label="저온 발효" />
          <BigNumber value={3} suffix="회" label="하루 굽는 횟수" />
        </div>
      </section>

      <Marquee items={['연남동', '소금빵', '발효 버터', '국산 밀', '오전 8시', '매일 세 번', '월요일 휴무']} emphasize={[1]} />

      <Contact
        id="contact"
        title={
          <>
            밀도에서
            <br />
            기다릴게요
          </>
        }
        rows={[
          { label: 'Address', value: '서울 마포구 연남동 223-14' },
          { label: 'Hours', value: '매일 08:00 — 20:00 · 월요일 휴무' },
          { label: 'Phone', value: <a href="tel:02-332-8841" style={{ color: 'inherit' }}>02-332-8841</a> },
          { label: 'Instagram', value: '@mildo_saltbread' },
        ]}
        cta={{ label: '전화로 문의하기', href: 'tel:02-332-8841' }}
        note="주차는 근처 공영주차장(도보 3분)."
        wordmark="밀도"
        credits={['© 2026 MILDO BAKERY', 'SEOUL · KR']}
      />
    </div>
  );
}
