/**
 * 시네마틱 킷을 생성물에 넣기 위한 원문 모음(2단계).
 *
 * 킷 소스(kits/cinematic/src, 21파일 86KB)를 대화 기록에 넣으면 첫 생성 컨텍스트가 그만큼 불어난다
 * (baseline 아티팩트는 assistant 메시지라 모델에게 그대로 간다). 그래서 파일은 WebContainer에 직접 쓰고
 * (seedKit.ts), 모델에게는 아래 짧은 API 요약만 준다.
 */
import BigNumber from '~cinematic-kit/BigNumber.tsx?raw';
import Contact from '~cinematic-kit/Contact.tsx?raw';
import Cursor from '~cinematic-kit/Cursor.tsx?raw';
import HeroCanvas from '~cinematic-kit/HeroCanvas.tsx?raw';
import HeroScene from '~cinematic-kit/HeroScene.tsx?raw';
import Marquee from '~cinematic-kit/Marquee.tsx?raw';
import MediaStage from '~cinematic-kit/MediaStage.tsx?raw';
import MediaTreatment from '~cinematic-kit/MediaTreatment.tsx?raw';
import Nav from '~cinematic-kit/Nav.tsx?raw';
import PinnedChapters from '~cinematic-kit/PinnedChapters.tsx?raw';
import Preloader from '~cinematic-kit/Preloader.tsx?raw';
import Scene from '~cinematic-kit/Scene.tsx?raw';
import ScrollChapter from '~cinematic-kit/ScrollChapter.tsx?raw';
import ScrollSequence from '~cinematic-kit/ScrollSequence.tsx?raw';
import Showcase3D from '~cinematic-kit/Showcase3D.tsx?raw';
import Showcase3DScene from '~cinematic-kit/Showcase3DScene.tsx?raw';
import TextReveal from '~cinematic-kit/TextReveal.tsx?raw';
import Wordmark from '~cinematic-kit/Wordmark.tsx?raw';
import hooks from '~cinematic-kit/hooks.ts?raw';
import index from '~cinematic-kit/index.ts?raw';
import tokens from '~cinematic-kit/tokens.css?raw';

/** 생성 프로젝트 안의 경로 → 원문. 경로는 src/kit/ 아래 고정(모델 프롬프트와 같은 경로여야 한다). */
export const CINEMATIC_KIT_FILES: Record<string, string> = {
  'src/kit/BigNumber.tsx': BigNumber,
  'src/kit/Contact.tsx': Contact,
  'src/kit/Cursor.tsx': Cursor,
  'src/kit/HeroCanvas.tsx': HeroCanvas,
  'src/kit/HeroScene.tsx': HeroScene,
  'src/kit/Marquee.tsx': Marquee,
  'src/kit/MediaStage.tsx': MediaStage,
  'src/kit/MediaTreatment.tsx': MediaTreatment,
  'src/kit/Nav.tsx': Nav,
  'src/kit/PinnedChapters.tsx': PinnedChapters,
  'src/kit/Preloader.tsx': Preloader,
  'src/kit/Scene.tsx': Scene,
  'src/kit/ScrollChapter.tsx': ScrollChapter,
  'src/kit/ScrollSequence.tsx': ScrollSequence,
  'src/kit/Showcase3D.tsx': Showcase3D,
  'src/kit/Showcase3DScene.tsx': Showcase3DScene,
  'src/kit/TextReveal.tsx': TextReveal,
  'src/kit/Wordmark.tsx': Wordmark,
  'src/kit/hooks.ts': hooks,
  'src/kit/index.ts': index,
  'src/kit/tokens.css': tokens,
};

/** 킷이 요구하는 런타임 의존성. 시네마틱 트랙에서만 baseline package.json에 합친다(설치 시간 때문). */
export const CINEMATIC_KIT_DEPENDENCIES: Record<string, string> = {
  '@react-three/fiber': '^8.17.10',
  gsap: '^3.12.5',
  lenis: '^1.1.18',
  three: '^0.170.0',
};

