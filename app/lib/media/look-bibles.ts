/**
 * 룩 바이블 — 촬영감독(DP)·조명팀 문법을 규격으로. 세계관(무엇을 그리나) 위에 룩(어떻게 찍나)을 얹는다.
 * 사용자 지적(2026-09-11): "영화 촬영팀은 각도·조명 밝기·구도로 느낌을 살린다 — 느와르면 느와르답게, 럭셔리면 럭셔리답게."
 * 각 룩은 AD 브리프에 그대로 삽입되고, 심사 루브릭의 조명·그림자·광질 항목의 기준이 된다.
 *
 * 용어: 키(key) = 주광, 필(fill) = 보조광, 비율 = 키:필 밝기 차, 네거티브 필 = 검은 판으로 반사광을 빼 그림자를 깊게,
 * 프랙티컬 = 화면 안에 보이는 광원(촛불·창·스탠드), 롤오프 = 하이라이트가 흰색으로 날아가는 방식.
 */

export type LookId =
  | 'noir'
  | 'luxury'
  | 'documentary'
  | 'editorial-food'
  | 'brutal-flash'
  | 'chiaroscuro-painting'
  | 'pastoral-painting'
  | 'paper-studio';

export interface Look {
  id: LookId;
  label: string;

  /** 어떤 세계관·무드에서 기본으로 잡히나 */
  when: string;
  camera: string;
  light: string;
  composition: string;
  grade: string;

  /** Seedance 모션 지시에 붙는 카메라·빛의 시간적 행동 */
  motion: string;
  forbid: string;

  /** 참고한 실제 촬영 관행·작가(프롬프트에는 이름 대신 서술만 쓴다) */
  refs: string;
}

