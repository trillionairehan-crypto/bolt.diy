/*
 * 골격(skeleton) 6종 각각의 대표작 — "여섯 카드가 한 벌의 작품처럼 보여야 한다"는 요구에 따라
 * 프레임(browserFrame 등)은 완전히 동일하게 재사용하고, 안쪽 콘텐츠만 골격마다 다른 kind로
 * 분기한다. 색은 크림/잉크/회갈색 고정, 코랄은 프레임당 정확히 한 곳(핵심 숫자 하나 또는 차트
 * 하나)에만 — 각 데이터의 "coral 표시" 지점은 SkeletonShowcaseCard.tsx 참고. 주소는 실제
 * Cloudflare Pages 배포 체계(coralred-app-<n>.pages.dev, CloudflareDeploy.client.tsx 참고)를
 * 그대로 따른다 — coralred.app 커스텀 도메인은 아직 Pro 미구현 기능이라 실제 체계가 아니다.
 *
 * 랜딩 섹션2와 /examples 양쪽에서 같은 데이터를 쓴다(복사하지 않는다) — prompt는 /examples 카드
 * 클릭 시 채팅 홈 입력창에 채워지는 문구(랜딩에서는 쓰이지 않음, 카드가 클릭 불가능).
 */
export interface RosterApp {
  kind: 'roster';
  name: string;
  url: string;
  prompt: string;
  todayCount: string;
  shortageCount: string;
  members: { name: string; remaining: string; lastVisit: string }[];
}

export interface ScheduleApp {
  kind: 'schedule';
  name: string;
  url: string;
  prompt: string;
  todayCount: string;
  slots: { time: string; label: string; confirmed: boolean }[];
}

export interface FinanceApp {
  kind: 'finance';
  name: string;
  url: string;
  prompt: string;
  revenue: string;
  cost: string;
  net: string;

  /** 도넛의 코랄 비율(0~100) — 카드 3의 유일한 코랄 접점. 순이익 숫자는 잉크로 둔다. */
  donutHighlight: number;
}

export interface ListingApp {
  kind: 'listing';
  name: string;
  url: string;
  prompt: string;
  chips: string[];
  activeChip: number;
  listings: { title: string; price: string; region: string; status: string; accent: boolean }[];
}

export interface TrackerApp {
  kind: 'tracker';
  name: string;
  url: string;
  prompt: string;
  weekCount: string;
  weekKcal: string;
  trend: number[];
}

export interface RankingApp {
  kind: 'ranking';
  name: string;
  url: string;
  prompt: string;
  tiers: { tier: string; score?: string; items: string[] }[];
}

export type ShowcaseApp = RosterApp | ScheduleApp | FinanceApp | ListingApp | TrackerApp | RankingApp;

export const SHOWCASE_APPS: ShowcaseApp[] = [
  {
    kind: 'roster',
    name: '헬스장 회원 관리',
    url: 'coralred-app-102.pages.dev',
    prompt: '헬스장 회원 관리 앱',
    todayCount: '7',
    shortageCount: '3',
    members: [
      { name: '김민지', remaining: '12회', lastVisit: '오늘' },
      { name: '박서준', remaining: '2회', lastVisit: '어제' },
      { name: '이하늘', remaining: '8회', lastVisit: '3일 전' },
    ],
  },
  {
    kind: 'schedule',
    name: '미용실 예약',
    url: 'coralred-app-118.pages.dev',
    prompt: '미용실 예약 관리 앱',
    todayCount: '4건',
    slots: [
      { time: '10:00', label: '컷', confirmed: true },
      { time: '11:30', label: '펌', confirmed: true },
      { time: '14:00', label: '염색', confirmed: false },
      { time: '16:30', label: '클리닉', confirmed: true },
    ],
  },
  {
    kind: 'finance',
    name: '우리 가게 매출',
    url: 'coralred-app-126.pages.dev',
    prompt: '우리 가게 매출 관리 앱',
    revenue: '2,480,000원',
    cost: '1,100,000원',
    net: '1,380,000원',
    donutHighlight: 45,
  },
  {
    kind: 'listing',
    name: '동네 중고거래',
    url: 'coralred-app-134.pages.dev',
    prompt: '동네 중고거래 앱',
    chips: ['전자기기', '가구', '의류'],
    activeChip: 0,
    listings: [
      { title: '아이패드 에어', price: '350,000원', region: '강남구', status: '상태 좋음', accent: true },
      { title: '원목 책상', price: '60,000원', region: '마포구', status: '직거래만', accent: false },
    ],
  },
  {
    kind: 'tracker',
    name: '운동 기록',
    url: 'coralred-app-149.pages.dev',
    prompt: '운동 기록 앱',
    weekCount: '이번 주 4회',
    weekKcal: '총 1,850kcal',
    trend: [3, 5, 2, 6, 4, 7, 5],
  },
  {
    kind: 'ranking',
    name: '맛집 랭킹',
    url: 'coralred-app-157.pages.dev',
    prompt: '맛집 랭킹 앱',
    tiers: [
      { tier: 'S', score: '98점', items: ['진미식당', '옛날통닭'] },
      { tier: 'A', items: ['국수마을', '두마리찜닭'] },
      { tier: 'B', items: ['분식천국', '커피명가'] },
    ],
  },
];
