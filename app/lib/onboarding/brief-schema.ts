/**
 * 딥 브리프(온보딩 v2) — 사용자 답(Brief)과 규칙이 계산한 결정(Decided)을 분리한 Direction Sheet.
 * 스펙: docs/deep-brief-spec.html. 모든 문항은 Brief 필드 하나 이상에 매핑된다(매핑 없는 문항은 존재하지 않는다).
 * 여기는 타입·기본값·검증만. 결정 규칙은 direction-sheet.ts.
 */
import type { WorldId } from '~/lib/media/style-locks';
import type { Q1Value, Q2Value, SkeletonId } from './question-bank';

export type SceneType = 'object' | 'space' | 'hands' | 'material' | 'landscape' | 'abstract';
export type Goal = 'call' | 'visit' | 'buy' | 'inquiry' | 'portfolio' | 'hire';
export type TypePreset = 'grotesk' | 'serif' | 'compact';
export type MotionLevel = 'quiet' | 'normal' | 'cinema';
export type Scene3d =
  | 'none'
  | 'glass-cluster'
  | 'particle-stream'
  | 'type-glitch'
  | 'marble-hall'
  | 'orbit-object'
  | 'shader-hero';
export type PhotoGrade = 'A' | 'B' | 'C';
export type Slot = 'hero' | 'ch1' | 'ch2' | 'ch3' | 'detail' | 'space';
export type Treatment = 'none' | 'mono' | 'duotone' | 'halftone' | 'grain' | 'blur' | 'detail' | 'circle';
export type RefLike = 'color' | 'motion' | 'photo' | 'type' | 'mood';

export interface Upload {
  id: string;
  url: string;

  /** 사용자가 지정한 샷리스트 칸(선택) */
  slot?: Slot;
  grade: PhotoGrade;

  /** 등급 근거 — 화면에 한 줄로 보여준다 */
  metrics?: {
    longEdge: number;
    sharpness: number;
    clipping: number;
    colorCast: number;
    clutter: number;
    hasText?: boolean;
  };

  /** 실사 인물이 있는 사용자 사진 — 허용(사용자 것이므로) */
  hasPeople?: boolean;
}

export interface RefMetrics {
  idle?: number;
  journey?: number;
  pinned?: number;
  webgl?: boolean;
}

export interface Brief {
  // A. 정체
  industry: string;
  industryFree?: string;
  idea: { sentence: string; scene: string; sceneType: SceneType };
  goal?: Goal;

  // B. 세계관
  world: { styleLock: WorldId };
  palette: { accent: string; source: 'chip' | 'photo' | 'hex' };
  mood: { yes: string[]; no: string[] };
  refs: Array<{ url: string; liked: RefLike[]; measured?: RefMetrics }>;
  type?: { preset: TypePreset };

  // C. 재료
  media: { uploads: Upload[]; videos: Upload[]; generate: boolean; allowPaintedPeople: boolean };
  brand: { nameKo: string; nameEn?: string; logo?: Upload };

  // D. 증거·카피
  proof: { numbers: Array<{ value: number; unit: string; label: string }> };
  copy: { statement: string };
  contact: {
    address?: string;
    phone?: string;
    hours?: string;
    closed?: string;
    instagram?: string;
    kakao?: string;
    parking?: string;
  };
  chapters?: Array<{ title: string; body: string }>;

  // E. 연출
  motion: { level: MotionLevel };
  scene3d?: Scene3d;
  sound: 'none' | 'ambient';

  // F. 기능(기존 Q1·Q2·Q4)
  app: { audience: Q1Value; storage: Q2Value; integrations: string[] };
}

export type Archetype =
  | 'product-story'
  | 'light-editorial'
  | 'brutal-grid'
  | 'agency-showcase'
  | 'painted-sequence'
  | 'illustrated-archive'
  | 'graphic-novel'
  | 'typo-editorial';
export type Section = 'hero' | 'statement' | 'chapters' | 'numbers' | 'marquee' | 'gallery' | 'contact';

