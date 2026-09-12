/*
 * 모델에게 가는 킷 프롬프트 원문. kit-files.ts에서 떼어냈다 — 그 파일은 킷 소스를 `?raw`로 import 하므로
 * Vite 밖(노드 하네스)에서 못 읽는다. 실생성 게이트가 UI와 같은 프롬프트를 보내려면 이 문자열이
 * 브라우저 밖에서도 import 가능해야 한다.
 */

/**
 * 모델에게 주는 킷 API 요약. 소스가 아니라 이것만 프롬프트에 들어간다 — 짧게 유지할 것.
 * 컴포넌트 이름·props는 kits/cinematic/src/index.ts와 반드시 일치해야 한다.
 */
export const CINEMATIC_KIT_PROMPT = `이 프로젝트에는 시네마틱 킷이 \`src/kit/\`에 이미 설치돼 있다(수정 금지, 새로 만들지 말 것). 화면은 이 컴포넌트들을 조립해서 만든다.

## 이 지시가 골격 7(소개·홍보형) 체크리스트를 대체한다
골격 7 체크리스트는 킷이 없는 프로젝트용이다. 이 프로젝트에서는 아래 항목이 무효다 — 따르지 말 것.
- data-slot="hero"/"ch1"/"ch2"/"ch3" 컨테이너 4개, height: 100vh 리터럴 → 대신 아래 장면 순서를 쓴다.
- 히어로·챕터 마크업을 JSX 블록으로 직접 쓰라는 지시, 이미지 16:9·4:3 비율 지시, 좌우 교대 지시 → 킷 컴포넌트가 처리한다.
- font-family: 'Noto Serif KR' 인라인 지정과 <head> 폰트 로딩 코드 추가 → 킷 서체가 index.html에 이미 있고 ck- 클래스가 적용한다.
- 페이드+상승 600ms 등장, "패럴랙스를 쓰지 않는다" 규칙 → 이 트랙은 핀·스크럽·패럴랙스를 쓴다(킷이 구현한다).
- "사진을 보내주시면 여기에 넣어드릴게요" 문구와 코랄 틴트 플레이스홀더 → 사진 URL이 이미 있으므로 쓰지 않는다.
그대로 유지되는 것: 밀도 spacious, 한글 실문장 카피, 나열(.map 반복 카드) 금지.

import { HeroScene, PinnedChapters, TextReveal, Showcase3D, BigNumber, Marquee, Contact, Nav, Preloader, Cursor, SceneNav, useSmoothScroll } from './kit';

## 장면 순서 — 아래 11항목을 이 순서 그대로 만든다

App 컴포넌트를 만들 때 1번부터 11번까지 순서대로 배치한다. 순서를 바꾸지 않는다. 조건이 붙은 9번 외에는 하나도 빼지 않는다.

1. useSmoothScroll({ snap: true }) — App 함수 첫 줄에서 한 번만 호출한다(렌더 요소 아님).
2. <Preloader brand="상호" /> — 페이지당 한 번.
3. <Cursor /> — 페이지당 한 번.
4. <Nav brand links cta /> — 페이지당 한 번.
5. <SceneNav /> — 페이지당 한 번.
6. <HeroScene image video eyebrow title sub cta overlay={0.45} /> — 전면 히어로. image는 예약된 사진 URL, video는 있으면 넘긴다. 데스크톱에서 셰이더(WebGL)로 렌더된다.
7. <TextReveal as="h2" className="ck-display ck-display--statement" text="..." emphasize={[8,9]} /> — 어절 스크럽 리빌 선언문.
8. <PinnedChapters id="story" startIndex={2} chapters={[{ image, eyebrow, title, body, treatment }]} /> — 핀+스크럽 챕터 정확히 3개. treatment는 'grain' | 'mono' | 'none'.
9. <Showcase3D eyebrow title body specs={[{label,value}]} shape="jar" poster /> — 드래그로 도는 3D 오브젝트. shape는 'jar'(병·컵·기둥형) 또는 'bowl'(그릇·접시·둥근형) 중 소개할 사물에 가까운 쪽. specs는 실제 정보 2~4줄, poster는 예약된 사진 URL.
10. <BigNumber value={200} suffix="개 / 하루" label="하루 평균 판매량" /> — 사용자가 준 정보에 실제 숫자가 있을 때만 넣는다. 숫자를 지어내지 말 것. 없으면 이 항목만 건너뛴다.
11. <Marquee items={[...]} emphasize={[1]} /> 다음 <Contact id="contact" title rows cta /> — 마무리.

금지: <ScrollChapter>를 직접 쓰지 않는다. 핀·스크럽은 <PinnedChapters>에만 있다. 챕터는 반드시 8번으로 만든다.

## 그 밖의 규칙
- 색·서체·간격은 src/kit/tokens.css의 ck- 클래스와 --ck-* 변수만 쓴다. cr- 클래스와 섞지 말 것. 새 CSS 파일을 만들지 말 것.
- 헤드라인은 한글 실문장으로 쓴다. 자리표시 문구 금지.
- package.json에 three·@react-three/fiber·gsap·lenis가 이미 있고 기본 파일 단계에서 npm install과 npm run dev가 실행된다. 다시 실행할 필요는 없지만 미리보기가 안 뜨면 npm install을 한 번 돌린다.`;

/** .bolt/prompt에 덧붙는 한 줄 요약(모델이 매 턴 보는 파일이라 더 짧게). */
export const CINEMATIC_BOLT_PROMPT_ADDITION = `
이 프로젝트는 시네마틱 트랙이다. \`src/kit/\`의 시네마틱 킷을 조립해 화면을 만든다. 장면 순서는 Preloader → Cursor → Nav → SceneNav → HeroScene → TextReveal → PinnedChapters(3개) → Showcase3D → BigNumber(실제 숫자가 있을 때만) → Marquee → Contact 고정이다. ScrollChapter는 이 트랙에서 쓰지 않는다(챕터는 PinnedChapters로만 만든다). 킷 파일 자체는 수정하지 않는다. 스타일은 킷의 ck- 클래스와 --ck-* 변수만 쓰고, cr- 클래스는 이 트랙에서 쓰지 않는다.
`;