export const CINEMATIC_KIT_DEV_DEPENDENCIES: Record<string, string> = {
  '@types/three': '^0.170.0',
};

/** 킷 서체 — 코랄레드 기본 <head>에 없는 것만. 한글은 Pretendard(이미 있음), 라틴·라벨만 추가한다. */
export const CINEMATIC_FONT_LINKS = `    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Familjen+Grotesk:wght@400;500;600&family=Instrument+Serif&family=Noto+Serif+KR:wght@400;500&family=JetBrains+Mono:wght@400&display=swap"
    />
`;

/**
 * 모델에게 주는 킷 API 요약. 소스가 아니라 이것만 프롬프트에 들어간다 — 짧게 유지할 것.
 * 컴포넌트 이름·props는 kits/cinematic/src/index.ts와 반드시 일치해야 한다.
 */
export const CINEMATIC_KIT_PROMPT = `이 프로젝트에는 시네마틱 킷이 \`src/kit/\`에 이미 설치돼 있다(수정 금지, 새로 만들지 말 것). 화면은 이 컴포넌트들을 조립해서 만든다.

import { HeroScene, PinnedChapters, TextReveal, Showcase3D, BigNumber, Marquee, Contact, Nav, Preloader, Cursor, SceneNav, useSmoothScroll } from './kit';

- useSmoothScroll({ snap: true }) — App 최상단에서 한 번만 호출.
- <Preloader brand="상호" /> · <Cursor /> · <Nav brand links cta /> · <SceneNav /> — 페이지당 한 번.
- <HeroScene image video eyebrow title sub cta overlay={0.45} /> — 전면 히어로. image는 예약된 사진 URL, video는 있으면 넘긴다. 데스크톱에서 셰이더(WebGL)로 렌더된다.
- <TextReveal as="h2" className="ck-display ck-display--statement" text="..." emphasize={[8,9]} /> — 어절 스크럽 리빌 선언문.
- <PinnedChapters id="story" startIndex={2} chapters={[{ image, eyebrow, title, body, treatment }]} /> — 핀+스크럽 챕터 3개. treatment는 'grain' | 'mono' | 'none'.
- <Showcase3D eyebrow title body specs={[{label,value}]} shape="jar" poster /> — 드래그로 도는 3D 오브젝트. 실제 소개할 사물이 있을 때만 쓴다.
- <BigNumber value={200} suffix="개 / 하루" label="하루 평균 판매량" /> — 실제 숫자가 있을 때만.
- <Marquee items={[...]} emphasize={[1]} /> · <Contact id="contact" title rows cta /> — 마무리.
- 색·서체·간격은 src/kit/tokens.css의 ck- 클래스와 --ck-* 변수만 쓴다. cr- 클래스와 섞지 말 것. 새 CSS 파일을 만들지 말 것.
- 헤드라인은 한글 실문장으로 쓴다. 자리표시 문구 금지.
- package.json에 three·@react-three/fiber·gsap·lenis가 이미 있고 기본 파일 단계에서 npm install과 npm run dev가 실행된다. 다시 실행할 필요는 없지만 미리보기가 안 뜨면 npm install을 한 번 돌린다.`;

/** .bolt/prompt에 덧붙는 한 줄 요약(모델이 매 턴 보는 파일이라 더 짧게). */
export const CINEMATIC_BOLT_PROMPT_ADDITION = `
이 프로젝트는 시네마틱 트랙이다. \`src/kit/\`의 시네마틱 킷(HeroScene, PinnedChapters, TextReveal, Showcase3D, BigNumber, Marquee, Contact, Nav, Preloader, Cursor, SceneNav)을 조립해 화면을 만든다. 킷 파일 자체는 수정하지 않는다. 스타일은 킷의 ck- 클래스와 --ck-* 변수만 쓰고, cr- 클래스는 이 트랙에서 쓰지 않는다.
`;
