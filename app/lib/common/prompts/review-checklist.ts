/**
 * 생성물 자동 검토(auto-review) 체크리스트 — Chat.client.tsx/reviewGeneratedApp.ts에 하드코딩하지
 * 않고 여기 한 곳에 모아둔다. 항목 추가/수정은 이 파일만 건드리면 된다.
 *
 * kind: 'text'는 생성된 소스 코드 텍스트만으로 판단 가능한 항목, 'visual'은 실제 렌더링(미리보기
 * 스크린샷)을 봐야 정확히 판단 가능한 항목 — 빈 영역 비율/겹침/필터 전환 시 레이아웃 변화/간격처럼
 * 계산된 레이아웃을 봐야 하는 것들. 1단계(이 라운드)는 kind:'text'만 활성화한다 — 텍스트만 보고
 * 'visual' 항목을 판단시키면 오탐으로 멀쩡한 코드를 고칠 위험이 크기 때문. 다음 라운드에서 미리보기
 * 스크린샷이 검토 입력에 추가되면 해당 항목들의 enabled를 true로 뒤집기만 하면 된다.
 */

export type ReviewCheckKind = 'text' | 'visual';
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
    enabled: false,
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
    enabled: false,
    description: '버튼·입력이 컨테이너를 벗어나거나 다른 요소와 겹치는가.',
  },
  {
    id: 'filter-tab-layout-shift',
    severity: 'critical',
    kind: 'visual',
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
      '상태 배지(완료/진행중/주의 등)가 전부 같은 색인가. 완료·긍정은 --success, 경고·위험은 ' +
      '--danger, 나머지는 --text-muted로 구분한다.',
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
    enabled: false,
    description: '카드·목록 항목 사이 간격이 12px 미만인가. 16px 이상으로 늘린다.',
  },
  {
    id: 'empty-list-state',
    severity: 'polish',
    kind: 'text',
    enabled: true,
    description: '목록이 비었을 때 안내 문구가 있는가. 빈 화면이 되면 안 된다.',
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
- 위반을 하나도 못 찾았으면 files를 빈 객체 {}로 반환하세요. 억지로 뭔가를 고치려 하지 마세요.

응답 형식: 순수 JSON 객체만 응답하세요, 마크다운 코드펜스나 설명 없이. 정확한 형태:
{
  "issues": ["짧은 한국어 설명 하나당 한 줄"],
  "files": { "/home/project/src/App.tsx": "파일 전체 내용..." }
}
위반이 없으면:
{ "issues": [], "files": {} }`;
}
