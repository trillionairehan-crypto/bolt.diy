/**
 * 결정 규칙 — Brief(사용자 답) → Decided(아트디렉션). LLM 없음, 순수 함수, 같은 입력 = 같은 출력.
 * 표는 docs/deep-brief-spec.html "결정 규칙" 절과 1:1. 규칙을 바꾸면 여기와 스펙 문서를 같이 바꾼다.
 */
import { getWorld, buildWorldMotionPrompt, type World, type WorldId } from '~/lib/media/style-locks';
import { pickShotList } from '~/lib/media/shotlist';
import {
  GOAL_CTA,
  type Archetype,
  type Brief,
  type Decided,
  type DirectionSheet,
  type Section,
  type ShotPlan,
  type Slot,
  type Treatment,
  type TypePreset,
  type Upload,
} from './brief-schema';

const IMAGE_USD = 0.09;
const VIDEO_USD = 0.15;
const SEQUENCE_TRIES = 3;

function isIndustry(brief: Brief, ...keys: string[]): boolean {
  const text = `${brief.industry} ${brief.industryFree || ''}`;
  const map: Record<string, RegExp> = {
    shopping: /쇼핑|판매|스토어|shop|retail/i,
    cafe: /카페|음식|빵|베이커리|cafe|food|bakery/i,
    beauty: /미용|뷰티|beauty|salon/i,
    freelance: /프리랜서|서비스|디자이너|작가|freelance|studio/i,
    clinic: /병원|의원|클리닉|clinic/i,
    realestate: /공간|부동산|인테리어|건축|estate|space|interior/i,
    fitness: /헬스|운동|fitness|gym|요가/i,
  };

  return keys.some((k) => map[k]?.test(text));
}

/** B1 카드 개인화에 필요한 답만 — B1 이전에 답한 A1~A4·B3(무드)로 계산한다. */
export type WorldPickInput = Pick<Brief, 'industry' | 'industryFree' | 'idea' | 'goal' | 'mood'>;

const WORLD_ORDER: WorldId[] = [
  'photo-editorial',
  'neoclassical-painting',
  'watercolor-illustration',
  'product-3d',
  'mono-brutal',
  'ink-graphic-novel',
];

/**
 * 개인화 카드 규칙 — 6세계관에 점수를 매겨 상위 3개를 돌려준다(B1은 이 3장을 먼저, 나머지 3장을 "다른 세계관"으로 접어 보여준다).
 * 근거: 장면 유형(A3)·업종(A1)·무드(B3 예/아니오)·목적(A4). 실사 에디토리얼은 사용자 실사진이 기본 경로라 항상 +2.
 * 동점은 WORLD_ORDER 순. 순수 함수 — 같은 입력이면 같은 순서.
 */
