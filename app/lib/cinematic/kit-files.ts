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

export { CINEMATIC_KIT_PROMPT, CINEMATIC_BOLT_PROMPT_ADDITION } from './kit-prompt';
