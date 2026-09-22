/*
 * 실제 사용자 시나리오 20개 — "사용자가 이렇게 말했을 때 코랄레드가 어디까지 가는가"를 재는 입력.
 * 테스트 코드가 아니라 측정용 데이터. 온보딩 답(q1/q2/skeleton/industry)은 실제 UI에서 고를 수 있는
 * 값만 쓴다(question-bank.ts). `followups`는 첫 생성 뒤 같은 채팅에 보내는 수정 요청.
 * `expect`는 산출물에서 정규식으로 찾아볼 "있어야 할 것" — 통과/실패가 아니라 관찰 기록용.
 */
import type { Q1Value, Q2Value, SkeletonId } from '../../../app/lib/onboarding/question-bank';

export interface Scenario {
  id: string;
  title: string;
  prompt: string;
  q1: Q1Value;
  q2: Q2Value;
  skeleton: SkeletonId | null;
  industry?: string;
  /** 사용자가 기대할 법한 것 — 파일 내용(소스) 정규식 */
  expect: Array<{ label: string; pattern: RegExp }>;
  /** 첫 생성 뒤 수정 요청(같은 채팅) */
  followups?: Array<{ id: string; prompt: string; expect: Array<{ label: string; pattern: RegExp }> }>;
  /** 코랄레드 범위 밖이라 "못 한다/대안" 답이 정답인 경우 */
  outOfScope?: string;
}

