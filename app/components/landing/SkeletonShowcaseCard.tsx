import { classNames } from '~/utils/classNames';
import type { ShowcaseApp } from './showcaseApps';
import styles from './SkeletonShowcaseCard.module.scss';

/** 7개 값을 카드 폭에 맞는 꺾은선 SVG로 — 운동 기록 카드의 유일한 코랄 지점. */
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

/** 우리 가게 매출 카드의 카테고리 도넛 — 이 카드의 유일한 코랄 접점(순이익 숫자는 잉크). */
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

interface SkeletonShowcaseCardProps {
  app: ShowcaseApp;

  /** 전달되면 카드가 버튼이 된다 — /examples에서 클릭 시 바로 전송에 쓴다. 랜딩에서는 안 준다. */
  onClick?: () => void;

  /**
   * 전달되면 호버 시 프레임 하단 중앙에 뜬다(카드 전체를 옅게 덮는 오버레이 없이 라벨만) —
   * onClick과 있으면 코랄 버튼처럼, 없으면(예: 메시지 소진) 회갈색 안내 문구로 보인다.
   */
  hoverLabel?: string;
  className?: string;
}

/**
 * 랜딩 섹션2와 /examples가 공유하는 골격 대표작 카드 — 미니 브라우저 프레임 + 골격별 콘텐츠 +
 * 아래 라벨. 프레임 마크업은 항상 동일하고 안쪽 콘텐츠만 app.kind로 갈라진다.
 */
export function SkeletonShowcaseCard({ app, onClick, hoverLabel, className }: SkeletonShowcaseCardProps) {
  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={classNames(styles.card, { [styles.cardClickable]: !!onClick }, className)}
    >
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

        {hoverLabel && (
          <div className={styles.hoverOverlay}>
            <span className={classNames(styles.hoverLabel, { [styles.hoverLabelDisabled]: !onClick })}>
              {hoverLabel}
            </span>
          </div>
        )}
      </div>

      <p className={styles.cardDesc}>{app.name}</p>
    </Wrapper>
  );
}
