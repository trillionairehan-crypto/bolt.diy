/**
 * 딥 브리프(온보딩 v2) — 챕터 A~G, 문항 24개, 한 화면 한 질문. 스펙: docs/deep-brief-spec.html.
 * 기존 PromptClarification(Q1~Q5)은 건드리지 않는다 — 이 컴포넌트는 /brief 미리보기 라우트에서만 렌더된다.
 *
 * 순서는 스펙과 한 곳만 다르다: B3(무드)를 B1(세계관) 앞에 둔다. 세계관 카드 상위 3장을 pickTopWorlds 로 개인화하려면
 * 무드가 먼저 필요하기 때문("결과 우선 — 우리가 정하고 사용자는 확인").
 * 자동 저장: localStorage(업로드 파일은 object URL 이라 새로고침 뒤엔 다시 올려야 한다 — 등급·칸 지정은 남긴다).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { classNames } from '~/utils/classNames';
import styles from './DeepBrief.module.scss';
import {
  GOAL_CTA,
  MOOD_CHIPS,
  SCENE_TYPE_LABELS,
  validateBrief,
  type Brief,
  type DirectionSheet,
  type Goal,
  type MotionLevel,
  type RefLike,
  type Scene3d,
  type SceneType,
  type TypePreset,
  type Upload,
} from '~/lib/onboarding/brief-schema';
import { buildDirectionSheet, pickTopWorlds } from '~/lib/onboarding/direction-sheet';
import {
  Q1_OPTIONS,
  Q2_OPTIONS,
  Q3_GRID,
  Q4_CATEGORIES,
  type Q1Value,
  type Q2Value,
} from '~/lib/onboarding/question-bank';
import { WORLDS, getWorld, type WorldId } from '~/lib/media/style-locks';
import { WORLD_CARDS } from '~/lib/media/world-cards';
import { pickShotList } from '~/lib/media/shotlist';
import { gradePhotoFile } from '~/lib/media/photo-grade';

/*
 * ---------------------------------------------------------------------------
 * 초안(draft) — 답하는 동안의 느슨한 상태. 완료 시 Brief 로 굳힌다.
 * ---------------------------------------------------------------------------
 */

interface Draft {
  industry: string;
  industryFree: string;
  ideaSentence: string;
  ideaScene: string;
  sceneType: SceneType | '';
  goal: Goal | '';
  world: WorldId | '';
  accent: string;
  accentSource: 'chip' | 'photo' | 'hex';
  moodYes: string[];
  moodNo: string[];
  refs: Array<{ url: string; liked: RefLike[] }>;
  typePreset: TypePreset | '';
  uploads: Upload[];
  videos: Upload[];
  generate: boolean | null;
  allowPaintedPeople: boolean;
  nameKo: string;
  nameEn: string;
  logo?: Upload;
  numbers: Array<{ value: string; unit: string; label: string }>;
  statement: string;
  contact: NonNullable<Brief['contact']>;
  chapters: Array<{ title: string; body: string }>;
  motion: MotionLevel | '';
  scene3d: Scene3d;
  sound: 'none' | 'ambient';
  audience: Q1Value | '';
  storage: Q2Value | '';
  integrations: string[];
}

const EMPTY: Draft = {
  industry: '',
  industryFree: '',
  ideaSentence: '',
  ideaScene: '',
  sceneType: '',
  goal: '',
  world: '',
  accent: '',
  accentSource: 'chip',
  moodYes: [],
  moodNo: [],
  refs: [],
  typePreset: '',
  uploads: [],
  videos: [],
  generate: null,
  allowPaintedPeople: true,
  nameKo: '',
  nameEn: '',
  numbers: [
    { value: '', unit: '', label: '' },
    { value: '', unit: '', label: '' },
    { value: '', unit: '', label: '' },
  ],
  statement: '',
  contact: {},
  chapters: [
    { title: '', body: '' },
    { title: '', body: '' },
    { title: '', body: '' },
  ],
  motion: '',
  scene3d: 'none',
  sound: 'none',
  audience: '',
  storage: '',
  integrations: [],
};

const STORAGE_KEY = 'coralred.deepBrief.v2';

function toBrief(d: Draft): Partial<Brief> {
  return {
    industry: d.industry,
    industryFree: d.industryFree || undefined,
    idea: { sentence: d.ideaSentence, scene: d.ideaScene, sceneType: d.sceneType as SceneType },
    goal: d.goal || undefined,
    world: { styleLock: d.world as WorldId },
    palette: { accent: d.accent, source: d.accentSource },
    mood: { yes: d.moodYes, no: d.moodNo },
    refs: d.refs.filter((r) => r.url.trim()),
    type: d.typePreset ? { preset: d.typePreset } : undefined,
    media: {
      uploads: d.uploads,
      videos: d.videos,
      generate: d.generate === true,
      allowPaintedPeople: d.allowPaintedPeople,
    },
    brand: { nameKo: d.nameKo, nameEn: d.nameEn || undefined, logo: d.logo },
    proof: {
      numbers: d.numbers
        .filter((n) => n.value.trim() && n.label.trim())
        .map((n) => ({
          value: Number(n.value.replace(/[^0-9.]/g, '')) || 0,
          unit: n.unit.trim(),
          label: n.label.trim(),
        })),
    },
    copy: { statement: d.statement },
    contact: Object.fromEntries(Object.entries(d.contact).filter(([, v]) => v && v.trim())),
    chapters: d.chapters.filter((c) => c.title.trim() && c.body.trim()),
    motion: { level: d.motion as MotionLevel },
    scene3d: d.scene3d,
    sound: d.sound,
    app: { audience: d.audience as Q1Value, storage: d.storage as Q2Value, integrations: d.integrations },
  };
}

/*
 * ---------------------------------------------------------------------------
 * 문항 정의 — id · 챕터 · 필수 · 질문 · "이 답은 → ○○에 쓰입니다" · 기본값 문구(선택 문항)
 * ---------------------------------------------------------------------------
 */

type StepId =
  | 'A1'
  | 'A2'
  | 'A3'
  | 'A4'
  | 'B3'
  | 'B1'
  | 'B2'
  | 'B4'
  | 'B5'
  | 'C1'
  | 'C2'
  | 'C3'
  | 'C4'
  | 'D1'
  | 'D2'
  | 'D3'
  | 'D4'
  | 'E1'
  | 'E2'
  | 'E3'
  | 'F1'
  | 'F2'
  | 'F3'
  | 'G';

interface Step {
  id: StepId;
  chapter: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
  required: boolean;
  title: string;
  uses: string;
  defaultLabel?: (d: Draft) => string;
  done: (d: Draft) => boolean;
}

const CHAPTERS: Array<{ id: Step['chapter']; label: string }> = [
  { id: 'A', label: '정체' },
  { id: 'B', label: '세계관' },
  { id: 'C', label: '재료' },
  { id: 'D', label: '증거·카피' },
  { id: 'E', label: '연출' },
  { id: 'F', label: '기능' },
  { id: 'G', label: '확인' },
];

