import { useEffect, useRef, useState } from 'react';
import { classNames } from '~/utils/classNames';
import { LogoAssembly } from '~/components/ui/LogoAssembly';
import styles from './CoralredLandingPage.module.scss';

interface CoralredLandingPageProps {
  /** Called when the visitor clicks any "enter the app" CTA (시작하기). */
  onEnter: () => void;

  /**
   * 1-3: true only when a logged-in visitor forced this page via ?home=1 (dev/확인용) — the
   * 로그인/회원가입 links make no sense for them, so the top-right shows a single "내 앱 만들기"
   * coral button instead.
   */
  loggedInPreview?: boolean;
}

/*
 * Toggles on whenever the returned ref's element is in the viewport, off whenever it leaves —
 * in either scroll direction — so the reveal animation replays every time a section re-enters
 * view, not just the first time. Skips straight to visible (no animation at all, and no
 * subsequent toggling) when the visitor has prefers-reduced-motion set.
 */
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;

    if (!el) {
      return undefined;
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.15 });

    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} role="img" aria-label="코랄레드">
      <rect x="153" y="63" width="104" height="104" rx="30" fill="#FF5330" />
      <rect x="63" y="153" width="104" height="104" rx="30" fill="#FF5330" />
      <rect x="63" y="255" width="104" height="104" rx="30" fill="#FF5330" />
      <rect x="153" y="345" width="104" height="104" rx="30" fill="#FF5330" />
      <rect x="289" y="84" width="84" height="84" rx="26" fill="#FFB5A3" />
      <rect x="289" y="344" width="84" height="84" rx="26" fill="#FFB5A3" />
    </svg>
  );
}

// 목적지가 아직 없는 마케팅 정보 페이지 — 실제 라우트가 생기기 전까지의 자리 표시용 링크.
const NAV_LINKS = [
  { label: '제품', href: '#' },
  { label: '기술과 보안', href: '#' },
  { label: '도움말', href: '#' },
  { label: '요금제', href: '/pricing' },
];

/*
 * 골격(skeleton) 6종 각각의 대표작 — "여섯 카드가 한 벌의 작품처럼 보여야 한다"는 요구에 따라
 * 프레임(browserFrame 등)은 완전히 동일하게 재사용하고, 안쪽 콘텐츠만 골격마다 다른 kind로
 * 분기한다. 색은 크림/잉크/회갈색 고정, 코랄은 프레임당 정확히 한 곳(핵심 숫자 하나 또는 차트
 * 하나)에만 — 아래 각 데이터의 "coral 표시" 지점 참고. 주소는 실제 Cloudflare Pages 배포 체계
 * (coralred-app-<n>.pages.dev, CloudflareDeploy.client.tsx 참고)를 그대로 따른다 — coralred.app
 * 커스텀 도메인은 아직 Pro 미구현 기능이라 실제 체계가 아니다.
 */
interface RosterApp {
  kind: 'roster';
  name: string;
  url: string;
  todayCount: string;
  shortageCount: string;
  members: { name: string; remaining: string; lastVisit: string }[];
}

interface ScheduleApp {
  kind: 'schedule';
  name: string;
  url: string;
  todayCount: string;
  slots: { time: string; label: string; confirmed: boolean }[];
}

interface FinanceApp {
  kind: 'finance';
  name: string;
  url: string;
  revenue: string;
  cost: string;
  net: string;

  /** 도넛의 코랄 비율(0~100) — 카드 3의 유일한 코랄 접점. 순이익 숫자는 잉크로 둔다. */
  donutHighlight: number;
}

interface ListingApp {
  kind: 'listing';
  name: string;
  url: string;
  chips: string[];
  activeChip: number;
  listings: { title: string; price: string; region: string; status: string; accent: boolean }[];
}

interface TrackerApp {
  kind: 'tracker';
  name: string;
  url: string;
  weekCount: string;
  weekKcal: string;
  trend: number[];
}

interface RankingApp {
  kind: 'ranking';
  name: string;
  url: string;
  tiers: { tier: string; score?: string; items: string[] }[];
}

type ShowcaseApp = RosterApp | ScheduleApp | FinanceApp | ListingApp | TrackerApp | RankingApp;

