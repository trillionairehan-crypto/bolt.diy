/**
 * 세계관(스타일 락) 6종 — 딥 브리프 B1 "어떤 세계관이 마음에 드나요?"의 선택지이자, 이미지·영상 프롬프트에 그대로 붙는
 * 고정 문자열. 서버(이미지 세트)와 클라이언트(영상 프롬프트·쇼룸) 둘 다 쓰므로 .server 밖에 둔다.
 *
 * 근거: CSSDA 수상작 90개 실측 + 릴스 7개 식별(2026-09-11). 각 세계관은 실제 상위 수상작 하나를 기준으로 삼는다.
 * 인물 정책(2026-09-11 사용자 결정): 실사 인물은 사용자 사진만. 생성 인물은 회화·일러스트 세계관에서만, 얼굴 클로즈업 없이.
 */

export type WorldId =
  | 'photo-editorial'
  | 'neoclassical-painting'
  | 'watercolor-illustration'
  | 'product-3d'
  | 'mono-brutal'
  | 'mono-color';

export type PeoplePolicy = 'none' | 'painted-only';

export interface World {
  id: WorldId;

  /** 브리프 카드 제목(한글) */
  label: string;

  /** 카드 부제 — 기준 수상작 */
  reference: string;
  theme: 'light' | 'dark';
  peoplePolicy: PeoplePolicy;

  /** 서체 프리셋 기본값 */
  typePreset: 'grotesk' | 'serif' | 'compact';

  /** 이미지 프롬프트 뒤에 붙는 스타일 락 — accentHex 로 색 힌트만 바뀐다 */
  styleLock: (accentHex: string) => string;

  /** 히어로 5초 영상의 움직임 지시(카메라 고정) */
  motion: string;

  /** 사용자 B등급 사진에 기본 적용할 트리트먼트 */
  treatment: 'none' | 'mono' | 'duotone' | 'halftone' | 'grain' | 'blur' | 'detail' | 'circle';
}

const NO_PEOPLE = 'No people, no faces, no hands, no body parts anywhere in the frame.';
const NO_TEXT = 'No text, no letters, no signs, no logos, no watermarks, no frame or border.';
const HEADLINE_ROOM = 'Composition leaves clean negative space in the upper-left third for a headline.';