const STEPS: Step[] = [
  {
    id: 'A1',
    chapter: 'A',
    required: true,
    title: '무엇을 하는 곳인가요?',
    uses: '샷리스트 기본값 · 산업 모티프 · 세계관 후보',
    done: (d) => !!d.industry,
  },
  {
    id: 'A2',
    chapter: 'A',
    required: true,
    title: '손님이 당신 가게를 한 문장으로 말한다면 뭐라고 할까요?',
    uses: '히어로 헤드라인 원문 · 선언문 재료',
    done: (d) => d.ideaSentence.trim().length > 0,
  },
  {
    id: 'A3',
    chapter: 'A',
    required: true,
    title: '그 문장을 한 장면으로 그린다면, 무엇이 보이나요?',
    uses: '히어로 이미지·영상 프롬프트의 주어 · 원형 결정',
    done: (d) => d.ideaScene.trim().length > 0 && !!d.sceneType,
  },
  {
    id: 'A4',
    chapter: 'A',
    required: false,
    title: '이 사이트가 딱 하나만 해야 한다면?',
    uses: 'CTA 문구·위치 · 연락 섹션 구성',
    defaultLabel: () => '문의·상담',
    done: (d) => !!d.goal,
  },
  {
    id: 'B3',
    chapter: 'B',
    required: true,
    title: '느낌을 세 단어로. 그리고 절대 아닌 세 단어.',
    uses: '카피 톤 · 서체 프리셋 · 프롬프트 형용사 · 세계관 추천',
    done: (d) => d.moodYes.length >= 1,
  },
  {
    id: 'B1',
    chapter: 'B',
    required: true,
    title: '어떤 세계관이 마음에 드나요?',
    uses: '이미지·영상 STYLE_LOCK · 인물 허용 여부 · 트리트먼트 · 원형',
    done: (d) => !!d.world,
  },
  {
    id: 'B2',
    chapter: 'B',
    required: true,
    title: '색은 하나만 고르세요.',
    uses: '--accent · 듀오톤·하이라이트 · CTA (라이트/다크는 세계관이 정합니다)',
    done: (d) => /^#[0-9a-f]{6}$/i.test(d.accent),
  },
  {
    id: 'B4',
    chapter: 'B',
    required: false,
    title: '좋아하는 사이트·인스타·영상 링크를 붙여 주세요. 몇 개든.',
    uses: '원형 보정 · 모션 강도 기본값',
    defaultLabel: () => '없음',
    done: (d) => d.refs.some((r) => r.url.trim()),
  },
  {
    id: 'B5',
    chapter: 'B',
    required: false,
    title: '글자 분위기는요?',
    uses: '킷 서체 프리셋 · 상호 워드마크',
    defaultLabel: (d) => `세계관·무드에서 자동 (${autoTypeLabel(d)})`,
    done: (d) => !!d.typePreset,
  },
  {
    id: 'C1',
    chapter: 'C',
    required: true,
    title: '사진을 올려 주세요. 이 4장이 있으면 가장 좋아요.',
    uses: '히어로·챕터 슬롯 (등급 A·B는 사용, C는 증거 썸네일만)',
    done: () => true,
  },
  {
    id: 'C2',
    chapter: 'C',
    required: true,
    title: '비어 있는 칸은 우리가 만들어 드릴까요?',
    uses: '생성 슬롯 결정 · 프롬프트 인물 절',
    done: (d) => d.generate !== null,
  },
  {
    id: 'C3',
    chapter: 'C',
    required: true,
    title: '상호를 알려 주세요. 로고가 없으면 글자로 만들어요.',
    uses: '내비 로고 · 푸터 워드마크',
    done: (d) => d.nameKo.trim().length > 0,
  },
  {
    id: 'C4',
    chapter: 'C',
    required: false,
    title: '영상이 있나요? 5초짜리 폰 영상도 좋아요.',
    uses: '히어로 루프 후보 (없으면 Seedance 생성)',
    defaultLabel: () => '없음 → 히어로 루프 생성',
    done: (d) => d.videos.length > 0,
  },
  {
    id: 'D1',
    chapter: 'D',
    required: false,
    title: '자랑할 수 있는 숫자가 있나요? 최대 3개.',
    uses: 'BigNumber 섹션 (없으면 섹션 자체가 안 나옵니다 — 가짜 숫자 금지)',
    defaultLabel: () => '숫자 섹션 없음',
    done: (d) => d.numbers.filter((n) => n.value.trim() && n.label.trim()).length >= 1,
  },
  {
    id: 'D2',
    chapter: 'D',
    required: true,
    title: '손님에게 꼭 하고 싶은 말 한 문장.',
    uses: '선언문 섹션 (다듬기만 하고 뜻은 유지)',
    done: (d) => d.statement.trim().length > 0,
  },
  {
    id: 'D3',
    chapter: 'D',
    required: true,
    title: '연락·위치·시간.',
    uses: 'Contact 섹션 (비어 있는 행은 안 나옵니다)',
    done: (d) => Object.values(d.contact).some((v) => v && v.trim()),
  },
  {
    id: 'D4',
    chapter: 'D',
    required: false,
    title: '챕터로 보여줄 이야기 3개.',
    uses: '핀 챕터 텍스트 · 챕터 이미지 프롬프트 주어',
    defaultLabel: (d) => `장면·업종에서 자동 (${defaultChapterTitles(d)})`,
    done: (d) => d.chapters.some((c) => c.title.trim() && c.body.trim()),
  },
  {
    id: 'E1',
    chapter: 'E',
    required: true,
    title: '움직임은 어느 정도?',
    uses: '핀 챕터·마퀴·스냅·프리로더·커서 on/off',
    done: (d) => !!d.motion,
  },
  {
    id: 'E2',
    chapter: 'E',
    required: false,
    title: '3D 장면을 넣을까요?',
    uses: '킷 3D 씬 (영화 모드에서만)',
    defaultLabel: () => '없음',
    done: (d) => d.scene3d !== 'none',
  },
  {
    id: 'E3',
    chapter: 'E',
    required: false,
    title: '소리를 켤까요?',
    uses: '"sound on" 토글 UI',
    defaultLabel: () => '없음',
    done: (d) => d.sound === 'ambient',
  },
  {
    id: 'F1',
    chapter: 'F',
    required: true,
    title: '누가 쓰나요?',
    uses: '기존 perspective 지시문',
    done: (d) => !!d.audience,
  },
  {
    id: 'F2',
    chapter: 'F',
    required: true,
    title: '데이터를 저장할까요?',
    uses: '기존 storage 지시문',
    done: (d) => !!d.storage,
  },
  {
    id: 'F3',
    chapter: 'F',
    required: false,
    title: '필요한 연동이 있나요?',
    uses: '수요조사 (DB 저장만)',
    defaultLabel: () => '없음',
    done: (d) => d.integrations.length > 0,
  },
  { id: 'G', chapter: 'G', required: true, title: '이렇게 만들게요', uses: 'Direction Sheet 확정', done: () => true },
];

function autoTypeLabel(d: Draft): string {
  if (d.moodYes.includes('고전적')) {
    return '세리프 강조';
  }

  if (d.moodYes.includes('대담한') || /헬스|운동/.test(d.industry)) {
    return '컴팩트';
  }

  const preset = d.world ? getWorld(d.world).typePreset : 'grotesk';

  return TYPE_LABELS[preset];
}

function defaultChapterTitles(d: Draft): string {
  const base = pickShotList(d.industry || '기타');

  return ['재료', '공간', '만나는 곳']
    .map((t, i) => `${t}: ${[base.ch1, base.ch2, base.ch3][i].slice(0, 14)}…`)
    .join(' / ');
}

const TYPE_LABELS: Record<TypePreset, string> = { grotesk: '그로테스크', serif: '세리프 강조', compact: '컴팩트' };