export function pickTopWorlds(input: WorldPickInput, count = 3): WorldId[] {
  const score: Record<WorldId, number> = {
    'photo-editorial': 2,
    'neoclassical-painting': 0,
    'watercolor-illustration': 0,
    'product-3d': 0,
    'mono-brutal': 0,
    'ink-graphic-novel': 0,
  };
  const add = (id: WorldId, n: number) => {
    score[id] += n;
  };
  const brief = { ...input, media: { uploads: [] } } as unknown as Brief;
  const yes = new Set(input.mood?.yes ?? []);
  const no = new Set(input.mood?.no ?? []);

  switch (input.idea?.sceneType) {
    case 'object':
      add('product-3d', 2);
      add('photo-editorial', 1);
      break;
    case 'space':
    case 'landscape':
      add('photo-editorial', 2);
      add('watercolor-illustration', 1);
      break;
    case 'hands':
    case 'material':
      add('photo-editorial', 1);
      add('neoclassical-painting', 1);
      break;
    case 'abstract':
      add('product-3d', 1);
      add('ink-graphic-novel', 1);
      add('mono-brutal', 1);
      break;
    default:
      break;
  }

  if (isIndustry(brief, 'cafe')) {
    add('photo-editorial', 1);
    add('watercolor-illustration', 1);
  }

  if (isIndustry(brief, 'shopping')) {
    add('product-3d', 2);
  }

  if (isIndustry(brief, 'beauty')) {
    add('photo-editorial', 1);
    add('product-3d', 1);
  }

  if (isIndustry(brief, 'freelance')) {
    add('mono-brutal', 1);
    add('ink-graphic-novel', 1);
  }

  if (isIndustry(brief, 'clinic')) {
    add('photo-editorial', 1);
    add('mono-brutal', 1);
  }

  if (isIndustry(brief, 'realestate')) {
    add('photo-editorial', 2);
  }

  if (isIndustry(brief, 'fitness')) {
    add('mono-brutal', 2);
  }

  if (input.goal === 'portfolio') {
    add('mono-brutal', 1);
    add('ink-graphic-novel', 1);
  }

  const moodTable: Array<[string[], WorldId, number]> = [
    [['고전적', '풍성한', '깊은'], 'neoclassical-painting', 2],
    [['부드러운', '가벼운', '유쾌한', '달콤한'], 'watercolor-illustration', 2],
    [['따뜻한'], 'watercolor-illustration', 1],
    [['대담한', '엄격한', '단단한', '거친', '차가운'], 'mono-brutal', 2],
    [['대담한', '거친'], 'ink-graphic-novel', 1],
    [['현대적', '매끈한', '정확한'], 'product-3d', 2],
    [['어두운'], 'ink-graphic-novel', 1],
    [['어두운'], 'photo-editorial', 1],
    [['장인', '정직한'], 'photo-editorial', 1],
    [['장인'], 'ink-graphic-novel', 1],
  ];

  // 칩 하나마다 더한다 — 맞는 단어가 많을수록 강하게(3단어 전부 '고전적' 계열이면 회화가 실사를 이긴다).
  for (const [chips, id, n] of moodTable) {
    for (const c of chips) {
      if (yes.has(c)) {
        add(id, n);
      }
    }
  }

  // "절대 아닌" 단어는 그 세계관을 강하게 밀어낸다.
  const noTable: Array<[string[], WorldId, number]> = [
    [['고전적', '풍성한'], 'neoclassical-painting', 3],
    [['부드러운', '가벼운', '달콤한'], 'watercolor-illustration', 3],
    [['거친', '엄격한', '대담한'], 'mono-brutal', 3],
    [['거친', '어두운'], 'ink-graphic-novel', 2],
    [['매끈한', '현대적'], 'product-3d', 3],
  ];

  for (const [chips, id, n] of noTable) {
    for (const c of chips) {
      if (no.has(c)) {
        add(id, -n);
      }
    }
  }

  return [...WORLD_ORDER]
    .sort((a, b) => score[b] - score[a] || WORLD_ORDER.indexOf(a) - WORLD_ORDER.indexOf(b))
    .slice(0, count);
}

export function decideArchetype(brief: Brief): Archetype {
  const w = brief.world.styleLock;
  const allGradeC = brief.media.uploads.length > 0 && brief.media.uploads.every((u) => u.grade === 'C');

  if (w === 'neoclassical-painting') {
    return 'painted-sequence';
  }

  if (w === 'watercolor-illustration') {
    return 'illustrated-archive';
  }

  // 사용자가 세계관을 명시적으로 골랐으면 그게 원형을 정한다. 장면 유형·업종 규칙은 실사 에디토리얼일 때만 개입.
  if (w === 'product-3d') {
    return 'product-story';
  }

  if (w === 'mono-brutal') {
    return 'brutal-grid';
  }

  if (w === 'ink-graphic-novel') {
    return 'graphic-novel';
  }

  if (brief.idea.sceneType === 'object' && isIndustry(brief, 'shopping', 'cafe', 'beauty')) {
    return 'product-story';
  }

  if (isIndustry(brief, 'freelance', 'clinic') && brief.goal !== 'portfolio') {
    return 'brutal-grid';
  }

  if (isIndustry(brief, 'freelance') && brief.goal === 'portfolio') {
    return 'agency-showcase';
  }

  if (brief.idea.sceneType === 'space' || brief.idea.sceneType === 'landscape' || isIndustry(brief, 'realestate')) {
    return 'light-editorial';
  }

  if (allGradeC && !brief.media.generate) {
    return 'typo-editorial';
  }

  return 'light-editorial';
}

