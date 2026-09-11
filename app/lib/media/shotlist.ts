/**
 * 업종별 샷리스트 — 이미지 4장(히어로·챕터 3)의 피사체와 히어로 영상의 움직임 지시. 서버(이미지 세트 프롬프트)와
 * 클라이언트(영상 프롬프트) 둘 다 쓰므로 .server 밖에 둔다. 업종 문자열은 온보딩 격자 라벨 또는 직접 입력 원문이라
 * 키워드 매칭으로 고른다. 없으면 generic.
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
    hero: 'Wide shot of the counter or open kitchen at golden hour, fresh products in the foreground, warm light from a window.',
    ch1: 'Close-up of hands at work on the signature item — dough, coffee pour, plating — shallow depth of field.',
    ch2: 'The seating area with two or three tables, one cup or plate in the foreground, soft daylight.',
    ch3: 'The entrance or storefront seen from slightly outside, door half open, warm light spilling out.',
    motion:
      'Steam rising slowly from the food or cup, light flickering softly through the window, a hand moving gently in the background.',
  },
  beauty: {
    hero: 'Wide shot of a bright salon interior, mirror and styling chair in the foreground, soft daylight.',
    ch1: 'Close-up of hands styling hair or doing nails, tools in focus, shallow depth of field.',
    ch2: 'Product shelf or treatment room, neat arrangement, one accent object in the foreground.',
    ch3: 'Reception desk or entrance with fresh flowers, welcoming and calm.',
    motion: 'Fabric or hair moving slightly, light shifting softly across the mirror, a hand adjusting a tool.',
  },
  education: {
    hero: 'Wide shot of a bright classroom or study space, desks and a window, morning light.',
    ch1: 'Close-up of hands writing or a tablet with notes, pencil and paper texture.',
    ch2: 'A small group at a table mid-discussion, seen from behind, faces not visible.',
    ch3: 'Bookshelf or entrance hallway with warm lighting, tidy and inviting.',
    motion: 'A page turning slowly, sunlight moving across the desk, dust in the light beam.',
  },
  fitness: {
    hero: 'Wide shot of a gym or studio floor with equipment, dramatic side light, empty and ready.',
    ch1: 'Close-up of hands gripping a bar or a foot on a mat, chalk or texture visible.',
    ch2: 'Studio space with mats or racks in rows, one person mid-movement in the distance, back to camera.',
    ch3: 'Reception or locker area with towels and water, clean and welcoming.',
    motion: 'Slow breathing movement of a person in the background, light rays shifting, a towel swaying slightly.',
  },
  clinic: {
    hero: 'Wide shot of a calm clinic reception, soft neutral tones, plants and daylight.',
    ch1: 'Close-up of clean instruments or a consultation desk, orderly and precise.',
    ch2: 'A treatment room with a bed and window, calm and spotless.',
    ch3: 'Waiting area with comfortable chairs and a plant, warm afternoon light.',
    motion: 'Curtains moving gently, light shifting on the floor, a plant leaf swaying.',
  },
  retail: {
    hero: 'Wide shot of the shop interior with products displayed on shelves and tables, warm spot lighting.',
    ch1: 'Close-up of the signature product on a textured surface, shallow depth of field.',
    ch2: 'A display table or rack seen at an angle, a few products arranged with space between them.',
    ch3: 'Storefront window from outside at dusk, interior lights glowing.',
    motion: 'Light glinting slowly across the products, a price tag or fabric moving slightly, ambient glow.',
  },
  space: {
    hero: 'Wide architectural shot of the space — living room, studio, or office — with large windows and daylight.',
    ch1: 'Close-up of a material detail: wood grain, stone, fabric, or a door handle.',
    ch2: 'Another room seen through a doorway, layered depth, soft light.',
    ch3: 'The building entrance or facade in late afternoon light.',
    motion: 'Sunlight sliding slowly across the floor, curtain moving in a breeze, tree shadows shifting outside.',
  },
  freelance: {
    hero: 'Wide shot of a creative workspace — desk, monitor or tools, window light, tidy and personal.',
    ch1: 'Close-up of hands at work on the craft: sketching, editing, camera, or keyboard.',
    ch2: 'Finished work displayed on the wall or a table, viewed at an angle.',
    ch3: 'A meeting corner with two chairs and a notebook, calm and welcoming.',
    motion: 'Cursor blinking or pen moving slightly, light changing softly on the desk, a plant leaf swaying.',
  },
  generic: {
    hero: 'Wide establishing shot that shows the place or the craft at its best moment, daylight.',
    ch1: 'Close-up detail of the signature product, service, or craft — hands at work or the product itself.',
    ch2: 'The space or atmosphere customers experience — interior, seating, tools, or workspace, mid-distance.',
    ch3: 'A welcoming closing image — entrance, storefront, table setting, or a finished result ready for a customer.',
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

/** 히어로 영상 프롬프트 — 루프 이음새를 위해 시작·끝 상태가 같도록, 카메라 고정. */
export function buildLoopMotionPrompt(industry: string): string {
  const { motion } = pickShotList(industry);

  return `${motion} Camera completely locked, no zoom, no pan, no cuts. The last frame returns to the exact starting state so the clip loops seamlessly. Silent, no text, no people looking at the camera, photorealistic.`;
}
