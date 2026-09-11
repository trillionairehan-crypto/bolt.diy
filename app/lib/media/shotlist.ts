/**
 * 업종별 샷리스트 — 이미지 4장(히어로·챕터 3)의 피사체와 히어로 영상의 움직임 지시. 서버(이미지 세트 프롬프트)와
 * 클라이언트(영상 프롬프트) 둘 다 쓰므로 .server 밖에 둔다. 업종 문자열은 온보딩 격자 라벨 또는 직접 입력 원문이라
 * 키워드 매칭으로 고른다. 없으면 generic.
 *
 * 사용자 판정(2026-09-11): 생성형 인물은 어색하다 — 모든 샷은 사물·제품·공간만. 사람·손 없음. 히어로는
 * wearebrand.io 식 "제품이 공중에 떠 있는 초현실 오브젝트 샷"과 "공간 와이드 샷" 두 결 중 업종에 맞는 쪽.
 */

export interface ShotList {
  hero: string;
  ch1: string;
  ch2: string;
  ch3: string;

  /** 히어로 5초 루프 영상의 움직임 — 카메라는 항상 고정, 피사체만 미세하게. */
  motion: string;
}

const SHOTLISTS: Record<string, ShotList> = {
  food: {
    hero: 'Signature product as a hero object: a few pieces arranged on a rustic wooden board, suspended in soft warm light against a clean plaster wall, crumbs and steam, nothing else in frame.',
    ch1: 'Extreme close-up of the signature item — crust texture, butter layers, crumb — on a textured surface, shallow depth of field.',
    ch2: 'Empty seating area with two or three tables, one cup and plate in the foreground, soft daylight through a window.',
    ch3: 'Entrance or storefront seen from slightly outside, door half open, warm light spilling out, no people.',
    motion: 'Steam rising slowly from the product, light flickering softly through a window, crumbs perfectly still.',
  },
  beauty: {
    hero: 'Styling tools and a product bottle arranged as a still life on a stone surface, soft studio light, one accent flower.',
    ch1: 'Close-up of product texture — cream, oil, or a brush tip — on a neutral surface, shallow depth of field.',
    ch2: 'Empty salon interior: mirror, chair, and shelf in soft daylight, tidy.',
    ch3: 'Reception desk or entrance with fresh flowers, welcoming and calm, no people.',
    motion: 'Light shifting softly across the mirror, a flower petal trembling, a fabric edge moving slightly.',
  },
  education: {
    hero: 'Open notebook, pen, and a stack of books on a wooden desk by a window, morning light, nothing else.',
    ch1: 'Close-up of pencil marks on paper or a tablet with notes, paper texture visible.',
    ch2: 'Empty classroom or study room with desks and a window, tidy and calm.',
    ch3: 'Bookshelf or entrance hallway with warm lighting, inviting, no people.',
    motion: 'A page lifting slowly in a breeze, sunlight moving across the desk, dust in the light beam.',
  },
  fitness: {
    hero: 'Kettlebell, rolled mat, and towel arranged on a studio floor, dramatic side light, empty and ready.',
    ch1: 'Close-up of equipment texture — knurled bar, chalk, mat surface — shallow depth of field.',
    ch2: 'Empty studio space with mats or racks in rows, light rays through windows.',
    ch3: 'Reception or locker area with towels and water bottles, clean and welcoming, no people.',
    motion: 'Light rays shifting slowly, chalk dust drifting, a towel edge swaying.',
  },
  clinic: {
    hero: 'Calm clinic reception still life: plant, neutral ceramics, soft daylight on a clean counter.',
    ch1: 'Close-up of clean instruments or a consultation desk, orderly and precise.',
    ch2: 'Empty treatment room with a bed and window, calm and spotless.',
    ch3: 'Waiting area with comfortable chairs and a plant, warm afternoon light, no people.',
    motion: 'Curtains moving gently, light shifting on the floor, a plant leaf swaying.',
  },
  retail: {
    hero: 'Signature product floating as a hero object against a soft gradient backdrop, dramatic studio light, subtle shadow below.',
    ch1: 'Close-up of the product material — fabric weave, leather grain, glass — shallow depth of field.',
    ch2: 'Shop interior: products on shelves and a display table, warm spot lighting, no people.',
    ch3: 'Storefront window from outside at dusk, interior lights glowing.',
    motion: 'Light glinting slowly across the product, a gentle drift as if floating, ambient glow.',
  },
  space: {
    hero: 'Wide architectural shot of the space — living room, studio, or office — large windows and daylight, empty.',
    ch1: 'Close-up of a material detail: wood grain, stone, fabric, or a door handle.',
    ch2: 'Another room seen through a doorway, layered depth, soft light.',
    ch3: 'The building entrance or facade in late afternoon light.',
    motion: 'Sunlight sliding slowly across the floor, a curtain moving in a breeze, tree shadows shifting outside.',
  },
  freelance: {
    hero: 'Tools of the craft arranged as a still life — camera, sketchbook, keyboard, or brushes — on a desk by a window.',
    ch1: 'Close-up of the craft in progress: a sketch, a screen with work, a lens — no hands.',
    ch2: 'Finished work displayed on a wall or table, viewed at an angle, soft light.',
    ch3: 'A meeting corner with two chairs and a notebook, calm and welcoming, empty.',
    motion: 'Light changing softly on the desk, a page corner lifting, a plant leaf swaying.',
  },
  generic: {
    hero: 'The signature product or object as a still life in soft directional light, clean backdrop, nothing else.',
    ch1: 'Extreme close-up detail of the product or material, shallow depth of field.',
    ch2: 'The space customers experience — interior, seating, tools, or workspace, mid-distance, empty.',
    ch3: 'A welcoming closing image — entrance, storefront, table setting, or a finished result, no people.',
    motion: 'Subtle ambient motion only: gentle light shift, soft steam or dust, slight fabric or leaf movement.',
  },
};