export function decideTypePreset(brief: Brief, world: World): TypePreset {
  if (brief.type?.preset) {
    return brief.type.preset;
  }

  if (brief.mood.yes.includes('고전적')) {
    return 'serif';
  }

  if (brief.mood.yes.includes('대담한') || isIndustry(brief, 'fitness')) {
    return 'compact';
  }

  return world.typePreset;
}

/** 회화·브루탈은 항상 라이트, 단색 월드는 accent 명도로, 실사는 히어로 사진 명도로(없으면 라이트). 사용자에게 묻지 않는다. */
export function decideTheme(brief: Brief, world: World): 'light' | 'dark' {
  // 실사 에디토리얼만 다크 변형이 있다: 강조색이 어둡거나 무드에 '어두운'이 있으면 다크(Cipher Digital·HACKFIRST 문법).
  if (world.id === 'photo-editorial' && (luminance(brief.palette.accent) < 0.35 || brief.mood.yes.includes('어두운'))) {
    return 'dark';
  }

  return world.theme;
}

function luminance(hex: string): number {
  const m = hex.replace('#', '').match(/.{2}/g);

  if (!m) {
    return 1;
  }

  const [r, g, b] = m.map((x) => parseInt(x, 16) / 255);

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** 슬롯마다: A등급 업로드 → 그대로, B등급 → 세계관 트리트먼트, 없으면 generate 일 때 생성, 아니면 비움. */
export function planShots(brief: Brief, world: World): ShotPlan[] {
  const base = pickShotList(brief.industry);
  const slots: Slot[] = ['hero', 'ch1', 'ch2', 'ch3'];
  const used = new Set<string>();
  const pick = (slot: Slot, grade: 'A' | 'B'): Upload | undefined =>
    brief.media.uploads.find(
      (u) => !used.has(u.id) && u.grade === grade && (u.slot === slot || (!u.slot && slot !== 'hero')),
    );

  return slots.map((slot) => {
    const prompt = `${brief.idea.scene} ${base[slot as keyof typeof base]}`;
    const a = pick(slot, 'A');

    if (a) {
      used.add(a.id);

      return { slot, prompt, source: 'upload', uploadId: a.id, treatment: 'none' as Treatment };
    }

    const b = pick(slot, 'B');

    if (b) {
      used.add(b.id);

      return { slot, prompt, source: 'upload', uploadId: b.id, treatment: world.treatment };
    }

    return { slot, prompt, source: brief.media.generate ? 'generate' : 'empty', treatment: 'none' as Treatment };
  });
}

export function decideSections(brief: Brief, shots: ShotPlan[]): Section[] {
  const sections: Section[] = ['hero', 'statement'];

  if (shots.filter((s) => s.slot !== 'hero' && s.source !== 'empty').length >= 2) {
    sections.push('chapters');
  }

  if (brief.proof.numbers.length >= 2) {
    sections.push('numbers');
  }

  if (brief.motion.level !== 'quiet') {
    sections.push('marquee');
  }

  if (brief.media.uploads.filter((u) => u.grade === 'A').length >= 6) {
    sections.push('gallery');
  }

  sections.push('contact');

  return sections;
}

export function decide(brief: Brief): Decided {
  const world = getWorld(brief.world.styleLock);
  const archetype = decideArchetype(brief);
  const shotList = planShots(brief, world);
  const peoplePolicy =
    world.peoplePolicy === 'painted-only' && brief.media.allowPaintedPeople ? 'painted-only' : 'none';
  const moodYes = brief.mood.yes.slice(0, 2).join(', ');
  const moodNo = brief.mood.no.length ? ` Avoid anything ${brief.mood.no.join(', ')}.` : '';
  const styleLockPrompt = `${world.styleLock(brief.palette.accent)} Mood: ${moodYes}.${moodNo}${peoplePolicy === 'none' ? ' No people.' : ''}`;
  const level = brief.motion.level;
  const hasVideoUpload = brief.media.videos.length > 0;
  const sequence = archetype === 'painted-sequence' && level === 'cinema';
  const video: Decided['video'] = hasVideoUpload
    ? { source: 'upload', mode: 'loop', uploadId: brief.media.videos[0].id }
    : level === 'quiet'
      ? { source: 'none', mode: 'loop' }
      : { source: 'seedance', mode: sequence ? 'sequence' : 'loop', prompt: buildWorldMotionPrompt(world, !sequence) };
  const generated = shotList.filter((s) => s.source === 'generate').length;
  const videos = video.source === 'seedance' ? (sequence ? SEQUENCE_TRIES : 1) : 0;
  const chapters = (brief.chapters && brief.chapters.length ? brief.chapters : defaultChapters(brief))
    .slice(0, 3)
    .map((c, i) => ({ eyebrow: ['One', 'Two', 'Three'][i], title: c.title, body: c.body }));

  return {
    archetype,
    skeleton: 7,
    theme: decideTheme(brief, world),
    accentHex: brief.palette.accent.toLowerCase(),
    typePreset: decideTypePreset(brief, world),
    styleLockPrompt,
    peoplePolicy,
    shotList,
    video,
    sequence: sequence ? { frames: 60, prompt: buildWorldMotionPrompt(world, false) } : undefined,
    kit: {
      pinChapters: level !== 'quiet',
      textReveal: true,
      marquee: level !== 'quiet',
      snap: level === 'cinema',
      preloader: level !== 'quiet',
      cursor: level === 'cinema',
      wordmark: true,
      scene3d: level === 'cinema' && brief.scene3d && brief.scene3d !== 'none' ? brief.scene3d : null,
      soundToggle: brief.sound === 'ambient',
    },
    sections: decideSections(brief, shotList),
    copy: {
      headlineSource: brief.idea.sentence,
      sub: brief.idea.scene,
      statement: brief.copy.statement,
      cta: GOAL_CTA[brief.goal || 'inquiry'],
      chapters,
    },
    estimate: {
      images: generated,
      videos,
      usd: Math.round((generated * IMAGE_USD + videos * VIDEO_USD) * 100) / 100,
      seconds: generated * 15 + videos * 140,
    },
  };
}

function defaultChapters(brief: Brief): Array<{ title: string; body: string }> {
  const base = pickShotList(brief.industry);

  return [
    { title: '재료', body: base.ch1 },
    { title: '공간', body: base.ch2 },
    { title: '만나는 곳', body: base.ch3 },
  ];
}

/** 기존 new-prompt.ts 경로로 흘러가는 자연어 지시문 — GenerationDirectives.promptAdditions 호환. */
export function toPromptAdditions(brief: Brief, decided: Decided): string[] {
  const lines = [
    `브랜드: ${brief.brand.nameKo}${brief.brand.nameEn ? ` (${brief.brand.nameEn})` : ''}. 업종: ${brief.industry}.`,
    `아이디어 한 문장: "${brief.idea.sentence}". 히어로 장면: ${brief.idea.scene}.`,
    `세계관: ${getWorld(brief.world.styleLock).label}, 원형: ${decided.archetype}, 테마: ${decided.theme}, 강조색: ${decided.accentHex}, 서체 프리셋: ${decided.typePreset}.`,
    `무드: ${brief.mood.yes.join(', ')}${brief.mood.no.length ? ` / 금지: ${brief.mood.no.join(', ')}` : ''}.`,
    `섹션 순서: ${decided.sections.join(' → ')}. 없는 섹션은 만들지 않는다(가짜 숫자·가짜 로고 금지).`,
    `선언문: "${brief.copy.statement}". CTA: "${decided.copy.cta}".`,
  ];

  if (brief.proof.numbers.length >= 2) {
    lines.push(`증거 숫자: ${brief.proof.numbers.map((n) => `${n.value}${n.unit} ${n.label}`).join(' / ')}.`);
  }

  const contact = Object.entries(brief.contact)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');

  if (contact) {
    lines.push(`연락처: ${contact}.`);
  }

  return lines;
}

export function buildDirectionSheet(brief: Brief): DirectionSheet {
  const decided = decide(brief);

  return { version: 2, brief, decided, promptAdditions: toPromptAdditions(brief, decided) };
}
