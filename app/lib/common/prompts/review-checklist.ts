/**
 * 생성물 자동 검토(auto-review) 체크리스트 — Chat.client.tsx/reviewGeneratedApp.ts에 하드코딩하지
 * 않고 여기 한 곳에 모아둔다. 항목 추가/수정은 이 파일만 건드리면 된다.
 *
 * kind: 'text'는 생성된 소스 코드 텍스트만으로 판단 가능한 항목(1단계). 'visual'은 미리보기
 * 스크린샷을 봐야 정확히 판단 가능한 항목(2단계, buildVisualReviewSystemPrompt()가 쓴다) — 빈
 * 영역 비율/겹침/간격처럼 계산된 레이아웃을 봐야 하는 것들. 'interaction'은 정지 스크린샷 한 장으로는
 * 판단 불가능한 항목(필터·탭 전환 같은 상태 변화 전후 비교가 필요) — 정의만 해두고 비활성 상태로
 * 남겨둔다, 다음 단계에서 여러 장의 스크린샷(전/후)을 입력에 추가하면 활성화한다.
 */

export type ReviewCheckKind = 'text' | 'visual' | 'interaction';
export type ReviewCheckSeverity = 'critical' | 'polish';

export interface ReviewCheckItem {
  id: string;
  severity: ReviewCheckSeverity;
  kind: ReviewCheckKind;
  enabled: boolean;
  description: string;
}

export const REVIEW_CHECKLIST: ReviewCheckItem[] = [
  // --- 치명 (critical) — 발견 시 반드시 수정 ---
  {
    id: 'emoji-as-ui',
    severity: 'critical',
    kind: 'text',
    enabled: true,
    description:
      '이모지가 아이콘·이미지 자리에 UI 요소로 쓰였는가 (렌더 실패로 물음표 문자가 되는 원인). ' +
      '이미지·아이콘 자리의 이모지는 인라인 SVG 또는 플레이스홀더로 교체한다.',
  },
  {
    id: 'color-literal',
    severity: 'critical',
    kind: 'text',
    enabled: true,
    description:
      ':root의 팔레트 변수 외에 색상 리터럴(hex/rgb/hsl)이나 Tailwind 색상 클래스가 쓰였는가. ' +
      '전부 변수로 교체한다.',
  },
  {
    id: 'empty-viewport-half',
    severity: 'critical',
    kind: 'visual',
    enabled: true,
    description: '빈 영역이 뷰포트 절반 이상인 화면이 있는가.',
  },
  {
    id: 'loading-stuck',
    severity: 'critical',
    kind: 'text',
    enabled: true,
    description:
      '차트나 목록이 "불러오는 중" 상태로 남는가. 목업 데이터 폴백이 있는가 — 없다면 목업 데이터로 ' +
      '실제 화면을 채운다.',
  },
  {
    id: 'overlap',
    severity: 'critical',
    kind: 'visual',
    enabled: true,
    description: '버튼·입력·텍스트가 컨테이너를 벗어나거나 다른 요소와 겹치는가.',
  },
  {
    id: 'text-overflow',
    severity: 'critical',
    kind: 'visual',
    enabled: true,
    description: '텍스트가 잘리거나(box를 벗어남) 말줄임 처리 없이 넘치는가.',
  },
  {
    id: 'filter-tab-layout-shift',
    severity: 'critical',
    kind: 'interaction',
    enabled: false,
    description: '필터·탭 전환 시 목록 외의 요소(헤드라인, 검색창, 필터 바)가 사라지거나 위치가 바뀌는가.',
  },
  {
    id: 'fake-brand',
    severity: 'critical',
    kind: 'text',
    enabled: true,
    description: '실존하지 않는 브랜드·모델명을 지어냈는가. 확실하지 않으면 일반 명칭으로 교체한다.',
  },

  // --- 마감 (polish) — 발견 시 수정 ---
  {
    id: 'shadow-and-border',
    severity: 'polish',
    kind: 'text',
    enabled: true,
    description: '카드에 그림자와 테두리가 둘 다 있는가. 테두리 하나만 남긴다.',
  },
  {
    id: 'badge-color',
    severity: 'polish',
    kind: 'text',
    enabled: true,
    description:
      '상태 배지(완료/진행중/주의 등)가 전부 같은 색인가. 완료·긍정은 --ok, 경고는 --warn, ' +
      '위험·실패는 --err, 나머지는 --muted로 구분한다.',
  },
  {
    id: 'number-format',
    severity: 'polish',
    kind: 'text',
    enabled: true,
    description: '숫자에 부호와 단위가 있는가. ("-59"가 아니라 "-59원 (-0.08%)")',
  },
  {
    id: 'spacing',
    severity: 'polish',
    kind: 'visual',
    enabled: true,
    description: '카드·목록 항목 간격이 좁아 답답한가.',
  },
  {
    id: 'empty-list-state',
    severity: 'polish',
    kind: 'text',
    enabled: true,
    description: '목록이 비었을 때 안내 문구가 있는가. 빈 화면이 되면 안 된다.',
  },
  {
    id: 'baseline-misalignment',
    severity: 'polish',
    kind: 'visual',
    enabled: true,
    description: '같은 행에 나란히 있어야 할 요소들의 기준선이 어긋나 있는가.',
  },
  {
    id: 'accent-overuse',
    severity: 'polish',
    kind: 'visual',
    enabled: true,
    description: '강조색(accent)이 화면에서 과하게 반복되는가 — 강조는 화면당 1~2곳이 적당하다.',
  },
  {
    id: 'floating-element',
    severity: 'polish',
    kind: 'visual',
    enabled: true,
    description: '요소 하나가 주변 레이아웃과 관계없이 홀로 떠 보이는가.',
  },
];

