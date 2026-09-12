/*
 * 시네마틱 트랙 생성 요청에 붙는 사진·영상 지시 줄. skeleton7Images.ts에서 떼어낸 순수 함수다 —
 * 그 파일은 workbenchStore(브라우저 전용)를 import 하므로 노드 하네스에서 못 부른다. 실생성 게이트가
 * UI와 글자 하나까지 같은 프롬프트를 보내려면 이 줄들이 브라우저 밖에서도 import 가능해야 한다.
 *
 * 이 줄들은 시네마틱 트랙에서만 쓴다(prepareSkeleton7Images의 유일한 호출부가 cinematic 분기다). 그래서
 * 배치 지시는 손으로 쓰는 마크업이 아니라 킷 컴포넌트의 props로 준다 — 2단계 1차에서 여기 남아 있던
 * "히어로를 전면 <img>로 깔고 그라데이션을 올린다"·"챕터는 4:3으로 캡션 옆에"·raw <video> 지시가
 * CINEMATIC_KIT_PROMPT의 장면 순서와 정면으로 부딪혔고, 생성물이 HeroScene/PinnedChapters 대신
 * 직접 만든 마크업과 구형 ScrollChapter로 내려갔다.
 */
import type { Skeleton7ImageUrls } from './injectSkeleton7Images';

export interface PromptLineVideo {
  url: string;
}

export function buildSkeleton7PromptLines(urls: Skeleton7ImageUrls, video?: PromptLineVideo): string[] {
  const lines = [
    `사진 4장(사용자가 준 실제 URL — 반드시 이 URL 그대로 킷 컴포넌트의 props에 넣는다, 다른 이미지 URL이나 플레이스홀더 금지): <HeroScene image> = ${urls.hero} · <PinnedChapters chapters>의 3개 image = ${urls.ch1} / ${urls.ch2} / ${urls.ch3}`,
    `사진이 있으므로 코랄 틴트 플레이스홀더 박스와 "사진을 보내주시면 여기에 넣어드릴게요" 문구는 어디에도 쓰지 않는다. 히어로 전면 배치·그라데이션·챕터 비율·lazy 로딩은 킷 컴포넌트가 이미 처리하므로 <img>·<video>·오버레이 마크업을 직접 쓰지 않는다. 각 챕터에는 업종에 맞는 짧은 alt와 treatment('grain' | 'mono' | 'none')를 준다. <Showcase3D poster>에는 ${urls.hero}를 쓴다.`,
  ];

  if (video) {
    lines.push(
      `히어로 영상(사용자가 준 무음 5초 루프, URL = ${video.url}): <HeroScene image="${urls.hero}" video="${video.url}" ... />처럼 video prop으로만 넘긴다. <video> 태그를 직접 쓰지 않는다 — 킷이 데스크톱에서는 WebGL 셰이더 텍스처로, 모바일·reduced-motion에서는 히어로 이미지로 알아서 내린다. 영상은 준비 중일 수 있으니 image도 반드시 함께 넘긴다.`,
    );
  }

  return lines;
}