const SHOWCASE_APPS: ShowcaseApp[] = [
  {
    kind: 'roster',
    name: '헬스장 회원 관리',
    url: 'coralred-app-102.pages.dev',
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
    revenue: '2,480,000원',
    cost: '1,100,000원',
    net: '1,380,000원',
    donutHighlight: 45,
  },
  {
    kind: 'listing',
    name: '동네 중고거래',
    url: 'coralred-app-134.pages.dev',
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
    weekCount: '이번 주 4회',
    weekKcal: '총 1,850kcal',
    trend: [3, 5, 2, 6, 4, 7, 5],
  },
  {
    kind: 'ranking',
    name: '맛집 랭킹',
    url: 'coralred-app-157.pages.dev',
    tiers: [
      { tier: 'S', score: '98점', items: ['진미식당', '옛날통닭'] },
      { tier: 'A', items: ['국수마을', '두마리찜닭'] },
      { tier: 'B', items: ['분식천국', '커피명가'] },
    ],
  },
];

/** 7개 값을 카드 폭에 맞는 꺾은선 SVG로 — 카드 5(운동 기록)의 유일한 코랄 지점. */
function Sparkline({ values }: { values: number[] }) {
  const width = 100;
  const height = 28;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - ((value - min) / range) * height;

      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={styles.sparkline} aria-hidden="true" preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke="#FF5330"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 카드 3(우리 가게 매출)의 카테고리 도넛 — 이 카드의 유일한 코랄 접점(순이익 숫자는 잉크). */
function DonutChart({ highlight }: { highlight: number }) {
  const radius = 15;
  const circumference = 2 * Math.PI * radius;
  const length = (highlight / 100) * circumference;

  return (
    <svg viewBox="0 0 40 40" className={styles.donutChart} aria-hidden="true">
      <circle cx="20" cy="20" r={radius} fill="none" stroke="rgba(26, 26, 26, 0.1)" strokeWidth="7" />
      <circle
        cx="20"
        cy="20"
        r={radius}
        fill="none"
        stroke="#FF5330"
        strokeWidth="7"
        strokeDasharray={`${length} ${circumference - length}`}
        transform="rotate(-90 20 20)"
      />
    </svg>
  );
}

function ShowcaseCardContent({ app }: { app: ShowcaseApp }) {
  switch (app.kind) {
    case 'roster':
      return (
        <>
          <div className={styles.statRow}>
            <div className={styles.statBox}>
              <p className={classNames(styles.statValue, styles.statValueAccent)}>{app.todayCount}</p>
              <p className={styles.statLabel}>오늘 출석</p>
            </div>
            <div className={styles.statBox}>
              <p className={styles.statValue}>{app.shortageCount}</p>
              <p className={styles.statLabel}>잔여 부족</p>
            </div>
          </div>
          <ul className={styles.rows}>
            {app.members.map((member) => (
              <li key={member.name} className={styles.rowLine}>
                <span className={styles.rowMain}>{member.name}</span>
                <span className={styles.rowMeta}>
                  {member.remaining} · {member.lastVisit}
                </span>
              </li>
            ))}
          </ul>
        </>
      );

    case 'schedule':
      return (
        <>
          <p className={styles.statLabel}>
            오늘 예약{' '}
            <span className={classNames(styles.statValue, styles.statValueAccent, styles.statValueInline)}>
              {app.todayCount}
            </span>
          </p>
          <div className={styles.timelineRow}>
            {app.slots.map((slot) => (
              <div key={slot.time} className={styles.timelineSlot}>
                <span
                  className={classNames(styles.timelineDot, {
                    [styles.timelineDotConfirmed]: slot.confirmed,
                    [styles.timelineDotPending]: !slot.confirmed,
                  })}
                />
                <span className={styles.timelineTime}>{slot.time}</span>
                <span className={styles.timelineLabel}>{slot.label}</span>
              </div>
            ))}
          </div>
        </>
      );

    case 'finance':
      return (
        <div className={styles.chartRow}>
          <div className={styles.rows}>
            <p className={styles.rowLine}>
              <span className={styles.rowMeta}>매출</span>
              <span className={styles.rowMain}>{app.revenue}</span>
            </p>
            <p className={styles.rowLine}>
              <span className={styles.rowMeta}>비용</span>
              <span className={styles.rowMain}>{app.cost}</span>
            </p>
            <p className={styles.rowLine}>
              <span className={styles.rowMeta}>순이익</span>
              <span className={classNames(styles.statValue, styles.statValueInline)}>{app.net}</span>
            </p>
          </div>
          <DonutChart highlight={app.donutHighlight} />
        </div>
      );

    case 'listing':
      return (
        <>
          <div className={styles.chipRow}>
            {app.chips.map((chip, index) => (
              <span key={chip} className={classNames(styles.chip, { [styles.chipActive]: index === app.activeChip })}>
                {chip}
              </span>
            ))}
          </div>
          <ul className={styles.rows}>
            {app.listings.map((listing) => (
              <li key={listing.title} className={styles.listingRow}>
                <span className={styles.listingTitle}>{listing.title}</span>
                <span className={styles.listingMeta}>
                  {listing.region} · {listing.status}
                </span>
                <span className={classNames(styles.listingPrice, { [styles.listingPriceAccent]: listing.accent })}>
                  {listing.price}
                </span>
              </li>
            ))}
          </ul>
        </>
      );

    case 'tracker':
      return (
        <div className={styles.chartRow}>
          <div className={styles.rows}>
            <p className={styles.rowMain}>{app.weekCount}</p>
            <p className={styles.rowMeta}>{app.weekKcal}</p>
          </div>
          <Sparkline values={app.trend} />
        </div>
      );

    case 'ranking':
      return (
        <ul className={styles.rows}>
          {app.tiers.map((tier) => (
            <li key={tier.tier} className={styles.tierRow}>
              <span className={styles.tierLabel}>{tier.tier}</span>
              {tier.score && <span className={styles.tierScore}>{tier.score}</span>}
              <span className={styles.tierItems}>{tier.items.join(' · ')}</span>
            </li>
          ))}
        </ul>
      );

    default:
      return null;
  }
}

const TRUST_LINES = ['내 앱 데이터는 내 것만', '함부로 배포되지 않아요', '실패하면 돈을 받지 않아요'];

/*
 * 코랄 한 색의 농도만으로 4단계 위계를 표현 — "추천" 표시 없이 네 플랜을 동등하게 보여준다.
 * 이 intensity가 요금제 상세 페이지(app/routes/pricing.tsx)의 카드 상단 바에도 그대로 쓰인다.
 */
interface PricingTier {
  label: string;
  intensity: number;
}

const PRICING_TIERS: PricingTier[] = [
  { label: '무료 0원 · 월 메시지 10건', intensity: 0.18 },
  { label: '라이트 9,900원 · 월 35건, 이월', intensity: 0.4 },
  { label: '프로 29,900원 · 월 100건, 브랜딩 제거, 커스텀 색상', intensity: 0.65 },
  { label: '맥스 79,900원 · 월 300건, 브랜딩 제거, 커스텀 색상', intensity: 1 },
];

export function CoralredLandingPage({ onEnter, loggedInPreview = false }: CoralredLandingPageProps) {
  const showcaseReveal = useReveal<HTMLElement>();
  const trustReveal = useReveal<HTMLElement>();
  const pricingReveal = useReveal<HTMLElement>();
  const finalCtaReveal = useReveal<HTMLElement>();

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.topBar}>
          <div className={styles.topLeft}>
            <LogoMark className={styles.logoSmall} />
            <nav className={styles.navLinks}>
              {NAV_LINKS.map((link) => (
                <a key={link.label} href={link.href} className={styles.navLink}>
                  {link.label}
                </a>
              ))}
            </nav>
          </div>
          <div className={styles.authLinks}>
            {loggedInPreview ? (
              <button type="button" className={styles.primaryCta} style={{ marginTop: 0 }} onClick={onEnter}>
                내 앱 만들기
              </button>
            ) : (
              <>
                <a href="/login" className={styles.navLink}>
                  로그인
                </a>
                <a href="/signup" className={styles.navLink}>
                  회원가입
                </a>
              </>
            )}
          </div>
        </div>

        <div className={styles.heroMiddle}>
          <div className={styles.heroCluster}>
            <div className={styles.logoColumn}>
              <LogoAssembly className={styles.logoAssembly} />
            </div>

            <div className={styles.heroCopy}>
              <p className={styles.taglineMain}>아이디어만 가져오세요</p>
              <p className={styles.taglineSub}>쓰면 앱이 되고, 주소가 생겨요</p>
              <button type="button" className={styles.primaryCta} onClick={onEnter}>
                시작하기
              </button>
              <p className={styles.trialCaption}>가입 없이 첫 앱을 만들어볼 수 있어요</p>
            </div>
          </div>
        </div>
      </section>

      <section
        id="showcase"
        ref={showcaseReveal.ref}
        className={classNames(styles.showcase, styles.reveal, { [styles.revealVisible]: showcaseReveal.visible })}
      >
        <h2 className={styles.showcaseTitle}>오늘 다른 사용자는 이런 걸 만들었어요</h2>

        <div className={classNames(styles.grid, { [styles.revealVisible]: showcaseReveal.visible })}>
          {SHOWCASE_APPS.map((app) => (
            <div key={app.name} className={styles.card}>
              <div className={styles.browserFrame}>
                <div className={styles.browserBar}>
                  <span className={styles.browserDots}>
                    <span className={styles.dot} />
                    <span className={styles.dot} />
                    <span className={styles.dot} />
                  </span>
                  <span className={styles.addressBar}>{app.url}</span>
                </div>
                <div className={styles.browserContent}>
                  <ShowcaseCardContent app={app} />
                </div>
              </div>

              <p className={styles.cardDesc}>{app.name}</p>
            </div>
          ))}
        </div>
      </section>

      <section
        ref={trustReveal.ref}
        className={classNames(styles.infoBlock, styles.reveal, { [styles.revealVisible]: trustReveal.visible })}
      >
        <div className={styles.infoBlockRow}>
          <div className={styles.infoBlockText}>
            <div className={styles.infoBlockHeaderRow}>
              <h3 className={styles.infoBlockTitle}>만든 다음이 더 중요하니까</h3>
              <a href="#" className={styles.infoBlockLink}>
                기술과 보안 자세히
              </a>
            </div>
            <ul className={classNames(styles.infoList, { [styles.revealVisible]: trustReveal.visible })}>
              {TRUST_LINES.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>

          {/* 데이터가 앱마다 분리된 상자에 담긴 모습 — 선/면만, 코랄+회갈색 */}
          <div className={styles.trustGraphic} aria-hidden="true">
            <span className={styles.trustBox} />
            <span className={styles.trustBox} />
            <span className={classNames(styles.trustBox, styles.trustBoxAccent)} />
            <span className={styles.trustBox} />
          </div>
        </div>
      </section>

      <section
        ref={pricingReveal.ref}
        className={classNames(styles.infoBlock, styles.reveal, { [styles.revealVisible]: pricingReveal.visible })}
      >
        <div className={styles.infoBlockRow}>
          <div className={styles.infoBlockText}>
            <div className={styles.infoBlockHeaderRow}>
              <h3 className={styles.infoBlockTitle}>요금제</h3>
              <a href="/pricing" className={styles.infoBlockLink}>
                요금제 자세히
              </a>
            </div>
            <ul className={classNames(styles.infoList, { [styles.revealVisible]: pricingReveal.visible })}>
              {PRICING_TIERS.map((tier) => (
                <li key={tier.label} className={styles.pricingListItem}>
                  <span
                    className={styles.pricingTierMark}
                    style={{ background: `rgba(255, 83, 48, ${tier.intensity})` }}
                    aria-hidden="true"
                  />
                  {tier.label}
                </li>
              ))}
            </ul>
          </div>

          {/* 네 플랜을 나타내는 계단형 도형 — 코랄 농도(투명도)로 단계 표현 */}
          <div className={styles.pricingGraphic} aria-hidden="true">
            <span className={styles.pricingStep} style={{ height: '22%', opacity: 0.18 }} />
            <span className={styles.pricingStep} style={{ height: '48%', opacity: 0.4 }} />
            <span className={styles.pricingStep} style={{ height: '74%', opacity: 0.65 }} />
            <span className={styles.pricingStep} style={{ height: '100%', opacity: 1 }} />
          </div>
        </div>
      </section>

      <section
        ref={finalCtaReveal.ref}
        className={classNames(styles.finalCta, styles.reveal, { [styles.revealVisible]: finalCtaReveal.visible })}
      >
        <p className={styles.finalCtaHeadline}>지금 떠오른 그거, 오늘 주소로 만들어요</p>
        <button type="button" className={styles.primaryCta} onClick={onEnter}>
          시작하기
        </button>
        <p className={styles.footerLegal}>
          코랄레드 · 대표 한성민 · 사업자등록번호 383-23-02498 · coralred@coralred.kr
        </p>
      </section>
    </div>
  );
}