export const SCENARIOS: Scenario[] = [
  {
    id: 's01-dermatology-booking',
    title: '강남 피부과 예약 홈페이지',
    prompt: '강남 피부과 예약 홈페이지 만들어줘. 진료 과목 소개, 의료진, 예약 신청 폼, 오시는 길이 있으면 좋겠어.',
    q1: 'public',
    q2: 'cloud',
    skeleton: 2,
    industry: '병원·의원',
    expect: [
      { label: '예약 폼(input/select)', pattern: /<(input|select)\b/ },
      { label: '날짜/시간 선택', pattern: /type="(date|time)"|날짜|시간/ },
      { label: '진료 과목', pattern: /진료|시술|피부/ },
      { label: '오시는 길', pattern: /오시는 길|주소|지도/ },
      { label: 'Cloud 저장 SDK 사용', pattern: /coralred-storage|createCollection|storage\./ },
    ],
    followups: [
      {
        id: 'f1-kakao-map',
        prompt: '오시는 길에 카카오맵 넣어줘',
        expect: [{ label: '카카오맵 SDK/iframe', pattern: /kakao|daum\.net\/map|map\.kakao/i }],
      },
    ],
  },
  {
    id: 's02-online-shop',
    title: '온라인 쇼핑몰',
    prompt: '온라인 쇼핑몰 만들어줘.',
    q1: 'public',
    q2: 'cloud',
    skeleton: 4,
    industry: '쇼핑·판매',
    expect: [
      { label: '상품 목록', pattern: /상품|product/i },
      { label: '장바구니', pattern: /장바구니|cart/i },
      { label: '상세 화면', pattern: /상세|detail/i },
      { label: '결제/주문 버튼', pattern: /주문|결제|checkout/i },
    ],
    followups: [
      {
        id: 'f1-stripe',
        prompt: '내가 만든 앱에 Stripe 결제를 추가해줘.',
        expect: [
          { label: 'Stripe 언급', pattern: /stripe/i },
          { label: '서버 필요 안내(한국어)', pattern: /서버|백엔드|비밀 키|secret/i },
        ],
      },
    ],
  },
  {
    id: 's03-saas-auth-payment-admin',
    title: '회원가입+결제+관리자 SaaS',
    prompt: '회원가입 + 결제 + 관리자 페이지가 있는 SaaS 만들어줘. 프로젝트 관리 도구야.',
    q1: 'team',
    q2: 'cloud',
    skeleton: 1,
    industry: '기타',
    expect: [
      { label: '회원가입/로그인 UI', pattern: /회원가입|로그인|signup|login/i },
      { label: '결제/요금제', pattern: /결제|요금제|구독|pricing/i },
      { label: '관리자', pattern: /관리자|admin/i },
      { label: '한계 안내(로그인·결제는 실제 동작 아님)', pattern: /샘플|데모|실제 결제|연결/ },
    ],
    outOfScope: '실제 회원가입·결제 백엔드는 코랄레드 Cloud(device_key)로 불가 — 화면만 만들고 한계를 말해야 정답',
  },
  {
    id: 's04-cafe-menu-stamp',
    title: '동네 카페 메뉴+적립',
    prompt: '우리 동네 카페 메뉴판이랑 단골 적립 스탬프 앱 만들어줘. 아메리카노 4,000원부터 시작해.',
    q1: 'team',
    q2: 'cloud',
    skeleton: 1,
    industry: '카페·음식점',
    expect: [
      { label: '메뉴 목록', pattern: /아메리카노|메뉴/ },
      { label: '4,000원 반영', pattern: /4,?000/ },
      { label: '적립/스탬프', pattern: /적립|스탬프/ },
      { label: '관리자 관점(직원이 적립)', pattern: /적립하기|추가|관리/ },
    ],
  },
  {
    id: 's05-photographer-portfolio',
    title: '사진작가 포트폴리오(시네마틱)',
    prompt: '제주도에서 활동하는 사진작가 포트폴리오 사이트 만들어줘. 감성적이고 고급스럽게.',
    q1: 'public',
    q2: 'none',
    skeleton: 7,
    industry: '브랜드 소개·포트폴리오',
    expect: [
      { label: '킷 사용(import from ./kit)', pattern: /from ['"]\.\/kit/ },
      { label: 'HeroScene', pattern: /HeroScene/ },
      { label: 'PinnedChapters/Showcase', pattern: /PinnedChapters|Showcase3D/ },
      { label: '제주 문맥', pattern: /제주/ },
    ],
  },
  {
    id: 's06-hair-salon-booking',
    title: '미용실 예약',
    prompt: '미용실 예약 앱. 디자이너별로 시간표 보고 예약하게.',
    q1: 'public',
    q2: 'cloud',
    skeleton: 2,
    industry: '미용·뷰티',
    expect: [
      { label: '디자이너 목록', pattern: /디자이너/ },
      { label: '시간표/슬롯', pattern: /시간|슬롯|schedule/i },
      { label: '예약 저장', pattern: /예약/ },
    ],
    followups: [
      {
        id: 'f1-cancel',
        prompt: '예약 취소 기능도 넣어줘',
        expect: [{ label: '취소 버튼/함수', pattern: /취소|cancel/i }],
      },
    ],
  },
  {
    id: 's07-academy-attendance',
    title: '학원 출결·수강료',
    prompt: '수학 학원 학생 출결 체크하고 수강료 납부 여부 관리하는 앱',
    q1: 'team',
    q2: 'cloud',
    skeleton: 1,
    industry: '학원·교육',
    expect: [
      { label: '학생 명단', pattern: /학생/ },
      { label: '출결', pattern: /출석|결석|출결/ },
      { label: '납부 여부', pattern: /납부|수강료/ },
    ],
  },
  {
    id: 's08-fitness-log',
    title: '헬스 운동 기록',
    prompt: '내 운동 기록하는 앱. 오늘 한 운동이랑 무게, 횟수 적고 주간 그래프로 보고 싶어.',
    q1: 'solo',
    q2: 'cloud',
    skeleton: 5,
    industry: '헬스·운동',
    expect: [
      { label: '기록 입력(무게/횟수)', pattern: /무게|횟수|kg|reps/i },
      { label: '주간 추이', pattern: /주간|그래프|차트|chart/i },
      { label: '외부 차트 라이브러리 미사용(SVG/CSS)', pattern: /<svg|recharts|chart\.js/i },
    ],
  },
  {
    id: 's09-restaurant-showcase',
    title: '오마카세 소개 사이트(시네마틱, 다크)',
    prompt: '청담동 오마카세 레스토랑 소개 사이트. 예약은 전화로 받아. 코스 메뉴랑 셰프 소개, 공간 사진.',
    q1: 'public',
    q2: 'none',
    skeleton: 7,
    industry: '카페·음식점',
    expect: [
      { label: '킷 사용', pattern: /from ['"]\.\/kit/ },
      { label: '전화 링크', pattern: /tel:/ },
      { label: '코스 메뉴', pattern: /코스|오마카세/ },
      { label: '예약 폼 없음(전화만)', pattern: /<form/ },
    ],
  },
  {
    id: 's10-ledger',
    title: '개인 가계부',
    prompt: '가계부 앱 만들어줘. 수입 지출 입력하고 이번 달 합계 보기.',
    q1: 'solo',
    q2: 'cloud',
    skeleton: 3,
    industry: '기타',
    expect: [
      { label: '수입/지출 구분', pattern: /수입|지출/ },
      { label: '월 합계', pattern: /합계|이번 달|총/ },
      { label: '금액 포맷(원)', pattern: /toLocaleString|원/ },
    ],
  },
  {
    id: 's11-ranking-board',
    title: '동호회 랭킹',
    prompt: '테니스 동호회 회원 승패 기록하고 랭킹 보여주는 앱',
    q1: 'team',
    q2: 'cloud',
    skeleton: 6,
    industry: '기타',
    expect: [
      { label: '승/패', pattern: /승|패/ },
      { label: '랭킹/순위', pattern: /랭킹|순위/ },
      { label: '정렬 로직', pattern: /sort\(/ },
    ],
  },
  {
    id: 's12-wedding-invite',
    title: '모바일 청첩장',
    prompt: '모바일 청첩장 만들어줘. 10월 24일 토요일 오후 1시, 더채플 앳 청담. 신랑 김민준 신부 이서연.',
    q1: 'public',
    q2: 'none',
    skeleton: 7,
    industry: '기타',
    expect: [
      { label: '날짜 반영', pattern: /10월 24일|10\.24/ },
      { label: '장소 반영', pattern: /더채플/ },
      { label: '이름 반영', pattern: /김민준|이서연/ },
      { label: '모바일 우선(뷰포트/폭 제한)', pattern: /max-width|100svh|100vh/ },
    ],
  },
  {
    id: 's13-no-storage-calculator',
    title: '저장 없는 계산기(견적)',
    prompt: '인테리어 견적 계산기. 평수랑 옵션 고르면 대략 금액 나오게. 저장은 필요 없어.',
    q1: 'public',
    q2: 'none',
    skeleton: 4,
    industry: '기타',
    expect: [
      { label: '평수 입력', pattern: /평/ },
      { label: '옵션 선택', pattern: /<select|checkbox|radio/ },
      { label: '저장 SDK 미사용(있으면 위반)', pattern: /coralred-storage|supabase/i },
    ],
  },
  {
    id: 's14-english-typo-prompt',
    title: '오타·영어 섞인 짧은 요청',
    prompt: 'todo app plz 한국어로',
    q1: 'solo',
    q2: 'cloud',
    skeleton: 4,
    industry: '기타',
    expect: [
      { label: '할 일 추가/완료', pattern: /할 일|완료|추가/ },
      { label: '한국어 UI', pattern: /[가-힣]{2,}/ },
    ],
  },
  {
    id: 's15-clinic-followup-color',
    title: '한의원 + 색/문구 수정 2회',
    prompt: '한의원 소개 페이지. 진료 시간, 진료 과목, 원장 인사말.',
    q1: 'public',
    q2: 'none',
    skeleton: 7,
    industry: '병원·의원',
    expect: [{ label: '진료 시간', pattern: /진료 ?시간|평일|토요일/ }],
    followups: [
      {
        id: 'f1-hours',
        prompt: '진료 시간을 평일 9시~18시, 토요일 9시~13시, 일요일 휴진으로 바꿔줘',
        expect: [{ label: '변경 반영', pattern: /18:00|18시/ }, { label: '일요일 휴진', pattern: /휴진/ }],
      },
      {
        id: 'f2-tone',
        prompt: '전체적으로 더 차분하고 신뢰감 있게, 글자를 조금 키워줘',
        expect: [{ label: '파일 수정 발생', pattern: /./ }],
      },
    ],
  },
  {
    id: 's16-out-of-scope-native',
    title: '범위 밖: 앱스토어 네이티브 앱',
    prompt: '아이폰 앱스토어에 올릴 수 있는 iOS 앱 만들어줘. 푸시 알림도.',
    q1: 'public',
    q2: 'none',
    skeleton: null,
    industry: '기타',
    expect: [{ label: '한계 안내(웹앱/홈화면 추가)', pattern: /웹|홈 화면|PWA|앱스토어/ }],
    outOfScope: '네이티브 iOS 불가 — 웹앱으로 대안 제시가 정답',
  },
  {
    id: 's17-scrape-competitor',
    title: '범위 밖: 경쟁사 크롤링',
    prompt: '네이버 스마트스토어에서 경쟁사 가격을 매일 크롤링해서 보여주는 앱',
    q1: 'solo',
    q2: 'cloud',
    skeleton: 5,
    industry: '쇼핑·판매',
    expect: [{ label: '한계 안내(서버/크롤링 불가)', pattern: /서버|크롤링|직접 입력|수동/ }],
    outOfScope: '브라우저 앱은 크롤링 불가 — 수동 입력 대안이 정답',
  },
  {
    id: 's18-kakao-login',
    title: '카카오 로그인 요구',
    prompt: '카카오 로그인으로 들어와서 쿠폰 받는 이벤트 페이지',
    q1: 'public',
    q2: 'cloud',
    skeleton: 4,
    industry: '쇼핑·판매',
    expect: [
      { label: '카카오 SDK 참조', pattern: /Kakao|VITE_KAKAO_JS_KEY/ },
      { label: '쿠폰', pattern: /쿠폰/ },
      { label: '키 필요 안내', pattern: /키|설정|연동/ },
    ],
  },
  {
    id: 's19-multi-page-request',
    title: '페이지 5개 회사 홈페이지',
    prompt: '회사 홈페이지. 홈, 회사소개, 서비스, 포트폴리오, 문의 5개 페이지로 만들어줘. 물류 회사야.',
    q1: 'public',
    q2: 'none',
    skeleton: 7,
    industry: '기타',
    expect: [
      { label: '5개 섹션/페이지 이름', pattern: /회사소개[\s\S]*서비스[\s\S]*포트폴리오[\s\S]*문의/ },
      { label: '라우팅 또는 앵커 내비', pattern: /react-router|href="#|SceneNav|Nav/ },
      { label: '문의 폼', pattern: /<form|문의/ },
    ],
  },
  {
    id: 's20-long-detailed-prompt',
    title: '긴 요구사항(요가원)',
    prompt:
      '요가원 앱. 수업은 하타/빈야사/인요가 3종, 강사 3명(지수, 민아, 태현), 월 회원권 12만원·10회권 15만원. 회원이 수업 예약하고 남은 횟수 보고, 원장은 회원 목록이랑 출석 관리. 색은 차분한 초록.',
    q1: 'team',
    q2: 'cloud',
    skeleton: 2,
    industry: '헬스·운동',
    expect: [
      { label: '수업 3종', pattern: /하타[\s\S]*빈야사[\s\S]*인요가/ },
      { label: '강사 이름', pattern: /지수[\s\S]*민아[\s\S]*태현/ },
      { label: '가격 반영', pattern: /12만|120,?000|15만|150,?000/ },
      { label: '남은 횟수', pattern: /남은|잔여/ },
      { label: '원장 관리 화면', pattern: /회원 목록|출석|관리/ },
    ],
  },
];
