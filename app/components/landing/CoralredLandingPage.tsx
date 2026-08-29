import { useEffect, useRef, useState } from 'react';
import { classNames } from '~/utils/classNames';
import styles from './CoralredLandingPage.module.scss';

interface CoralredLandingPageProps {
  /** Called when the visitor clicks any "enter the app" CTA (시작하기). */
  onEnter: () => void;
}

/*
 * Fires once when the returned ref's element first enters the viewport, then disconnects — so a
 * section that's already been revealed never re-animates on a later scroll past it. Skips straight
 * to visible (no animation at all) when the visitor has prefers-reduced-motion set.
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

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );

    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

interface LogoPiece {
  x: number;
  y: number;
  size: number;
  radius: number;
  fill: string;
  dx: number;
  dy: number;
  rot: number;
  delayMs: number;
  breatheDelayMs: number;
  breatheDurationMs: number;
  floatPx: number;
  spreadX: number;
  spreadY: number;
}

/*
 * Same 6 pieces as public/logo/coralred-symbol.svg — scattered start position per piece for the
 * one-shot assembly animation, converging on their real coordinates. breatheDelayMs/DurationMs
 * drive the always-on ambient motion that starts once assembly settles — different durations
 * (5-7s) per piece, not just a fixed initial offset, so they keep drifting in and out of phase
 * over time. floatPx (2-3px, negative = rises then sinks back) varies per piece too, on top of the
 * shared 1-1.5% scale breathing — see .pieceBreathe in the stylesheet. spreadX/spreadY (~9px, unit
 * vector of dx/dy scaled way down) drive the hover-only "spread apart" reaction — 3-4x the ambient
 * float's amplitude, reusing each piece's original scatter direction so the hover nudge and the
 * entrance animation read as the same underlying motion at different scales.
 */
const LOGO_PIECES: LogoPiece[] = [
  {
    x: 153,
    y: 63,
    size: 104,
    radius: 30,
    fill: '#FF5330',
    dx: -40,
    dy: -160,
    rot: -25,
    delayMs: 0,
    breatheDelayMs: 1300,
    breatheDurationMs: 5200,
    floatPx: -2.2,
    spreadX: -2,
    spreadY: -9,
  },
  {
    x: 63,
    y: 153,
    size: 104,
    radius: 30,
    fill: '#FF5330',
    dx: -180,
    dy: 20,
    rot: 20,
    delayMs: 70,
    breatheDelayMs: 1450,
    breatheDurationMs: 6400,
    floatPx: -2.8,
    spreadX: -9,
    spreadY: 1,
  },
  {
    x: 63,
    y: 255,
    size: 104,
    radius: 30,
    fill: '#FF5330',
    dx: -160,
    dy: 140,
    rot: -15,
    delayMs: 140,
    breatheDelayMs: 1200,
    breatheDurationMs: 5800,
    floatPx: -2.4,
    spreadX: -7,
    spreadY: 6,
  },
  {
    x: 153,
    y: 345,
    size: 104,
    radius: 30,
    fill: '#FF5330',
    dx: 30,
    dy: 180,
    rot: 25,
    delayMs: 210,
    breatheDelayMs: 1600,
    breatheDurationMs: 7000,
    floatPx: -3,
    spreadX: 1,
    spreadY: 9,
  },
  {
    x: 289,
    y: 84,
    size: 84,
    radius: 26,
    fill: '#FFB5A3',
    dx: 160,
    dy: -120,
    rot: -20,
    delayMs: 280,
    breatheDelayMs: 1350,
    breatheDurationMs: 6100,
    floatPx: -2.6,
    spreadX: 7,
    spreadY: -5,
  },
  {
    x: 289,
    y: 344,
    size: 84,
    radius: 26,
    fill: '#FFB5A3',
    dx: 180,
    dy: 130,
    rot: 18,
    delayMs: 350,
    breatheDelayMs: 1550,
    breatheDurationMs: 5500,
    floatPx: -2,
    spreadX: 7,
    spreadY: 5,
  },
];

function LogoAssembly({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} role="img" aria-label="코랄레드">
      {LOGO_PIECES.map((piece, index) => (
        <g
          key={index}
          className={styles.pieceSpread}
          style={
            {
              '--spread-x': `${piece.spreadX}px`,
              '--spread-y': `${piece.spreadY}px`,
            } as React.CSSProperties
          }
        >
          <g
            className={styles.pieceBreathe}
            style={
              {
                '--float': `${piece.floatPx}px`,
                animationDelay: `${piece.breatheDelayMs}ms`,
                animationDuration: `${piece.breatheDurationMs}ms`,
              } as React.CSSProperties
            }
          >
            <rect
              x={piece.x}
              y={piece.y}
              width={piece.size}
              height={piece.size}
              rx={piece.radius}
              fill={piece.fill}
              className={styles.piece}
              style={
                {
                  '--dx': `${piece.dx}px`,
                  '--dy': `${piece.dy}px`,
                  '--rot': `${piece.rot}deg`,
                  animationDelay: `${piece.delayMs}ms`,
                } as React.CSSProperties
              }
            />
          </g>
        </g>
      ))}
    </svg>
  );
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

