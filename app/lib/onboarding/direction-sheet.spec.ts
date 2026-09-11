import { describe, expect, it } from 'vitest';
import type { Brief, Upload } from './brief-schema';
import { validateBrief } from './brief-schema';
import { buildDirectionSheet, decide, decideArchetype, pickTopWorlds, planShots } from './direction-sheet';
import { getWorld } from '~/lib/media/style-locks';

function upload(id: string, grade: Upload['grade'], slot?: Upload['slot']): Upload {
  return { id, url: `https://x/${id}.jpg`, grade, slot };
}

const base: Brief = {
  industry: '카페·음식점',
  idea: {
    sentence: '매일 새벽 네 시에 굽는 소금빵집',
    scene: '새벽 어둠 속 오븐 불빛과 김이 오르는 빵',
    sceneType: 'object',
  },
  goal: 'visit',
  world: { styleLock: 'photo-editorial' },
  palette: { accent: '#B45309', source: 'chip' },
  mood: { yes: ['따뜻한', '정직한', '장인'], no: ['차가운'] },
  refs: [],
  media: { uploads: [], videos: [], generate: true, allowPaintedPeople: true },
  brand: { nameKo: '밀도' },
  proof: { numbers: [] },
  copy: { statement: '빵집 하나가 동네를 바꾸진 않습니다.' },
  contact: { address: '서울 마포구 연남동 223-14', phone: '02-332-8841' },
  motion: { level: 'normal' },
  sound: 'none',
  app: { audience: 'public', storage: 'none', integrations: [] },
};

describe('direction-sheet: 결정 규칙', () => {
  it('같은 브리프 → 바이트 동일 decided (결정론)', () => {
    expect(JSON.stringify(decide(base))).toBe(JSON.stringify(decide(structuredClone(base))));
  });

  it('원형: 회화 → painted-sequence, 수채 → illustrated-archive, 오브젝트+카페 → product-story, 공간 → light-editorial', () => {
    expect(decideArchetype({ ...base, world: { styleLock: 'neoclassical-painting' } })).toBe('painted-sequence');
    expect(decideArchetype({ ...base, world: { styleLock: 'watercolor-illustration' } })).toBe('illustrated-archive');
    expect(decideArchetype(base)).toBe('product-story');
    expect(decideArchetype({ ...base, industry: '공간·부동산', idea: { ...base.idea, sceneType: 'space' } })).toBe(
      'light-editorial',
    );
    expect(decideArchetype({ ...base, world: { styleLock: 'mono-brutal' } })).toBe('brutal-grid');
  });

  it('원형: 업로드 전부 C등급 + 생성 거부 → typo-editorial (이미지 없이 타이포로)', () => {
    const brief: Brief = {
      ...base,
      industry: '학원·교육',
      idea: { ...base.idea, sceneType: 'abstract' },
      media: { ...base.media, generate: false, uploads: [upload('a', 'C'), upload('b', 'C')] },
    };
    expect(decideArchetype(brief)).toBe('typo-editorial');
  });

  it('인물 정책: 실사 세계관은 항상 none, 회화 세계관은 허용 시에만 painted-only', () => {
    expect(decide(base).peoplePolicy).toBe('none');
    expect(decide({ ...base, world: { styleLock: 'neoclassical-painting' } }).peoplePolicy).toBe('painted-only');
    expect(
      decide({
        ...base,
        world: { styleLock: 'neoclassical-painting' },
        media: { ...base.media, allowPaintedPeople: false },
      }).peoplePolicy,
    ).toBe('none');
    expect(decide(base).styleLockPrompt).toMatch(/No people/);
    expect(decide({ ...base, world: { styleLock: 'neoclassical-painting' } }).styleLockPrompt).not.toMatch(
      /No people\.$/,
    );
  });

  it('슬롯: A등급은 그대로, B등급은 세계관 트리트먼트, 없으면 생성', () => {
    const shots = planShots(
      { ...base, media: { ...base.media, uploads: [upload('h', 'A', 'hero'), upload('d', 'B')] } },
      getWorld('photo-editorial'),
    );
    expect(shots[0]).toMatchObject({ slot: 'hero', source: 'upload', uploadId: 'h', treatment: 'none' });
    expect(shots[1]).toMatchObject({ slot: 'ch1', source: 'upload', uploadId: 'd', treatment: 'grain' });
    expect(shots[2].source).toBe('generate');
    expect(shots[3].source).toBe('generate');
  });

  it('섹션: 숫자 2개 미만이면 numbers 없음, quiet면 marquee 없음, 항상 hero→…→contact', () => {
    const d = decide(base);
    expect(d.sections).toEqual(['hero', 'statement', 'chapters', 'marquee', 'contact']);

    const quiet = decide({
      ...base,
      motion: { level: 'quiet' },
      proof: {
        numbers: [
          { value: 200, unit: '개', label: '하루' },
          { value: 14, unit: '시간', label: '발효' },
        ],
      },
    });
    expect(quiet.sections).toEqual(['hero', 'statement', 'chapters', 'numbers', 'contact']);
  });

  it('영상: 업로드 있으면 upload, quiet면 none, 회화+cinema면 sequence 3회 견적', () => {
    expect(decide({ ...base, media: { ...base.media, videos: [upload('v', 'A')] } }).video).toMatchObject({
      source: 'upload',
      uploadId: 'v',
    });
    expect(decide({ ...base, motion: { level: 'quiet' } }).video.source).toBe('none');

    const seq = decide({ ...base, world: { styleLock: 'neoclassical-painting' }, motion: { level: 'cinema' } });
    expect(seq.video.mode).toBe('sequence');
    expect(seq.sequence?.frames).toBe(60);
    expect(seq.estimate).toMatchObject({ images: 4, videos: 3 });
    expect(seq.estimate.usd).toBeCloseTo(4 * 0.09 + 3 * 0.15, 2);
  });

  it('킷: quiet = 리빌만, normal = 핀+마퀴+프리로더, cinema = +스냅+커서+3D씬', () => {
    expect(decide({ ...base, motion: { level: 'quiet' } }).kit).toMatchObject({
      pinChapters: false,
      marquee: false,
      snap: false,
      cursor: false,
      scene3d: null,
    });
    expect(decide(base).kit).toMatchObject({ pinChapters: true, marquee: true, snap: false, preloader: true });
    expect(decide({ ...base, motion: { level: 'cinema' }, scene3d: 'glass-cluster' }).kit).toMatchObject({
      snap: true,
      cursor: true,
      scene3d: 'glass-cluster',
    });
  });

  it('서체: 사용자 선택 우선, 없으면 무드(고전적→serif, 대담한→compact), 그다음 세계관 기본', () => {
    expect(decide({ ...base, type: { preset: 'compact' } }).typePreset).toBe('compact');
    expect(decide({ ...base, mood: { yes: ['고전적'], no: [] } }).typePreset).toBe('serif');
    expect(decide({ ...base, mood: { yes: ['대담한'], no: [] } }).typePreset).toBe('compact');
    expect(decide(base).typePreset).toBe('grotesk');
    expect(decide({ ...base, world: { styleLock: 'neoclassical-painting' } }).typePreset).toBe('serif');
  });

  it('테마: 회화·브루탈·그래픽노블 = light, 실사만 어두운 강조색/무드로 dark 변형', () => {
    expect(decide(base).theme).toBe('light');
    expect(decide({ ...base, palette: { accent: '#1a0a05', source: 'hex' } }).theme).toBe('dark');
    expect(decide({ ...base, mood: { yes: ['어두운'], no: [] } }).theme).toBe('dark');
    expect(
      decide({ ...base, world: { styleLock: 'ink-graphic-novel' }, palette: { accent: '#1a0a05', source: 'hex' } })
        .theme,
    ).toBe('light');
    expect(decideArchetype({ ...base, world: { styleLock: 'ink-graphic-novel' } })).toBe('graphic-novel');
  });

  it('promptAdditions: 브랜드·아이디어·세계관·섹션·선언문 포함, 숫자 없으면 증거 줄 없음', () => {
    const sheet = buildDirectionSheet(base);
    expect(sheet.version).toBe(2);
    expect(sheet.promptAdditions.join('\n')).toMatch(/밀도/);
    expect(sheet.promptAdditions.join('\n')).toMatch(/가짜 숫자/);
    expect(sheet.promptAdditions.some((l) => l.startsWith('증거 숫자'))).toBe(false);
  });

  it('validateBrief: 필수 누락 경로를 돌려준다', () => {
    expect(validateBrief(base)).toEqual([]);
    expect(validateBrief({ ...base, brand: { nameKo: '' }, palette: { accent: 'orange', source: 'chip' } })).toEqual([
      'palette.accent',
      'brand.nameKo',
    ]);
  });
});