const KEYWORDS: Array<[RegExp, keyof typeof SHOTLISTS]> = [
  [/카페|커피|빵|베이커리|음식|식당|레스토랑|디저트|주점|바|cafe|bakery|restaurant|food/i, 'food'],
  [/미용|헤어|네일|뷰티|피부|살롱|왁싱|메이크업|salon|beauty|nail/i, 'beauty'],
  [/학원|교육|과외|공부방|스터디|어학|academy|tutor|school/i, 'education'],
  [/헬스|운동|필라테스|요가|체육|크로스핏|트레이닝|gym|fitness|yoga|pilates/i, 'fitness'],
  [/병원|의원|치과|한의원|클리닉|약국|clinic|dental|hospital/i, 'clinic'],
  [/쇼핑|판매|스토어|편집숍|잡화|소품|꽃집|플라워|shop|store|retail|flower/i, 'retail'],
  [/부동산|공간|스튜디오|공방|사무실|인테리어|숙소|펜션|estate|studio|space|interior/i, 'space'],
  [/프리랜서|디자이너|사진|작가|영상|개발자|컨설|서비스|freelance|designer|photograph/i, 'freelance'],
];

export function pickShotList(industry: string): ShotList {
  for (const [regex, key] of KEYWORDS) {
    if (regex.test(industry)) {
      return SHOTLISTS[key];
    }
  }

  return SHOTLISTS.generic;
}

/** 히어로 영상 프롬프트 — 루프 이음새를 위해 시작·끝 상태가 같도록, 카메라 고정, 사람 없음. */
export function buildLoopMotionPrompt(industry: string): string {
  const { motion } = pickShotList(industry);

  return `${motion} Camera completely locked, no zoom, no pan, no cuts. The last frame returns to the exact starting state so the clip loops seamlessly. Silent, no people, no text, photorealistic.`;
}