interface AppMockup {
  name: string;
  desc: string;
  url: string;
  kind: 'number' | 'list';
  label?: string;
  value?: string;
  items?: string[];
}

/*
 * 6개 예시 앱 — 이름/설명은 사용자가 준 문구를 그대로 씀. 마지막 둘(동네 미용실, 책갈피)은
 * "이름(설명)" 형태로 안 주어져서 짧은 이름을 새로 붙였다. 목업 화면 안 강조색은 이제 카드마다
 * 다르지 않다 — 잉크/회갈색만 쓰고, number 타입의 큰 숫자 한 곳에만 코랄을 준다(전역 "코랄은
 * 로고·시작하기 버튼·강조 한 곳만" 규칙 그대로). 주소는 실제로 배포된 프로젝트를 가리키지 않는
 * 예시 형태 텍스트라 미니 브라우저의 가짜 주소창에만 쓴다.
 */
const SHOWCASE_APPS: AppMockup[] = [
  {
    name: '모카빈 카페',
    desc: '포인트 적립',
    url: 'coralred-app-31.pages.dev',
    kind: 'number',
    label: '내 포인트',
    value: '1,240P',
  },
  {
    name: '자산모아',
    desc: '자산 현황',
    url: 'coralred-app-47.pages.dev',
    kind: 'number',
    label: '총 자산',
    value: '8,450,000원',
  },
  {
    name: '은혜교회 소식',
    desc: '공지 리스트',
    url: 'coralred-app-52.pages.dev',
    kind: 'list',
    items: ['주일예배 안내', '청년부 모임', '성경공부반 모집'],
  },
  {
    name: '트렌드파일럿',
    desc: '투자 기록',
    url: 'coralred-app-63.pages.dev',
    kind: 'number',
    label: '이번 달 수익률',
    value: '+12.4%',
  },
  {
    name: '동네 미용실',
    desc: '예약 시간표',
    url: 'coralred-app-74.pages.dev',
    kind: 'list',
    items: ['10:00 컷트', '13:00 펌', '15:30 염색'],
  },
  {
    name: '책갈피',
    desc: '독서 기록',
    url: 'coralred-app-89.pages.dev',
    kind: 'list',
    items: ['아주 작은 습관의 힘', '불편한 편의점', '눈물의 왕'],
  },
];

const TRUST_LINES = ['내 앱 데이터는 내 것만', '함부로 배포되지 않아요', '실패하면 돈을 받지 않아요'];

const PRICING_LINES = [
  '무료 0원 · 앱 만들어보기',
  '라이트 9,900원 · 배포와 주소, 데이터 저장',
  '프로 29,900원 · 내 도메인, 카카오 로그인',
];

export function CoralredLandingPage({ onEnter }: CoralredLandingPageProps) {
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
            <a href="/login" className={styles.navLink}>
              로그인
            </a>
            <a href="/signup" className={styles.navLink}>
              회원가입
            </a>
          </div>
        </div>

        <div className={styles.heroMiddle}>
          <div className={styles.heroCluster}>
            <div className={styles.logoColumn}>
              <LogoAssembly className={styles.logoAssembly} />
            </div>

            <div className={styles.heroCopy}>
              <p className={styles.taglineMain}>아이디어만 가져오세요</p>
              <p className={styles.taglineSub}>설명만 하세요. 나머지는 저희가</p>
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
                  <p className={styles.mockupHeader}>{app.name}</p>
                  {app.kind === 'number' ? (
                    <>
                      <p className={styles.mockupLabel}>{app.label}</p>
                      <p className={styles.mockupNumber}>{app.value}</p>
                    </>
                  ) : (
                    <ul className={styles.mockupList}>
                      {app.items?.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <p className={styles.cardDesc}>{app.desc}</p>
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
              {PRICING_LINES.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>

          {/* 세 플랜을 나타내는 계단형 도형 — 코랄 농도(투명도)로 단계 표현 */}
          <div className={styles.pricingGraphic} aria-hidden="true">
            <span className={styles.pricingStep} style={{ height: '38%', opacity: 0.35 }} />
            <span className={styles.pricingStep} style={{ height: '68%', opacity: 0.65 }} />
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