export interface ShotPlan {
  slot: Slot;
  prompt: string;
  source: 'upload' | 'generate' | 'empty';
  uploadId?: string;
  treatment: Treatment;
}

export interface Decided {
  archetype: Archetype;
  skeleton: SkeletonId;
  theme: 'light' | 'dark';
  accentHex: string;
  typePreset: TypePreset;
  styleLockPrompt: string;
  peoplePolicy: 'none' | 'painted-only';
  shotList: ShotPlan[];
  video: { source: 'upload' | 'seedance' | 'none'; prompt?: string; mode: 'loop' | 'sequence'; uploadId?: string };
  sequence?: { frames: number; prompt: string };
  kit: {
    pinChapters: boolean;
    textReveal: boolean;
    marquee: boolean;
    snap: boolean;
    preloader: boolean;
    cursor: boolean;
    wordmark: boolean;
    scene3d: Scene3d | null;
    soundToggle: boolean;
  };
  sections: Section[];
  copy: {
    headlineSource: string;
    sub: string;
    statement: string;
    cta: string;
    chapters: Array<{ eyebrow: string; title: string; body: string }>;
  };
  estimate: { images: number; videos: number; usd: number; seconds: number };
}

export interface DirectionSheet {
  version: 2;
  brief: Brief;
  decided: Decided;

  /** 기존 GenerationDirectives.promptAdditions 호환 — new-prompt.ts 로 흘러가는 문장들 */
  promptAdditions: string[];
}

export const MOOD_CHIPS = [
  '따뜻한',
  '정직한',
  '고요한',
  '대담한',
  '장인',
  '현대적',
  '고전적',
  '유쾌한',
  '엄격한',
  '부드러운',
  '단단한',
  '가벼운',
  '깊은',
  '빠른',
  '느린',
  '정확한',
  '거친',
  '매끈한',
  '풍성한',
  '비어있는',
  '밝은',
  '어두운',
  '달콤한',
  '차가운',
] as const;

export const SCENE_TYPE_LABELS: Record<SceneType, string> = {
  object: '오브젝트 클로즈업',
  space: '공간 와이드',
  hands: '손과 재료',
  material: '재료·소재만',
  landscape: '도시·풍경',
  abstract: '추상',
};

export const GOAL_CTA: Record<Goal, string> = {
  call: '전화로 문의하기',
  visit: '오시는 길',
  buy: '구매하기',
  inquiry: '상담 신청',
  portfolio: '작업 보기',
  hire: '지원하기',
};

/** 필수 필드가 다 찼는지 — 챕터 G(확인) 진입 조건. 누락 필드 경로를 돌려준다. */
export function validateBrief(brief: Partial<Brief>): string[] {
  const missing: string[] = [];
  const need = (ok: unknown, path: string) => {
    if (!ok) {
      missing.push(path);
    }
  };

  need(brief.industry, 'industry');
  need(brief.idea?.sentence?.trim(), 'idea.sentence');
  need(brief.idea?.scene?.trim(), 'idea.scene');
  need(brief.idea?.sceneType, 'idea.sceneType');
  need(brief.world?.styleLock, 'world.styleLock');
  need(/^#[0-9a-f]{6}$/i.test(brief.palette?.accent || ''), 'palette.accent');
  need((brief.mood?.yes?.length || 0) >= 1, 'mood.yes');
  need(brief.media && Array.isArray(brief.media.uploads), 'media.uploads');
  need(brief.media && typeof brief.media.generate === 'boolean', 'media.generate');
  need(brief.brand?.nameKo?.trim(), 'brand.nameKo');
  need(brief.copy?.statement?.trim(), 'copy.statement');
  need(brief.contact && Object.values(brief.contact).some(Boolean), 'contact');
  need(brief.motion?.level, 'motion.level');
  need(brief.app?.audience, 'app.audience');
  need(brief.app?.storage, 'app.storage');

  return missing;
}
