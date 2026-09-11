/**
 * 세계관 카드 미디어 — B1 화면의 6장 카드가 쓰는 스틸·루프. 원본은 tests/media/showroom.ts 가 R2 media/showroom/<world>/ 에
 * 올린 것(kits/cinematic/demo/src/showroom.json 과 같은 URL). 개인화 카드(사용자 가게로 재생성)가 들어오기 전까지의 기본값.
 */
import type { WorldId } from './style-locks';

export interface WorldCardMedia {
  still: string;
  video?: string;

  /** 밝은 종이 배경은 흰 글자가 안 읽힌다 → 'dark' 면 검정 글자 */
  ink?: 'light' | 'dark';
  headline: string;
  sub: string;
}

const R2 = 'https://pub-b08f99b5ccf040e4b6b0293f2d95f744.r2.dev/media/showroom';

export const WORLD_CARDS: Record<WorldId, WorldCardMedia> = {
  'photo-editorial': {
    still: `${R2}/photo-editorial/still-mtwykpyk-1.jpg`,
    video: `${R2}/photo-editorial/hero-mtwyytrr.mp4`,
    headline: '매일 새벽 네 시,\n그날 구운 만큼만',
    sub: '창가 자연광, 나무 도마, 김 한 줄기. 사진이 곧 증거인 세계.',
  },
  'neoclassical-painting': {
    still: `${R2}/neoclassical-painting/still-mtwylnoa-1.jpg`,
    video: `${R2}/neoclassical-painting/hero-mtwz2k0c.mp4`,
    headline: '빵은 매일\n다시 태어난다',
    sub: '회화 속 인물이 빵을 바친다. 스크롤이 그림을 움직이는 세계.',
  },
  'watercolor-illustration': {
    still: `${R2}/watercolor-illustration/still-mtwymb3l-0.jpg`,
    video: `${R2}/watercolor-illustration/hero-mtwz58zm.mp4`,
    ink: 'dark',
    headline: '오늘의 빵,\n손으로 그린',
    sub: '종이 위에 번지는 수채. 가볍고 다정한 세계.',
  },
  'product-3d': {
    still: `${R2}/product-3d/still-mtwynawg-1.jpg`,
    video: `${R2}/product-3d/hero-mtwz7wx4.mp4`,
    headline: '소금빵,\n하나로 충분한',
    sub: '떠 있는 오브젝트 하나. 제품이 주인공인 세계.',
  },
  'mono-brutal': {
    still: `${R2}/mono-brutal/still-mtwyvoae-1.jpg`,
    video: `${R2}/mono-brutal/hero-mtwyzyel.mp4`,
    headline: '빵. 소금. 불.\n그게 전부',
    sub: '흑백 망점 위에 색 하나. 단호한 세계.',
  },
  'ink-graphic-novel': {
    // 2026-09-12 생성(gpt-image-2.5-flare, 3장 중 1) — 왼쪽 종이 여백이 헤드라인 자리.
    still: `${R2}/ink-graphic-novel/still-mtx3xrl6-1.jpg`,
    video: `${R2}/ink-graphic-novel/hero-mtx43iz0.mp4`,
    ink: 'dark',
    headline: '오븐 앞,\n한 사람',
    sub: '붓 몇 획의 인물과 잉크 그림자. 만화 한 컷이 살아 움직이는 세계.',
  },
};
