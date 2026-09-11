import { describe, expect, it } from 'vitest';
import { buildSkeleton7Prompts, type Skeleton7ImageSetInput } from './skeleton7-image-set';
import { decide } from '~/lib/onboarding/direction-sheet';
import type { Brief } from '~/lib/onboarding/brief-schema';

const base: Skeleton7ImageSetInput = {
  jobId: 'job-12345678',
  chatId: 'chat-1',
  industry: '카페·음식점',
  prompt: '동네 소금빵집 소개 사이트',
  accentHex: '#B45309',
  darkPalette: false,
};

const brief: Brief = {
  industry: '카페·음식점',
  idea: { sentence: '매일 새벽 네 시에 굽는 소금빵집', scene: '새벽 오븐 불빛과 김이 오르는 빵', sceneType: 'object' },
  goal: 'visit',
  world: { styleLock: 'mono-brutal' },
  palette: { accent: '#B45309', source: 'chip' },
  mood: { yes: ['대담한', '단단한'], no: ['달콤한'] },
  refs: [],
  media: { uploads: [], videos: [], generate: true, allowPaintedPeople: true },
  brand: { nameKo: '밀도' },
  proof: { numbers: [] },
  copy: { statement: '빵. 소금. 불.' },
  contact: { phone: '02-000-0000' },
  motion: { level: 'normal' },
  sound: 'none',
  app: { audience: 'public', storage: 'none', integrations: [] },
};

describe('skeleton7-image-set: 프롬프트 조립', () => {
  it('direction 없음 → 기존 기본 STYLE_LOCK + 업종 샷리스트 (프로덕션 경로 불변)', () => {
    const p = buildSkeleton7Prompts(base);
    expect(p.hero).toContain('Editorial photography, one cohesive series.');
    expect(p.hero).toContain('No people, no faces, no hands');
    expect(p.ch1).toContain('Continue the same photo series as the reference image');
    expect(p.ch1).toContain('Editorial photography, one cohesive series.');
  });

  it('direction 있음 → 세계관 styleLockPrompt 로 교체, 슬롯 프롬프트는 ShotPlan.prompt 로', () => {
    const decided = decide(brief);
    const shots = Object.fromEntries(decided.shotList.map((s) => [s.slot, s.prompt]));
    const p = buildSkeleton7Prompts({ ...base, direction: { styleLockPrompt: decided.styleLockPrompt, shots } });

    expect(p.hero).not.toContain('Editorial photography, one cohesive series.');
    expect(p.hero).toContain(decided.styleLockPrompt);
    expect(p.hero).toContain('새벽 오븐 불빛과 김이 오르는 빵');
    expect(p.ch2).toContain(shots.ch2);
    expect(p.ch2).toContain('Match the reference image exactly');
  });

  it('실사 세계관 direction 은 인물 금지 절을, 회화 세계관은 허용 시 넣지 않는다', () => {
    const photo = decide({ ...brief, world: { styleLock: 'photo-editorial' } });
    const painted = decide({ ...brief, world: { styleLock: 'neoclassical-painting' } });
    expect(photo.styleLockPrompt).toContain('No people.');
    expect(painted.styleLockPrompt).not.toContain('No people.');
  });

  it('direction.shots 에 없는 슬롯은 업종 기본 샷리스트로 채운다', () => {
    const p = buildSkeleton7Prompts({ ...base, direction: { styleLockPrompt: 'LOCK', shots: { hero: 'HERO ONLY' } } });
    const fallback = buildSkeleton7Prompts(base);
    expect(p.hero).toContain('HERO ONLY');
    expect(p.ch1.split('\n')[1]).toBe(fallback.ch1.split('\n')[1]);
  });
});