const ACCENT_CHIPS = [
  '#ff5330',
  '#b45309',
  '#c2410c',
  '#7c2d12',
  '#a16207',
  '#166534',
  '#0f766e',
  '#1d4ed8',
  '#1e3a8a',
  '#6d28d9',
  '#be185d',
  '#111111',
];

const IDEA_EXAMPLES = [
  '매일 새벽 네 시에 굽는 소금빵집',
  '예약이 두 달 밀린 동네 미용실',
  '설계도 한 장에 30일을 쓰는 건축 사무소',
  '한 번 오면 삼 년을 다니는 필라테스',
  '재료 원산지를 다 적어 두는 초밥집',
];

const SCENE_EXAMPLES = [
  '새벽 어둠 속 오븐 불빛과 김이 오르는 빵',
  '햇빛이 비스듬히 드는 빈 거울과 가위 한 자루',
  '흰 벽에 걸린 도면과 나무 모형 하나',
];

const STATEMENT_EXAMPLES = [
  '빵집 하나가 동네를 바꾸진 않습니다. 아침은 바꿉니다.',
  '자르기 전에 한 번 더 봅니다.',
  '오래 걸리는 데는 이유가 있습니다.',
];

const SCENE3D_BY_WORLD: Record<WorldId, Scene3d[]> = {
  'photo-editorial': ['shader-hero', 'particle-stream'],
  'neoclassical-painting': ['marble-hall'],
  'watercolor-illustration': [],
  'product-3d': ['orbit-object', 'glass-cluster'],
  'mono-brutal': ['type-glitch'],
  'ink-graphic-novel': ['type-glitch'],
};

const SCENE3D_LABELS: Record<Scene3d, string> = {
  none: '없음',
  'glass-cluster': '유리 오브젝트',
  'particle-stream': '파티클 스트림',
  'type-glitch': '3D 타이포',
  'marble-hall': '대리석 홀',
  'orbit-object': '궤도 오브젝트',
  'shader-hero': '셰이더 히어로',
};

const SLOT_LABELS: Record<'hero' | 'ch1' | 'ch2' | 'ch3', string> = {
  hero: '히어로',
  ch1: '챕터 1',
  ch2: '챕터 2',
  ch3: '챕터 3',
};

// ---------------------------------------------------------------------------

export interface DeepBriefProps {
  onComplete: (sheet: DirectionSheet) => void;
}