function formatSection(title: string, items: ReviewCheckItem[]): string {
  if (items.length === 0) {
    return '';
  }

  const lines = items.map((item, index) => `${index + 1}. ${item.description}`).join('\n');

  return `### ${title}\n${lines}`;
}

/**
 * 활성화된 kind:'text' 항목만 걸러서 시스템 프롬프트를 조립한다. reviewGeneratedApp.ts가 이 문자열을
 * /api/llmcall의 system 필드로 그대로 전달한다.
 */
export function buildReviewSystemPrompt(): string {
  const active = REVIEW_CHECKLIST.filter((item) => item.enabled && item.kind === 'text');
  const critical = active.filter((item) => item.severity === 'critical');
  const polish = active.filter((item) => item.severity === 'polish');

  const sections = [formatSection('치명 — 발견 시 반드시 수정', critical), formatSection('마감 — 발견 시 수정', polish)]
    .filter(Boolean)
    .join('\n\n');

  return `당신은 방금 생성된 웹 앱의 소스 코드를 검토하는 코드 리뷰어입니다. 아래 체크리스트에 있는 항목만 검사하세요 — 체크리스트에 없는 스타일 취향이나 리팩터링은 절대 건드리지 마세요.

${sections}

규칙:
- 체크리스트 위반을 실제로 찾았을 때만 파일을 수정하세요. 확신이 없으면 건드리지 마세요.
- 파일을 수정할 때는 그 파일의 전체 내용을 다시 씁니다 — 일부만 고친 조각(diff)을 보내지 마세요.
- 체크리스트와 무관한 코드는 절대 바꾸지 마세요. 동작하는 로직을 건드리지 마세요.
- 위반을 하나도 못 찾았으면 issues는 빈 배열 []로, files는 빈 객체 {}로 반환하세요. "이 부분은 문제
  없음" 같은 확인 메모를 issues에 채우지 마세요 — issues는 실제 위반만 적는 자리입니다.

응답 형식: 순수 JSON 객체만 응답하세요, 마크다운 코드펜스나 설명 없이. 정확한 형태:
{
  "issues": ["짧은 한국어 설명 하나당 한 줄"],
  "files": { "/home/project/src/App.tsx": "파일 전체 내용..." }
}
위반이 없으면:
{ "issues": [], "files": {} }`;
}

/**
 * 활성화된 kind:'visual' 항목으로 시각 검토용 시스템 프롬프트를 조립한다. 텍스트 검토보다 오탐
 * 위험이 커서(스크린샷 한 장을 보고 판단하는 것이라 확신이 낮을 수 있음) confidence/element를
 * 강제하고, high가 아니면 파일을 건드리지 말라고 명시한다.
 */
export function buildVisualReviewSystemPrompt(): string {
  const active = REVIEW_CHECKLIST.filter((item) => item.enabled && item.kind === 'visual');
  const critical = active.filter((item) => item.severity === 'critical');
  const polish = active.filter((item) => item.severity === 'polish');

  const sections = [formatSection('치명 — 발견 시 반드시 수정', critical), formatSection('마감 — 발견 시 수정', polish)]
    .filter(Boolean)
    .join('\n\n');

  return `당신은 방금 생성된 웹 앱의 미리보기 스크린샷(데스크톱 1280×800, 첫 화면만 — 스크롤 아래는 안 보임)을 검토하는 UI 리뷰어입니다. 아래 체크리스트에 있는 것만 검사하세요.

${sections}

이 검토는 스크린샷 한 장만 보고 판단하는 것이라 텍스트 검토보다 오탐 위험이 훨씬 큽니다. 그래서 규칙이 더 엄격합니다:
- 지적마다 confidence("high"|"medium"|"low")를 붙이세요. 화면에서 명백하고 확실한 문제만 "high"입니다. 애매하거나 스타일 취향 같으면 "medium"이나 "low"로 낮추세요.
- 지적마다 element에 화면의 어느 요소인지 구체적으로 적으세요(예: "헤더의 검색 입력창", "상단 두 번째 카드"). 어느 요소인지 특정할 수 없으면 그 지적은 confidence를 "low"로 낮추세요.
- confidence가 "high"이고 element가 구체적인 지적만 파일을 고치는 근거로 쓰세요. "medium"·"low"는 issues에만 기록하고 파일은 절대 건드리지 마세요.
- 한 번에 고치는 파일은 최대 2개입니다. 레이아웃을 통째로 재작성하지 마세요 — 문제가 된 부분만 최소한으로 고치세요.
- 이미지 내용(사진이 뭘 보여주는지)은 검토 대상이 아닙니다. 회색 박스로 보이는 자리는 실제 이미지가 들어갈 자리이니 정상입니다.
- 확신이 없으면 아무것도 고치지 마세요. 위반을 하나도 못 찾았으면 files를 빈 객체 {}로 반환하세요.

응답 형식: 순수 JSON 객체만 응답하세요, 마크다운 코드펜스나 설명 없이. 정확한 형태:
{
  "issues": [
    { "description": "짧은 한국어 설명", "element": "화면에서 어느 요소인지", "confidence": "high" }
  ],
  "files": { "/home/project/src/App.tsx": "파일 전체 내용..." }
}
위반이 없으면:
{ "issues": [], "files": {} }`;
}