export const LOOKS: Look[] = [
  {
    id: 'noir',
    label: '느와르 로우키',
    when: '실사 + 무드 어두운/엄격한/깊은, 강조색 명도 낮음 (Cipher Digital·HACKFIRST 다크 변형)',
    camera: '50mm at f/2.8, camera slightly below subject eye-line (low angle, 5–10° up-tilt), tripod, no Dutch angle.',
    light:
      'Single hard key from 90° side, small source far away (sun through a window or a bare bulb), key:fill ratio 8:1 — the fill is only bounce off the far wall. Black negative fill on the opposite side so the shadow side goes to true black. One practical in frame allowed (a lamp, a candle) as a warm 2700K accent against a 4300K cool key. Thin haze so the key beam is visible. Hard-edged shadows with crisp geometry (blinds, mullions, a rack) falling across the subject.',
    composition:
      'Subject occupies one third; the rest is shadow. Foreground silhouette or object cut by the frame edge. Headline lives in the black area. Horizon low. Deliberate asymmetry.',
    grade:
      'Crushed blacks (nothing below 5% luminance is lifted), desaturated except one warm practical, highlights allowed to clip on the practical only, medium film grain, slight vignette.',
    motion:
      'Haze drifts through the key beam; the practical flickers once; the hard shadow geometry creeps a few centimetres as if a cloud passes. Camera locked.',
    forbid:
      'No flat frontal light, no fill from camera, no lifted milky blacks, no rim light halo, no wide-angle distortion.',
    refs: 'classic studio noir key-light discipline; contemporary dark tech sites (deep blacks, one warm accent).',
  },
  {
    id: 'luxury',
    label: '럭셔리 스펙큘러',
    when: '제품 오브젝트 3D, 실사 + 무드 매끈한/정확한/고급 (The Watch·NOTA·Heirest)',
    camera:
      '100mm macro or 135mm at f/8–f/11 for edge-to-edge sharpness on the object, camera at object height, compressed perspective, tripod.',
    light:
      'One very large soft source (2×3 m diffusion) placed above-behind the object for a long clean gradient highlight, plus one small hard kicker from the opposite rear to draw a razor specular edge along the silhouette. Black negative fill on both sides — reflections in glossy surfaces must be black-white-black stripes, never a room. Background is a separate light: a soft gradient from deep to mid, never flat. Key:fill 4:1.',
    composition:
      'Object off-centre on the lower-right third or floating with a real contact shadow (never both floating and shadowless). 60% of frame is quiet gradient for the headline. One material detail (grain, weave, brushed metal) visible at 100% crop.',
    grade:
      'Deep neutral blacks, controlled highlight roll-off (no clipping on the object), very low saturation background, object colours true, near-zero grain, no vignette.',
    motion:
      'The specular edge slides along the silhouette as if the light slowly pans 10°; the object rotates 5° at most; background gradient breathes. Camera locked.',
    forbid:
      'No busy props, no visible light sources reflected as blobs, no warm/cool mixed light, no dust or crumbs, no wide lens.',
    refs: 'watch and fragrance still-life discipline: large diffusion + hard kicker + negative fill.',
  },
  {
    id: 'documentary',
    label: '다큐 자연광',
    when: '실사 에디토리얼 기본 (Lidar·Noho·Cula), 공간·건축, 무드 정직한/따뜻한/느린',
    camera:
      '35mm or 50mm at f/2–f/4, handheld height (chest level) or tripod at table height, natural perspective, no tilt.',
    light:
      'One window as the only key, 45° to the subject, soft because the window is large and close. Fill is the room itself (white walls) — ratio about 3:1, shadows open but present. No added lights. Time of day chosen for angle: 8–10 a.m. low raking light for texture, overcast for product truth. Shadows must touch the objects (contact shadow) so nothing floats.',
    composition:
      'Rule of thirds, subject in the lower-right or lower-left third, foreground element (table edge, doorway, cloth) cut by the frame. Real clutter allowed but limited to three props. Upper-left third quiet for the headline.',
    grade:
      'Warm-neutral, blacks slightly lifted (film-like), highlights soft, gentle S-curve, fine grain, colours restrained and true.',
    motion:
      'Sunlight moves a few centimetres across the surface, dust or steam drifts in the beam, a curtain or leaf stirs once. Camera locked.',
    forbid:
      'No studio strobe look, no HDR glow, no perfectly even light, no centred symmetry, no smooth plastic surfaces.',
    refs: 'editorial interiors and food journalism: single-window discipline, honest shadows.',
  },
  {
    id: 'editorial-food',
    label: '에디토리얼 푸드',
    when: '식음 업종 실사, 제품이 음식일 때',
    camera:
      '90mm macro at f/4 for a single hero item or 50mm at f/5.6 for a table; camera at 30–45° above the table (never 90° top-down unless the world is brutal), tripod.',
    light:
      'Backlight-key: a soft window or 1×1 m diffusion behind and 45° to one side of the food so steam, crumbs and glaze rim-light; white fill card from the front at 2:1 to open the shadows. Small black flag to keep the front from going flat. Steam only if the food is actually hot in the story.',
    composition:
      'Hero item off-centre, one supporting prop (a cloth, a knife, a bowl), crumbs and a torn piece as evidence of a human. Surface texture (wood grain, linen, marble) fills the negative space. Headline room at the top.',
    grade:
      'Warm highlights, neutral shadows, saturation restrained (no orange push), micro-contrast on textures, light grain.',
    motion: 'Steam rises and thins, the rim light shimmers on the glaze, one crumb settles. Camera locked.',
    forbid:
      'No glossy varnish-like glaze, no perfectly uniform salt or seeds, no floating food, no packaging text, no centred plate.',
    refs: 'cookbook and food-magazine backlight discipline.',
  },
  {
    id: 'brutal-flash',
    label: '브루탈 온카메라 플래시',
    when: '흑백 브루탈 (Aspen·HACKFIRST·MONOLOG), 무드 대담한/거친/빠른',
    camera: '28mm or 35mm at f/8, camera straight-on or exact top-down, slightly overexposed, tripod or handheld.',
    light:
      'Direct on-camera flash as the only light: hard, frontal, short falloff so the background drops dark. Ratio 16:1. No fill. Specular hot spots allowed and clipped. Optional second hard light from behind for a white cut-out edge.',
    composition:
      'Frontal, graphic, centred is allowed here; flat planes, lots of empty black or white; a single small spot-colour element. Halftone dot texture over everything.',
    grade:
      'High contrast black-and-white, blown highlights, crushed blacks, coarse halftone or heavy grain, one flat spot colour.',
    motion: 'Halftone grain crawls; the flash flickers once; the spot colour pulses. Camera locked.',
    forbid: 'No soft gradients, no warm tone, no depth-of-field blur, no photographic colour beyond the single spot.',
    refs: 'zine and newspaper flash photography, risograph print.',
  },
  {
    id: 'chiaroscuro-painting',
    label: '키아로스쿠로 회화',
    when: '신고전주의 회화, 잉크 그래픽 노블(빛 문법만), 무드 고전적/깊은',
    camera:
      "Painter's viewpoint: eye level, slightly below the figures, 50mm-equivalent normal perspective, no wide distortion, the picture plane parallel to the main wall.",
    light:
      'Single motivated source from the upper left (a window or a torch out of frame), key:fill 6:1, shadows warm umber not black, a reflected bounce from the floor lifting the shadow side by one stop. Figures and objects modelled with a clear terminator line; highlights small and matte (glazed oil, never plastic).',
    composition:
      'Triangular grouping, the hero object at the golden-section point, one large area of calm (sky, wall, drapery) for the headline. Figures at medium distance, faces three-quarter or turned away, hands simplified or hidden by drapery.',
    grade:
      'Warm ochre/umber base, deep ultramarine accent, gilded touches, craquelure and canvas weave visible at 100%, no digital sharpness.',
    motion:
      'Living painting: fabric and leaves move slowly, light drifts across marble, figures shift weight; brushwork stays identical in every frame. Camera locked, slow.',
    forbid:
      'No photoreal element pasted into the painting, no modern objects (lamps, plastic, packaging), no frontal faces, no symmetric two-figure flanking.',
    refs: 'Caravaggio/David lighting discipline as adopted by pear.no.',
  },
  {
    id: 'pastoral-painting',
    label: '전원 회화(밝은 야외)',
    when: '신고전주의 회화 + 무드 밝은/따뜻한/유쾌한, 야외 장면',
    camera: 'Eye level, 40mm-equivalent, horizon in the lower third, picture plane parallel to the terrace edge.',
    light:
      'Late-afternoon sun from the upper left, key:fill 3:1 with open blue-sky fill; long soft shadows on marble; a warm glow on the far architecture. No hard black anywhere.',
    composition:
      'Figures small against architecture and sky, the hero object (tree, basket, ewer) near the golden section, two-thirds sky or wall for the headline.',
    grade:
      'Sun-warm highlights, cool shadows, ultramarine sky graded not flat, glazed matte surfaces, fine craquelure.',
    motion: "Leaves and drapery sway, clouds drift, the sun's edge moves along the balustrade. Camera locked.",
    forbid: 'No flat saturated sky, no centred figures, no photoreal food.',
    refs: 'neoclassical landscape-with-figures convention; pear.no daylight scenes.',
  },
  {
    id: 'paper-studio',
    label: '종이 스튜디오(수채·잉크)',
    when: '수채 일러스트, 잉크 그래픽 노블',
    camera:
      'Flat to the paper (scanner view), no perspective on the sheet itself; the drawn scene may have its own simple perspective.',
    light:
      'Even daylight on the paper so grain and pigment granulation read; the drawn scene implies one light direction with hatching or a single wash shadow.',
    composition:
      'Subject floats on untouched paper with 50–60% white; one small secondary drawing below or beside; headline room is the paper itself.',
    grade:
      'Paper white stays white, pigments limited to three, edges soft (watercolor) or crisp (ink), no digital gradients.',
    motion: 'Pigment blooms spread a little, paper grain shimmers, the sheet is lifted gently. Nothing new is drawn.',
    forbid: 'No photographic texture, no lettering, no full-bleed backgrounds, no gradients.',
    refs: '100 Lost Species watercolour cards; Santioni ink panels.',
  },
];