export function DeepBrief({ onComplete }: DeepBriefProps) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [index, setIndex] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const screenRef = useRef<HTMLDivElement>(null);
  const step = STEPS[index];

  // 자동 저장 — 새로고침해도 이어서. 업로드 object URL 은 살아남지 못하므로 url 을 비운 채 저장한다.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);

      if (raw) {
        const saved = JSON.parse(raw) as { draft: Draft; index: number };
        setDraft({ ...EMPTY, ...saved.draft });
        setIndex(Math.min(saved.index, STEPS.length - 1));
      }
    } catch {
      /* 저장본 없음/깨짐 → 처음부터 */
    }

    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    try {
      const persisted: Draft = {
        ...draft,
        uploads: draft.uploads.map((u) => ({ ...u, url: u.url.startsWith('blob:') ? '' : u.url })),
        videos: draft.videos.map((u) => ({ ...u, url: u.url.startsWith('blob:') ? '' : u.url })),
        logo: draft.logo ? { ...draft.logo, url: draft.logo.url.startsWith('blob:') ? '' : draft.logo.url } : undefined,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ draft: persisted, index }));
    } catch {
      /* 프라이빗 모드 등 */
    }
  }, [draft, index, hydrated]);

  const patch = useCallback((p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p })), []);
  const goTo = useCallback((id: StepId) => {
    setIndex(STEPS.findIndex((s) => s.id === id));
    screenRef.current?.scrollTo({ top: 0 });
  }, []);
  const next = () => {
    setIndex((i) => Math.min(i + 1, STEPS.length - 1));
    screenRef.current?.scrollTo({ top: 0 });
  };
  const back = () => {
    setIndex((i) => Math.max(i - 1, 0));
    screenRef.current?.scrollTo({ top: 0 });
  };

  const canNext = step.required ? step.done(draft) : true;
  const progress = index / (STEPS.length - 1);
  const chapterDone = (c: Step['chapter']) =>
    STEPS.filter((s) => s.chapter === c && s.required).every((s) => s.done(draft));

  return (
    <div className={styles.screen} ref={screenRef}>
      <header className={styles.top}>
        <div className={styles.topInner}>
          {CHAPTERS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={classNames(
                styles.chapterPill,
                step.chapter === c.id && styles.chapterPillActive,
                step.chapter !== c.id && chapterDone(c.id) && styles.chapterPillDone,
              )}
              onClick={() => goTo(STEPS.find((s) => s.chapter === c.id)!.id)}
            >
              {c.id} {c.label}
            </button>
          ))}
        </div>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      </header>

      <main className={styles.content} key={step.id}>
        <p className={styles.stepNo}>
          {step.id} · {step.required ? '필수' : '선택'}
        </p>
        <h1 className={styles.question}>{step.title}</h1>
        <p className={styles.uses}>
          이 답은 → <strong>{step.uses}</strong>에 쓰입니다
        </p>

        {step.id === 'G' ? (
          <Summary draft={draft} goTo={goTo} onComplete={onComplete} />
        ) : (
          <StepBody id={step.id} draft={draft} patch={patch} />
        )}
      </main>

      {step.id !== 'G' && (
        <nav className={styles.nav}>
          <div className={styles.navInner}>
            <button type="button" className={styles.back} onClick={back} disabled={index === 0}>
              ← 이전
            </button>
            {!step.required && step.defaultLabel && !step.done(draft) && (
              <button type="button" className={styles.skip} onClick={next}>
                건너뛰기 — 기본값: {step.defaultLabel(draft)}
              </button>
            )}
            <button
              type="button"
              className={styles.next}
              onClick={next}
              disabled={!canNext}
              style={{ marginLeft: step.required || step.done(draft) ? 'auto' : undefined }}
            >
              다음
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}

/*
 * ---------------------------------------------------------------------------
 * 문항 본문
 * ---------------------------------------------------------------------------
 */

function StepBody({ id, draft, patch }: { id: StepId; draft: Draft; patch: (p: Partial<Draft>) => void }) {
  switch (id) {
    case 'A1':
      return <StepIndustry draft={draft} patch={patch} />;
    case 'A2':
      return (
        <TextStep
          value={draft.ideaSentence}
          onChange={(v) => patch({ ideaSentence: v })}
          max={120}
          rows={2}
          placeholder="예: 매일 새벽 네 시에 굽는 소금빵집"
          examples={IDEA_EXAMPLES}
          hint="남이 하는 말입니다. 이 문장이 사이트 전체의 '아이디어 하나'가 됩니다."
        />
      );
    case 'A3':
      return (
        <>
          <TextStep
            value={draft.ideaScene}
            onChange={(v) => patch({ ideaScene: v })}
            max={160}
            rows={3}
            placeholder="사람 말고 사물·공간·빛으로. 예: 새벽 어둠 속 오븐 불빛과 김이 오르는 빵"
            examples={SCENE_EXAMPLES}
          />
          <p className={styles.sectionLabel}>장면 유형</p>
          <div className={styles.grid3}>
            {(Object.keys(SCENE_TYPE_LABELS) as SceneType[]).map((t) => (
              <Option key={t} active={draft.sceneType === t} onClick={() => patch({ sceneType: t })}>
                {SCENE_TYPE_LABELS[t]}
              </Option>
            ))}
          </div>
        </>
      );
    case 'A4':
      return (
        <div className={styles.grid2}>
          {(Object.keys(GOAL_CTA) as Goal[]).map((g) => (
            <Option key={g} active={draft.goal === g} onClick={() => patch({ goal: draft.goal === g ? '' : g })}>
              {GOAL_LABELS[g]}
              <small>CTA: {GOAL_CTA[g]}</small>
            </Option>
          ))}
        </div>
      );
    case 'B3':
      return <StepMood draft={draft} patch={patch} />;
    case 'B1':
      return <StepWorld draft={draft} patch={patch} />;
    case 'B2':
      return <StepAccent draft={draft} patch={patch} />;
    case 'B4':
      return <StepRefs draft={draft} patch={patch} />;
    case 'B5':
      return <StepType draft={draft} patch={patch} />;
    case 'C1':
      return <StepUploads draft={draft} patch={patch} />;
    case 'C2':
      return <StepGenerate draft={draft} patch={patch} />;
    case 'C3':
      return <StepBrand draft={draft} patch={patch} />;
    case 'C4':
      return <StepVideos draft={draft} patch={patch} />;
    case 'D1':
      return <StepNumbers draft={draft} patch={patch} />;
    case 'D2':
      return (
        <TextStep
          value={draft.statement}
          onChange={(v) => patch({ statement: v })}
          max={80}
          rows={2}
          placeholder="내가 하는 말입니다. A2(남이 하는 말)와 다르게."
          examples={STATEMENT_EXAMPLES}
        />
      );
    case 'D3':
      return <StepContact draft={draft} patch={patch} />;
    case 'D4':
      return <StepChapters draft={draft} patch={patch} />;
    case 'E1':
      return (
        <div className={styles.options}>
          {(
            [
              ['quiet', '조용', '글자 리빌만. 스냅 없음. 핀 챕터 없음.'],
              ['normal', '보통', '핀 챕터 + 마퀴 + 프리로더. 수상작 중앙값.'],
              ['cinema', '영화', '스크롤 시퀀스 + 셰이더 히어로 + 스냅 + 커스텀 커서.'],
            ] as Array<[MotionLevel, string, string]>
          ).map(([v, label, desc]) => (
            <Option key={v} active={draft.motion === v} onClick={() => patch({ motion: v })}>
              {label}
              <small>{desc}</small>
            </Option>
          ))}
        </div>
      );
    case 'E2': {
      const allowed = draft.world ? SCENE3D_BY_WORLD[draft.world] : [];

      if (draft.motion !== 'cinema') {
        return <p className={styles.hint}>3D 장면은 움직임을 "영화"로 골랐을 때만 들어갑니다. 건너뛰어도 됩니다.</p>;
      }

      if (!allowed.length) {
        return (
          <p className={styles.hint}>
            {getWorld(draft.world as WorldId).label} 세계관에는 어울리는 3D 장면이 없습니다. 건너뛰세요.
          </p>
        );
      }

      return (
        <div className={styles.grid2}>
          {(['none', ...allowed] as Scene3d[]).map((s) => (
            <Option key={s} active={draft.scene3d === s} onClick={() => patch({ scene3d: s })}>
              {SCENE3D_LABELS[s]}
            </Option>
          ))}
        </div>
      );
    }
    case 'E3':
      return (
        <div className={styles.grid2}>
          <Option active={draft.sound === 'none'} onClick={() => patch({ sound: 'none' })}>
            없음
          </Option>
          <Option active={draft.sound === 'ambient'} onClick={() => patch({ sound: 'ambient' })}>
            앰비언트
            <small>클릭 후 재생. "sound on" 토글이 생깁니다.</small>
          </Option>
        </div>
      );
    case 'F1':
      return (
        <div className={styles.options}>
          {Q1_OPTIONS.map((o) => (
            <Option key={o.id} active={draft.audience === o.id} onClick={() => patch({ audience: o.id })}>
              {o.label}
            </Option>
          ))}
        </div>
      );
    case 'F2':
      return (
        <div className={styles.options}>
          {Q2_OPTIONS.map((o) => (
            <Option key={o.id} active={draft.storage === o.id} onClick={() => patch({ storage: o.id })}>
              {o.label}
            </Option>
          ))}
        </div>
      );
    case 'F3':
      return (
        <div className={styles.chips}>
          {Q4_CATEGORIES.map((c) => {
            const on = draft.integrations.includes(c.id);

            return (
              <button
                key={c.id}
                type="button"
                className={classNames(styles.chip, on && styles.chipYes)}
                onClick={() =>
                  patch({
                    integrations: on ? draft.integrations.filter((x) => x !== c.id) : [...draft.integrations, c.id],
                  })
                }
              >
                {c.label}
              </button>
            );
          })}
        </div>
      );
    default:
      return null;
  }
}

const GOAL_LABELS: Record<Goal, string> = {
  call: '전화·예약',
  visit: '방문·길찾기',
  buy: '구매',
  inquiry: '문의·상담',
  portfolio: '포트폴리오 감상',
  hire: '채용',
};

function Option({ children, active, onClick }: { children: ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={classNames(styles.optionButton, active && styles.optionButtonActive)}
      onClick={onClick}
      aria-pressed={active}
    >
      <span>{children}</span>
      {active && <span aria-hidden="true">✓</span>}
    </button>
  );
}

function TextStep({
  value,
  onChange,
  max,
  rows,
  placeholder,
  examples,
  hint,
}: {
  value: string;
  onChange: (v: string) => void;
  max: number;
  rows: number;
  placeholder: string;
  examples?: string[];
  hint?: string;
}) {
  return (
    <>
      {hint && <p className={styles.hint}>{hint}</p>}
      {examples && (
        <div className={styles.examples}>
          {examples.map((e) => (
            <button key={e} type="button" className={styles.exampleChip} onClick={() => onChange(e)}>
              {e}
            </button>
          ))}
        </div>
      )}
      <textarea
        className={styles.textarea}
        value={value}
        rows={rows}
        maxLength={max}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className={styles.counter}>
        {value.length} / {max}
      </p>
    </>
  );
}

// --- A1 업종 ---
function StepIndustry({ draft, patch }: { draft: Draft; patch: (p: Partial<Draft>) => void }) {
  const custom = draft.industry && !Q3_GRID.some((g) => g.label === draft.industry);

  return (
    <>
      <div className={styles.grid2}>
        {Q3_GRID.map((g) => (
          <Option
            key={g.id}
            active={draft.industry === g.label}
            onClick={() => patch({ industry: g.label, industryFree: '' })}
          >
            {g.label}
          </Option>
        ))}
      </div>
      <p className={styles.sectionLabel}>또는 직접 입력 (20자)</p>
      <input
        className={styles.input}
        value={custom ? draft.industry : draft.industryFree}
        maxLength={20}
        placeholder="예: 동네 소금빵집"
        onChange={(e) => patch({ industry: e.target.value, industryFree: e.target.value })}
      />
    </>
  );
}

// --- B3 무드 ---
function StepMood({ draft, patch }: { draft: Draft; patch: (p: Partial<Draft>) => void }) {
  const [customYes, setCustomYes] = useState('');
  const [customNo, setCustomNo] = useState('');
  const toggle = (list: 'moodYes' | 'moodNo', chip: string) => {
    const other = list === 'moodYes' ? 'moodNo' : 'moodYes';
    const has = draft[list].includes(chip);

    if (has) {
      patch({ [list]: draft[list].filter((c) => c !== chip) } as Partial<Draft>);
    } else if (draft[list].length < 3) {
      patch({ [list]: [...draft[list], chip], [other]: draft[other].filter((c) => c !== chip) } as Partial<Draft>);
    }
  };
  const chips = Array.from(new Set([...MOOD_CHIPS, ...draft.moodYes, ...draft.moodNo]));

  return (
    <>
      <p className={styles.sectionLabel}>이런 느낌 ({draft.moodYes.length}/3)</p>
      <div className={styles.chips}>
        {chips.map((c) => (
          <button
            key={c}
            type="button"
            className={classNames(styles.chip, draft.moodYes.includes(c) && styles.chipYes)}
            disabled={!draft.moodYes.includes(c) && draft.moodYes.length >= 3}
            onClick={() => toggle('moodYes', c)}
          >
            {c}
          </button>
        ))}
        <input
          className={styles.input}
          style={{ width: 160, padding: '6px 12px', fontSize: 14 }}
          value={customYes}
          placeholder="직접 입력 후 Enter"
          onChange={(e) => setCustomYes(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && customYes.trim()) {
              toggle('moodYes', customYes.trim());
              setCustomYes('');
            }
          }}
        />
      </div>
      <p className={styles.sectionLabel}>절대 아닌 느낌 ({draft.moodNo.length}/3)</p>
      <div className={styles.chips}>
        {chips.map((c) => (
          <button
            key={c}
            type="button"
            className={classNames(styles.chip, draft.moodNo.includes(c) && styles.chipNo)}
            disabled={!draft.moodNo.includes(c) && draft.moodNo.length >= 3}
            onClick={() => toggle('moodNo', c)}
          >
            {c}
          </button>
        ))}
        <input
          className={styles.input}
          style={{ width: 160, padding: '6px 12px', fontSize: 14 }}
          value={customNo}
          placeholder="직접 입력 후 Enter"
          onChange={(e) => setCustomNo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && customNo.trim()) {
              toggle('moodNo', customNo.trim());
              setCustomNo('');
            }
          }}
        />
      </div>
    </>
  );
}