export const WORLDS: World[] = [
  {
    id: 'photo-editorial',
    label: '실사 에디토리얼',
    reference: 'Lidar Drone Scanning 8.87 · Noho 8.83',
    theme: 'light',
    peoplePolicy: 'none',
    typePreset: 'grotesk',
    styleLock: (accent) =>
      [
        'Editorial still-life photography, one cohesive series, shot on medium format with a 80mm lens.',
        `Color grading: warm neutral base, a single accent hue close to ${accent}, low saturation, no neon.`,
        'Lighting: soft directional window light from the left, bright and airy, gentle long shadows, no flash.',
        'Texture: fine film grain, matte surfaces, shallow depth of field on the subject only.',
        NO_PEOPLE,
        NO_TEXT,
        HEADLINE_ROOM,
      ].join(' '),
    motion:
      'Steam or dust drifting slowly in the light beam, sunlight sliding a few centimeters across the surface, everything else perfectly still.',
    treatment: 'grain',
  },
  {
    id: 'neoclassical-painting',
    label: '신고전주의 회화',
    reference: 'Pear (pear.no) · Awwwards HM, Design 9.3',
    theme: 'light',
    peoplePolicy: 'painted-only',
    typePreset: 'serif',
    styleLock: (accent) =>
      [
        'Neoclassical oil painting in the manner of Jacques-Louis David and Ingres: smooth glazed brushwork, warm ochre and umber flesh tones, deep ultramarine sky, gilded details, dramatic chiaroscuro from the upper left, faint canvas texture and craquelure.',
        `One accent pigment close to ${accent} used sparingly on drapery or a single object.`,
        'Figures, if any, are painted, never photographic; shown at medium distance with faces turned three-quarter or away and hands simplified.',
        NO_TEXT,
        HEADLINE_ROOM,
      ].join(' '),
    motion:
      'Animate as a living painting: figures move slowly and gracefully, fabric and leaves sway gently, golden light drifts across marble. Keep the painted brushwork, glazed surfaces and craquelure identical in every frame; no photorealism.',
    treatment: 'none',
  },
  {
    id: 'watercolor-illustration',
    label: '수채 일러스트',
    reference: '100 Lost Species 9.67 (WOTM)',
    theme: 'light',
    peoplePolicy: 'painted-only',
    typePreset: 'serif',
    styleLock: (accent) =>
      [
        'Loose watercolor illustration on cold-pressed paper: wet-on-wet bleeds, granulating pigment, visible paper grain, generous white paper left untouched around the subject.',
        `Limited palette: warm greys and ochres with one accent close to ${accent}; edges soft, a few precise ink-fine details.`,
        'Figures, if any, are illustrated at small scale, faces suggested with two strokes, never photographic.',
        NO_TEXT,
        'The subject floats on white paper with no background scene; leaves room for a headline.',
      ].join(' '),
    motion:
      'The watercolor breathes: pigment blooms spread a little, paper grain shimmers, the subject sways as if the sheet is gently lifted. Paper stays white, no new objects appear.',
    treatment: 'none',
  },
  {
    id: 'product-3d',
    label: '제품 오브젝트 3D',
    reference: 'The Watch 8.93 · NOTA 8.67 · Wembi 9.23',
    theme: 'light',
    peoplePolicy: 'none',
    typePreset: 'grotesk',
    styleLock: (accent) =>
      [
        'Photoreal 3D product render, octane-style: the single hero object floats centered in an infinite soft-grey studio with a faint gradient, one large softbox from above-left, crisp specular highlights, subtle contact shadow below.',
        `Materials exaggerated and tactile (glossy, matte, metallic as appropriate); one accent color close to ${accent} on a backdrop gradient or a single surface.`,
        'Nothing else in frame, no props, no environment.',
        NO_PEOPLE,
        NO_TEXT,
        HEADLINE_ROOM,
      ].join(' '),
    motion:
      'The object rotates slowly a quarter turn and drifts as if floating, specular highlights sliding across its surface, backdrop gradient breathing; camera locked.',
    treatment: 'detail',
  },
  {
    id: 'mono-brutal',
    label: '흑백 브루탈',
    reference: 'Aspen Search 8.83 · HACKFIRST 8.7 · MONOLOG 8.67',
    theme: 'light',
    peoplePolicy: 'none',
    typePreset: 'compact',
    styleLock: (accent) =>
      [
        'High-contrast black-and-white photograph with coarse halftone dot texture, as if printed in a newspaper: deep blacks, blown highlights, grain, hard flash light.',
        `Absolutely monochrome except one flat spot color close to ${accent} on a single small element.`,
        'Frontal or top-down composition, geometric, lots of empty black or white area.',
        NO_PEOPLE,
        NO_TEXT,
        HEADLINE_ROOM,
      ].join(' '),
    motion:
      'Halftone grain crawls subtly, the flash light flickers once, the spot-color element pulses gently; harsh cuts to black are not allowed.',
    treatment: 'halftone',
  },
  {
    id: 'mono-color',
    label: '단색 컬러 월드',
    reference: '/zeroz 8.67 · Volt 8.77 · Orgnzm 8.67',
    theme: 'dark',
    peoplePolicy: 'none',
    typePreset: 'grotesk',
    styleLock: (accent) =>
      [
        `An entire world rendered in one hue: every surface, the backdrop, the light and the object are shades and tints of ${accent}, from near-black to near-white of that same hue.`,
        'Glossy 3D-like surfaces, soft volumetric glow, floating geometric shapes and the hero object suspended in the color field.',
        NO_PEOPLE,
        NO_TEXT,
        HEADLINE_ROOM,
      ].join(' '),
    motion:
      'Shapes and the hero object drift and rotate slowly in the color field, volumetric glow pulses, a soft particle haze moves; camera locked.',
    treatment: 'duotone',
  },
];

export function getWorld(id: WorldId): World {
  const world = WORLDS.find((w) => w.id === id);

  if (!world) {
    throw new Error(`unknown world: ${id}`);
  }

  return world;
}

/** 히어로 영상 프롬프트 — 세계관 모션 + 카메라 고정 + 루프 이음새 지시. */
export function buildWorldMotionPrompt(world: World, loop = true): string {
  return [
    world.motion,
    'Camera completely locked, no zoom, no pan, no cuts.',
    loop
      ? 'The last frame returns to the exact starting state so the clip loops seamlessly.'
      : 'Slow and stately, one continuous take.',
    'Silent, no text.',
    world.peoplePolicy === 'none' ? 'No people.' : '',
  ]
    .filter(Boolean)
    .join(' ');
}