describe('direction-sheet: pickTopWorlds (개인화 카드 상위 3)', () => {
  it('결정론 — 같은 입력이면 같은 순서, 항상 3개, 중복 없음', () => {
    const a = pickTopWorlds(base);
    expect(a).toEqual(pickTopWorlds(structuredClone(base)));
    expect(a).toHaveLength(3);
    expect(new Set(a).size).toBe(3);
  });

  it('빵집 + 오브젝트 + 따뜻한/정직한/장인 → 실사가 1등, 제품 3D·수채가 따라온다', () => {
    const top = pickTopWorlds(base);
    expect(top[0]).toBe('photo-editorial');
    expect(top).toContain('product-3d');
    expect(top).toContain('watercolor-illustration');
  });

  it('무드 "고전적·풍성한" → 신고전주의 회화가 상위 3에 든다', () => {
    expect(pickTopWorlds({ ...base, mood: { yes: ['고전적', '풍성한', '깊은'], no: [] } })[0]).toBe(
      'neoclassical-painting',
    );
  });

  it('헬스장 + 대담한·단단한 → 흑백 브루탈 1등', () => {
    const top = pickTopWorlds({
      ...base,
      industry: '헬스·운동',
      idea: { ...base.idea, sceneType: 'space' },
      mood: { yes: ['대담한', '단단한', '빠른'], no: [] },
    });
    expect(top[0]).toBe('mono-brutal');
  });

  it('"절대 아닌" 단어는 그 세계관을 밀어낸다 — 고전적 금지면 회화가 3위 밖', () => {
    const top = pickTopWorlds({ ...base, mood: { yes: ['고전적'], no: ['고전적', '풍성한'] } });
    expect(top).not.toContain('neoclassical-painting');
  });

  it('포트폴리오 목적 + 프리랜서 + 거친 → 잉크 그래픽 노블이 상위 3에 든다', () => {
    const top = pickTopWorlds({
      ...base,
      industry: '프리랜서·서비스',
      goal: 'portfolio',
      idea: { ...base.idea, sceneType: 'abstract' },
      mood: { yes: ['거친', '대담한', '어두운'], no: [] },
    });
    expect(top).toContain('ink-graphic-novel');
    expect(top).toContain('mono-brutal');
  });
});