export function getLook(id: LookId): Look {
  const look = LOOKS.find((l) => l.id === id);

  if (!look) {
    throw new Error(`unknown look: ${id}`);
  }

  return look;
}

/** 세계관 × 무드 → 룩. 규칙이 정한다(사용자에게 묻지 않음). */
export function pickLook(worldId: string, moodYes: string[], theme: 'light' | 'dark', isFood = false): LookId {
  const has = (...w: string[]) => w.some((x) => moodYes.includes(x));

  switch (worldId) {
    case 'photo-editorial':
      if (theme === 'dark' || has('어두운', '엄격한', '깊은')) {
        return 'noir';
      }

      if (has('매끈한', '정확한', '고급')) {
        return 'luxury';
      }

      return isFood ? 'editorial-food' : 'documentary';
    case 'product-3d':
      return 'luxury';
    case 'mono-brutal':
      return 'brutal-flash';
    case 'neoclassical-painting':
      return has('밝은', '유쾌한', '따뜻한') ? 'pastoral-painting' : 'chiaroscuro-painting';
    case 'watercolor-illustration':
    case 'ink-graphic-novel':
      return 'paper-studio';
    default:
      return 'documentary';
  }
}

/** AD 브리프·스타일 락 뒤에 붙는 룩 규격 문자열. */
export function lookToPrompt(look: Look): string {
  return [
    `LOOK — ${look.label}.`,
    `Camera: ${look.camera}`,
    `Light: ${look.light}`,
    `Composition: ${look.composition}`,
    `Grade: ${look.grade}`,
    `Forbidden: ${look.forbid}`,
  ].join(' ');
}