// --- B1 세계관 카드(개인화 상위 3 + 접힌 3) ---
function StepWorld({ draft, patch }: { draft: Draft; patch: (p: Partial<Draft>) => void }) {
  const [showAll, setShowAll] = useState(false);
  const top = useMemo(
    () =>
      pickTopWorlds({
        industry: draft.industry,
        industryFree: draft.industryFree || undefined,
        idea: {
          sentence: draft.ideaSentence,
          scene: draft.ideaScene,
          sceneType: (draft.sceneType || 'object') as SceneType,
        },
        goal: draft.goal || undefined,
        mood: { yes: draft.moodYes, no: draft.moodNo },
      }),
    [
      draft.industry,
      draft.industryFree,
      draft.ideaSentence,
      draft.ideaScene,
      draft.sceneType,
      draft.goal,
      draft.moodYes,
      draft.moodNo,
    ],
  );
  const rest = WORLDS.map((w) => w.id).filter((id) => !top.includes(id));
  const visible = showAll || (draft.world && rest.includes(draft.world)) ? [...top, ...rest] : top;

  return (
    <>
      <p className={styles.hint}>
        {draft.moodYes.join('·')} 느낌과 "{draft.ideaScene.slice(0, 24)}
        {draft.ideaScene.length > 24 ? '…' : ''}" 장면에 맞춰 세 세계관을 먼저 골랐습니다. 카드는 같은 가상의 빵집을 각
        세계관으로 렌더한 실제 생성물입니다.
      </p>
      <div className={styles.worldGrid}>
        {visible.map((id, i) => {
          const world = getWorld(id);
          const card = WORLD_CARDS[id];
          const dark = card.ink === 'dark';

          return (
            <button
              key={id}
              type="button"
              className={classNames(styles.worldCard, draft.world === id && styles.worldCardActive)}
              onClick={() => patch({ world: id })}
              aria-pressed={draft.world === id}
            >
              <img src={card.still} alt="" loading="lazy" />
              {card.video && <video src={card.video} poster={card.still} autoPlay muted loop playsInline />}
              <div className={classNames(styles.worldShade, dark && styles.worldShadeDark)} />
              {i < 3 && !showAll && <span className={styles.worldBadge}>추천 {i + 1}</span>}
              <div className={classNames(styles.worldText, dark && styles.worldInkDark)}>
                <span className={styles.worldLabel}>
                  {world.label} · {world.reference.split(' ')[0]}
                </span>
                <span className={styles.worldHeadline}>{card.headline}</span>
              </div>
            </button>
          );
        })}
      </div>
      {!showAll && rest.length > 0 && (
        <button type="button" className={styles.worldMore} onClick={() => setShowAll(true)}>
          다른 세계관 {rest.length}개 더 보기
        </button>
      )}
    </>
  );
}

// --- B2 색 ---
function StepAccent({ draft, patch }: { draft: Draft; patch: (p: Partial<Draft>) => void }) {
  const [hex, setHex] = useState(draft.accent);
  const [fromPhoto, setFromPhoto] = useState<string[]>([]);
  const firstUpload = draft.uploads.find((u) => u.url);

  const extract = async () => {
    if (!firstUpload) {
      return;
    }

    try {
      setFromPhoto(await dominantColors(firstUpload.url));
    } catch {
      setFromPhoto([]);
    }
  };

  return (
    <>
      <div className={styles.swatches}>
        {ACCENT_CHIPS.map((c) => (
          <button
            key={c}
            type="button"
            className={classNames(styles.swatch, draft.accent === c && styles.swatchActive)}
            style={{ background: c }}
            aria-label={c}
            onClick={() => {
              patch({ accent: c, accentSource: 'chip' });
              setHex(c);
            }}
          />
        ))}
      </div>

      {firstUpload && (
        <>
          <p className={styles.sectionLabel}>사진에서 뽑기</p>
          <div className={styles.chips}>
            <button type="button" className={styles.chip} onClick={extract}>
              첫 사진에서 색 3개 제안
            </button>
            {fromPhoto.map((c) => (
              <button
                key={c}
                type="button"
                className={classNames(styles.swatch, draft.accent === c && styles.swatchActive)}
                style={{ background: c, width: 40, aspectRatio: '1' }}
                aria-label={c}
                onClick={() => {
                  patch({ accent: c, accentSource: 'photo' });
                  setHex(c);
                }}
              />
            ))}
          </div>
        </>
      )}

      <p className={styles.sectionLabel}>직접 HEX</p>
      <input
        className={styles.input}
        value={hex}
        placeholder="#b45309"
        maxLength={7}
        onChange={(e) => {
          const v = e.target.value.trim();
          setHex(v);

          if (/^#[0-9a-f]{6}$/i.test(v)) {
            patch({ accent: v.toLowerCase(), accentSource: 'hex' });
          }
        }}
      />

      {/^#[0-9a-f]{6}$/i.test(draft.accent) && (
        <div className={styles.accentPreview}>
          <span className={styles.accentDot} style={{ background: draft.accent }} />
          <div>
            <div style={{ fontSize: 13, color: '#6e645b' }}>강조색 {draft.accent}</div>
            <div style={{ fontSize: 12, color: '#8b7e70' }}>
              라이트/다크는 {draft.world ? getWorld(draft.world).label : '세계관'}이 정합니다
            </div>
          </div>
          <span className={styles.accentCta} style={{ background: draft.accent, marginLeft: 'auto' }}>
            {GOAL_CTA[draft.goal || 'inquiry']}
          </span>
        </div>
      )}
    </>
  );
}

/** 첫 업로드에서 채도 높은 색 3개 — 64px로 축소해 12단계 양자화, 채도×빈도 순. */
async function dominantColors(url: string): Promise<string[]> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = url;
  });
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;

  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return [];
  }

  ctx.drawImage(img, 0, 0, 64, 64);

  const { data } = ctx.getImageData(0, 0, 64, 64);
  const bins = new Map<string, { r: number; g: number; b: number; n: number; sat: number }>();

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max ? (max - min) / max : 0;

    if (sat < 0.25 || max < 40) {
      continue;
    }

    const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
    const bin = bins.get(key) ?? { r: 0, g: 0, b: 0, n: 0, sat: 0 };
    bin.r += r;
    bin.g += g;
    bin.b += b;
    bin.n++;
    bin.sat += sat;
    bins.set(key, bin);
  }

  return [...bins.values()]
    .sort((a, b) => b.n * (b.sat / b.n) - a.n * (a.sat / a.n))
    .slice(0, 3)
    .map((bin) => {
      const to = (v: number) =>
        Math.round(v / bin.n)
          .toString(16)
          .padStart(2, '0');

      return `#${to(bin.r)}${to(bin.g)}${to(bin.b)}`;
    });
}

// --- B4 레퍼런스 ---
function StepRefs({ draft, patch }: { draft: Draft; patch: (p: Partial<Draft>) => void }) {
  const rows = draft.refs.length ? draft.refs : [{ url: '', liked: [] as RefLike[] }];
  const setRow = (i: number, row: { url: string; liked: RefLike[] }) => {
    const nextRows = [...rows];
    nextRows[i] = row;
    patch({ refs: nextRows });
  };
  const LIKES: Array<[RefLike, string]> = [
    ['color', '색'],
    ['motion', '움직임'],
    ['photo', '사진'],
    ['type', '글자'],
    ['mood', '분위기'],
  ];

  return (
    <div className={styles.rows}>
      {rows.map((row, i) => (
        <div key={i} className={styles.rows}>
          <input
            className={styles.input}
            value={row.url}
            placeholder="https://"
            onChange={(e) => setRow(i, { ...row, url: e.target.value })}
          />
          {row.url.trim() && (
            <div className={styles.chips}>
              <span className={styles.hint} style={{ margin: 0, alignSelf: 'center' }}>
                여기서 뭐가 좋았나요?
              </span>
              {LIKES.map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  className={classNames(styles.chip, styles.chipSmall, row.liked.includes(k) && styles.chipYes)}
                  onClick={() =>
                    setRow(i, {
                      ...row,
                      liked: row.liked.includes(k) ? row.liked.filter((x) => x !== k) : [...row.liked, k],
                    })
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
      <button
        type="button"
        className={styles.exampleChip}
        style={{ alignSelf: 'flex-start' }}
        onClick={() => patch({ refs: [...rows, { url: '', liked: [] }] })}
      >
        + 링크 추가
      </button>
    </div>
  );
}

// --- B5 서체 ---
function StepType({ draft, patch }: { draft: Draft; patch: (p: Partial<Draft>) => void }) {
  const sample = draft.ideaSentence.trim() || '매일 새벽 네 시에\n굽는 소금빵집';
  const cards: Array<[TypePreset, string, string]> = [
    ['grotesk', styles.typeGrotesk, 'Pretendard · 수상작 기본형'],
    ['serif', styles.typeSerif, 'Noto Serif KR · 회화·고전'],
    ['compact', styles.typeCompact, 'Wanted Sans · 대담·브루탈'],
  ];

  return (
    <div className={styles.grid3}>
      {cards.map(([preset, cls, note]) => (
        <button
          key={preset}
          type="button"
          className={classNames(styles.typeCard, draft.typePreset === preset && styles.typeCardActive)}
          onClick={() => patch({ typePreset: draft.typePreset === preset ? '' : preset })}
        >
          <div className={classNames(styles.typeSample, cls)}>{sample}</div>
          <span>
            {TYPE_LABELS[preset]} · {note}
          </span>
        </button>
      ))}
    </div>
  );
}

// --- C1 사진 업로드 + 등급 ---
function StepUploads({ draft, patch }: { draft: Draft; patch: (p: Partial<Draft>) => void }) {
  const shots = pickShotList(draft.industry || '기타');
  const [busy, setBusy] = useState(0);
  const uploadsRef = useRef(draft.uploads);
  uploadsRef.current = draft.uploads;

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) {
      return;
    }

    setBusy((n) => n + files.length);

    for (const file of Array.from(files)) {
      const verdict = await gradePhotoFile(file);
      const upload: Upload = {
        id: `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        url: URL.createObjectURL(file),
        grade: verdict.grade,
        metrics: verdict.metrics,
      };
      (upload as Upload & { reason?: string; tip?: string }).reason = verdict.reason;
      (upload as Upload & { reason?: string; tip?: string }).tip = verdict.tip;
      patch({ uploads: [...uploadsRef.current, upload] });
      setBusy((n) => n - 1);
    }
  };

  return (
    <>
      <div className={styles.slots}>
        {(Object.keys(SLOT_LABELS) as Array<keyof typeof SLOT_LABELS>).map((slot) => {
          const filled = draft.uploads.filter((u) => u.slot === slot && u.grade !== 'C').length;

          return (
            <div key={slot} className={styles.slotFrame}>
              <strong>
                {SLOT_LABELS[slot]} {filled ? `· ${filled}장` : ''}
              </strong>
              <small>{shots[slot]}</small>
              <small>팁: 창가 자연광, 배경 비우기, 피사체 1~2개</small>
            </div>
          );
        })}
      </div>

      <label className={styles.uploadButton}>
        {busy ? `등급 매기는 중… (${busy})` : '사진 올리기 (여러 장 가능)'}
        <input type="file" accept="image/*" multiple onChange={(e) => onFiles(e.target.files)} />
      </label>

      {draft.uploads.length > 0 && (
        <div className={styles.uploads}>
          {draft.uploads.map((u) => {
            const extra = u as Upload & { reason?: string; tip?: string };

            return (
              <div key={u.id} className={styles.upload}>
                {u.url ? (
                  <img src={u.url} alt="" />
                ) : (
                  <div
                    style={{
                      aspectRatio: '4 / 3',
                      background: '#efe4d6',
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: 12,
                    }}
                  >
                    새로고침으로 미리보기가 사라졌어요
                  </div>
                )}
                <span className={classNames(styles.gradeTag, styles[`grade${u.grade}`])}>등급 {u.grade}</span>
                <small>
                  {extra.reason ||
                    (u.grade === 'A' ? '그대로 씁니다' : u.grade === 'B' ? '트리트먼트로 씁니다' : '증거 썸네일만')}
                  {extra.tip ? ` · ${extra.tip}` : ''}
                </small>
                <select
                  value={u.slot || ''}
                  disabled={u.grade === 'C'}
                  onChange={(e) =>
                    patch({
                      uploads: draft.uploads.map((x) =>
                        x.id === u.id ? { ...x, slot: (e.target.value || undefined) as Upload['slot'] } : x,
                      ),
                    })
                  }
                >
                  <option value="">칸 자동</option>
                  {(Object.keys(SLOT_LABELS) as Array<keyof typeof SLOT_LABELS>).map((s) => (
                    <option key={s} value={s}>
                      {SLOT_LABELS[s]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={styles.removeButton}
                  onClick={() => patch({ uploads: draft.uploads.filter((x) => x.id !== u.id) })}
                >
                  빼기
                </button>
              </div>
            );
          })}
        </div>
      )}
      <p className={styles.hint} style={{ marginTop: 16 }}>
        올리지 않아도 됩니다. 빈 칸은 다음 질문에서 정합니다.
      </p>
    </>
  );
}

// --- C2 생성 여부 ---
function StepGenerate({ draft, patch }: { draft: Draft; patch: (p: Partial<Draft>) => void }) {
  const world = draft.world ? getWorld(draft.world) : null;
  const card = draft.world ? WORLD_CARDS[draft.world] : null;
  const empty = 4 - draft.uploads.filter((u) => u.grade !== 'C').length;

  return (
    <>
      {card && (
        <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid #efe4d6', marginBottom: 16 }}>
          <img
            src={card.still}
            alt=""
            style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', display: 'block' }}
          />
        </div>
      )}
      <p className={styles.hint}>
        {world?.label ?? '고른 세계관'}으로 이 가게를 이렇게 그립니다. 빈 칸 {Math.max(0, empty)}개.{' '}
        {world?.peoplePolicy === 'painted-only'
          ? '회화·일러스트 세계관이라 그림 속 인물은 넣을 수 있습니다.'
          : '실사 인물은 만들지 않습니다(사물·공간·빛만).'}
      </p>
      <div className={styles.yesNo}>
        <Option active={draft.generate === true} onClick={() => patch({ generate: true })}>
          네, 만들어 주세요
        </Option>
        <Option active={draft.generate === false} onClick={() => patch({ generate: false })}>
          아니요, 있는 사진만
        </Option>
      </div>
      {world?.peoplePolicy === 'painted-only' && (
        <label className={styles.toggleRow}>
          <input
            type="checkbox"
            checked={draft.allowPaintedPeople}
            onChange={(e) => patch({ allowPaintedPeople: e.target.checked })}
          />
          그림 속 인물 허용
        </label>
      )}
    </>
  );
}

// --- C3 상호·로고 ---
function StepBrand({ draft, patch }: { draft: Draft; patch: (p: Partial<Draft>) => void }) {
  return (
    <div className={styles.rows}>
      <input
        className={styles.input}
        value={draft.nameKo}
        placeholder="상호 (한글)"
        onChange={(e) => patch({ nameKo: e.target.value })}
      />
      <input
        className={styles.input}
        value={draft.nameEn}
        placeholder="영문 표기 (선택 — 있으면 워드마크는 영문 우선)"
        onChange={(e) => patch({ nameEn: e.target.value })}
      />
      <label className={styles.uploadButton} style={{ margin: '4px 0 0', alignSelf: 'flex-start' }}>
        {draft.logo ? '로고 바꾸기' : '로고 올리기 (SVG/PNG, 선택)'}
        <input
          type="file"
          accept="image/svg+xml,image/png"
          onChange={(e) => {
            const file = e.target.files?.[0];

            if (file) {
              patch({ logo: { id: `logo-${Date.now().toString(36)}`, url: URL.createObjectURL(file), grade: 'A' } });
            }
          }}
        />
      </label>
      {draft.logo?.url && <img src={draft.logo.url} alt="" style={{ maxHeight: 64, alignSelf: 'flex-start' }} />}
    </div>
  );
}

// --- C4 영상 ---
function StepVideos({ draft, patch }: { draft: Draft; patch: (p: Partial<Draft>) => void }) {
  return (
    <div className={styles.rows}>
      <label className={styles.uploadButton} style={{ margin: 0, alignSelf: 'flex-start' }}>
        영상 올리기 (mp4/mov)
        <input
          type="file"
          accept="video/mp4,video/quicktime"
          multiple
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            patch({
              videos: [
                ...draft.videos,
                ...files.map((f) => ({
                  id: `v-${Date.now().toString(36)}-${f.name}`,
                  url: URL.createObjectURL(f),
                  grade: 'A' as const,
                })),
              ],
            });
          }}
        />
      </label>
      {draft.videos.map((v) => (
        <div key={v.id} className={styles.chips}>
          {v.url ? (
            <video src={v.url} muted loop autoPlay playsInline style={{ width: 200, borderRadius: 12 }} />
          ) : (
            <span>{v.id}</span>
          )}
          <button
            type="button"
            className={styles.removeButton}
            onClick={() => patch({ videos: draft.videos.filter((x) => x.id !== v.id) })}
          >
            빼기
          </button>
        </div>
      ))}
    </div>
  );
}

// --- D1 숫자 ---
function StepNumbers({ draft, patch }: { draft: Draft; patch: (p: Partial<Draft>) => void }) {
  const set = (i: number, k: 'value' | 'unit' | 'label', v: string) => {
    const numbers = draft.numbers.map((n, j) => (j === i ? { ...n, [k]: v } : n));
    patch({ numbers });
  };

  return (
    <div className={styles.rows}>
      <p className={styles.hint}>예: 200 / 개 / 하루에 굽는 빵 · 14 / 시간 / 발효 · 2011 / 년 / 부터</p>
      {draft.numbers.map((n, i) => (
        <div key={i} className={styles.row}>
          <input
            className={styles.input}
            value={n.value}
            placeholder="숫자"
            inputMode="decimal"
            onChange={(e) => set(i, 'value', e.target.value)}
          />
          <input
            className={styles.input}
            value={n.unit}
            placeholder="단위"
            onChange={(e) => set(i, 'unit', e.target.value)}
          />
          <input
            className={styles.input}
            value={n.label}
            placeholder="라벨"
            onChange={(e) => set(i, 'label', e.target.value)}
          />
        </div>
      ))}
    </div>
  );
}

// --- D3 연락처 ---
function StepContact({ draft, patch }: { draft: Draft; patch: (p: Partial<Draft>) => void }) {
  const FIELDS: Array<[keyof Draft['contact'], string, string]> = [
    ['address', '주소', '서울 마포구 …'],
    ['phone', '전화', '02-000-0000'],
    ['hours', '운영시간', '08:00–20:00'],
    ['closed', '휴무', '매주 월요일'],
    ['instagram', '인스타그램', '@handle'],
    ['kakao', '카카오 채널', '채널 이름 또는 링크'],
    ['parking', '주차', '건물 뒤 3대'],
  ];

  return (
    <div className={styles.rows}>
      {FIELDS.map(([k, label, ph]) => (
        <div key={k} className={classNames(styles.row, styles.rowContact)}>
          <label htmlFor={`contact-${k}`}>{label}</label>
          <input
            id={`contact-${k}`}
            className={styles.input}
            value={draft.contact[k] || ''}
            placeholder={ph}
            onChange={(e) => patch({ contact: { ...draft.contact, [k]: e.target.value } })}
          />
        </div>
      ))}
    </div>
  );
}

// --- D4 챕터 ---
function StepChapters({ draft, patch }: { draft: Draft; patch: (p: Partial<Draft>) => void }) {
  const set = (i: number, k: 'title' | 'body', v: string) =>
    patch({ chapters: draft.chapters.map((c, j) => (j === i ? { ...c, [k]: v } : c)) });

  return (
    <div className={styles.rows}>
      <p className={styles.hint}>
        "재료 / 발효 / 굽기"처럼 제목(12자) + 한 줄(60자). 비우면 장면·업종에서 자동으로 채웁니다.
      </p>
      {draft.chapters.map((c, i) => (
        <div key={i} className={styles.row} style={{ gridTemplateColumns: '1fr 2fr' }}>
          <input
            className={styles.input}
            value={c.title}
            maxLength={12}
            placeholder={`챕터 ${i + 1} 제목`}
            onChange={(e) => set(i, 'title', e.target.value)}
          />
          <input
            className={styles.input}
            value={c.body}
            maxLength={60}
            placeholder="한 줄"
            onChange={(e) => set(i, 'body', e.target.value)}
          />
        </div>
      ))}
    </div>
  );
}

/*
 * ---------------------------------------------------------------------------
 * G 요약 — 원형·팔레트·서체 샘플·히어로 장면·슬롯표·예상 비용. 항목 클릭 → 해당 챕터.
 * ---------------------------------------------------------------------------
 */

const MISSING_STEP: Record<string, StepId> = {
  industry: 'A1',
  'idea.sentence': 'A2',
  'idea.scene': 'A3',
  'idea.sceneType': 'A3',
  'world.styleLock': 'B1',
  'palette.accent': 'B2',
  'mood.yes': 'B3',
  'media.uploads': 'C1',
  'media.generate': 'C2',
  'brand.nameKo': 'C3',
  'copy.statement': 'D2',
  contact: 'D3',
  'motion.level': 'E1',
  'app.audience': 'F1',
  'app.storage': 'F2',
};

const MISSING_LABEL: Record<string, string> = {
  industry: '업종',
  'idea.sentence': '한 문장',
  'idea.scene': '장면',
  'idea.sceneType': '장면 유형',
  'world.styleLock': '세계관',
  'palette.accent': '색',
  'mood.yes': '느낌 단어',
  'media.uploads': '사진',
  'media.generate': '빈 칸 생성 여부',
  'brand.nameKo': '상호',
  'copy.statement': '하고 싶은 말',
  contact: '연락처',
  'motion.level': '움직임',
  'app.audience': '누가 쓰나요',
  'app.storage': '데이터 저장',
};

function Summary({
  draft,
  goTo,
  onComplete,
}: {
  draft: Draft;
  goTo: (id: StepId) => void;
  onComplete: (s: DirectionSheet) => void;
}) {
  const partial = toBrief(draft);
  const missing = validateBrief(partial);

  if (missing.length) {
    return (
      <div className={styles.missing}>
        <strong>아직 비어 있는 답이 있어요</strong>
        {missing.map((m) => (
          <button key={m} type="button" onClick={() => goTo(MISSING_STEP[m] || 'A1')}>
            {MISSING_LABEL[m] || m} → {MISSING_STEP[m] || 'A1'}
          </button>
        ))}
      </div>
    );
  }

  const sheet = buildDirectionSheet(partial as Brief);
  const { decided } = sheet;
  const world = getWorld(sheet.brief.world.styleLock);
  const typeClass =
    decided.typePreset === 'serif'
      ? styles.typeSerif
      : decided.typePreset === 'compact'
        ? styles.typeCompact
        : styles.typeGrotesk;

  return (
    <div className={styles.summary}>
      <SummaryCard onClick={() => goTo('B1')}>
        <h3>원형 · 세계관 · 테마</h3>
        <p>
          {ARCHETYPE_LABELS[decided.archetype]} · {world.label} · {decided.theme === 'dark' ? '다크' : '라이트'}
        </p>
      </SummaryCard>

      <SummaryCard onClick={() => goTo('B5')}>
        <h3>서체 · 강조색</h3>
        <div className={classNames(styles.typeSample, typeClass)} style={{ fontSize: 30 }}>
          {decided.copy.headlineSource}
        </div>
        <p style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className={styles.accentDot} style={{ background: decided.accentHex, width: 24, height: 24 }} />
          {decided.accentHex} · {TYPE_LABELS[decided.typePreset]}
        </p>
      </SummaryCard>

      <SummaryCard onClick={() => goTo('A3')}>
        <h3>히어로 장면</h3>
        <p>{decided.copy.sub}</p>
        <p style={{ fontSize: 13, color: '#6e645b' }}>
          {decided.video.source === 'seedance'
            ? `히어로 ${decided.video.mode === 'sequence' ? '스크롤 시퀀스(60프레임)' : '루프 영상'} 생성`
            : decided.video.source === 'upload'
              ? '올린 영상을 히어로 루프로'
              : '영상 없음(조용)'}
          {decided.peoplePolicy === 'painted-only' ? ' · 그림 인물 허용' : ' · 인물 없음'}
        </p>
      </SummaryCard>

      <SummaryCard onClick={() => goTo('C1')}>
        <h3>슬롯</h3>
        <table className={styles.summaryTable}>
          <tbody>
            {decided.shotList.map((s) => (
              <tr key={s.slot}>
                <th>{SLOT_LABELS[s.slot as keyof typeof SLOT_LABELS] ?? s.slot}</th>
                <td>
                  {s.source === 'upload'
                    ? `올린 사진${s.treatment !== 'none' ? ` + ${s.treatment}` : ''}`
                    : s.source === 'generate'
                      ? '생성'
                      : '비움'}
                  <span style={{ display: 'block', fontSize: 12, color: '#8b7e70' }}>{s.prompt.slice(0, 60)}…</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SummaryCard>

      <SummaryCard onClick={() => goTo('D2')}>
        <h3>섹션 · 카피</h3>
        <p>{decided.sections.join(' → ')}</p>
        <p>
          "{decided.copy.statement}" · CTA "{decided.copy.cta}"
        </p>
        <p style={{ fontSize: 13, color: '#6e645b' }}>챕터: {decided.copy.chapters.map((c) => c.title).join(' / ')}</p>
      </SummaryCard>

      <SummaryCard onClick={() => goTo('E1')}>
        <h3>연출 · 예상</h3>
        <p>
          움직임 {MOTION_LABELS[sheet.brief.motion.level]}
          {decided.kit.scene3d ? ` · 3D ${SCENE3D_LABELS[decided.kit.scene3d]}` : ''}
          {decided.kit.soundToggle ? ' · 소리' : ''}
        </p>
        <p>
          이미지 {decided.estimate.images}장 · 영상 {decided.estimate.videos}개 · 약 ${decided.estimate.usd.toFixed(2)}{' '}
          · {Math.ceil(decided.estimate.seconds / 60)}분
        </p>
      </SummaryCard>

      <button
        type="button"
        className={styles.next}
        style={{ minHeight: 56, fontSize: 17 }}
        onClick={() => onComplete(sheet)}
      >
        만들기
      </button>
    </div>
  );
}

/** 요약 카드 — 안에 표가 들어가므로 button 이 아니라 div(role=button). 클릭·Enter·Space 로 해당 챕터로. */
function SummaryCard({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      className={styles.summaryCard}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {children}
    </div>
  );
}

const ARCHETYPE_LABELS: Record<DirectionSheet['decided']['archetype'], string> = {
  'product-story': '제품 스토리',
  'light-editorial': '라이트 에디토리얼',
  'brutal-grid': '브루탈 그리드',
  'agency-showcase': '에이전시 쇼케이스',
  'painted-sequence': '회화 시퀀스',
  'illustrated-archive': '일러스트 아카이브',
  'graphic-novel': '그래픽 노블',
  'typo-editorial': '타이포 에디토리얼',
};

const MOTION_LABELS: Record<MotionLevel, string> = { quiet: '조용', normal: '보통', cinema: '영화' };
