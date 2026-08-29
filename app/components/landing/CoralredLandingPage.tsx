import styles from './CoralredLandingPage.module.scss';

interface CoralredLandingPageProps {
  /** Called when the visitor clicks any "enter the app" CTA (시작하기 / 앱 만들러 가기). */
  onEnter: () => void;
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
}

/*
 * Same 6 pieces as public/logo/coralred-symbol.svg — scattered start position per piece for the
 * one-shot assembly animation, converging on their real coordinates. breatheDelayMs/DurationMs
 * drive the always-on ambient motion that starts once assembly settles — different durations per
 * piece (not just a fixed initial offset) so they keep drifting in and out of phase over time
 * instead of just being a constant offset from each other (see .pieceBreathe in the stylesheet).
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
    breatheDurationMs: 4600,
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
    breatheDurationMs: 5200,
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
    breatheDurationMs: 4800,
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
    breatheDurationMs: 5600,
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
    breatheDurationMs: 5000,
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
    breatheDurationMs: 4400,
  },
];

function LogoAssembly({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} role="img" aria-label="코랄레드">
      {LOGO_PIECES.map((piece, index) => (
        <g
          key={index}
          className={styles.pieceBreathe}
          style={
            {
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
  accent: string;
  kind: 'number' | 'list';
  label?: string;
  value?: string;
  items?: string[];
}

/*
 * 6개 예시 앱 — 이름/설명은 사용자가 준 문구를 그대로 씀. 마지막 둘(동네 미용실, 책갈피)은
 * "이름(설명)" 형태로 안 주어져서 짧은 이름을 새로 붙였다. 목업 화면 안 강조색은 앱마다 다르게
 * (실제 앱들이 그러하듯) — 카드 프레임/페이지 자체의 브랜드 색 규칙과는 별개. 주소는 실제로
 * 배포된 프로젝트를 가리키지 않는 예시 형태 텍스트라 미니 브라우저의 가짜 주소창에만 쓴다.
 */
const SHOWCASE_APPS: AppMockup[] = [
  {
    name: '모카빈 카페',
    desc: '포인트 적립',
    url: 'coralred-app-31.pages.dev',
    accent: '#B45309',
    kind: 'number',
    label: '내 포인트',
    value: '1,240P',
  },
  {
    name: '자산모아',
    desc: '자산 현황',
    url: 'coralred-app-47.pages.dev',
    accent: '#0E7490',
    kind: 'number',
    label: '총 자산',
    value: '8,450,000원',
  },
  {
    name: '은혜교회 소식',
    desc: '공지 리스트',
    url: 'coralred-app-52.pages.dev',
    accent: '#6D28D9',
    kind: 'list',
    items: ['주일예배 안내', '청년부 모임', '성경공부반 모집'],
  },
  {
    name: '트렌드파일럿',
    desc: '투자 기록',
    url: 'coralred-app-63.pages.dev',
    accent: '#15803D',
    kind: 'number',
    label: '이번 달 수익률',
    value: '+12.4%',
  },
  {
    name: '동네 미용실',
    desc: '예약 시간표',
    url: 'coralred-app-74.pages.dev',
    accent: '#BE185D',
    kind: 'list',
    items: ['10:00 컷트', '13:00 펌', '15:30 염색'],
  },
  {
    name: '책갈피',
    desc: '독서 기록',
    url: 'coralred-app-89.pages.dev',
    accent: '#4338CA',
    kind: 'list',
    items: ['아주 작은 습관의 힘', '불편한 편의점', '눈물의 왕'],
  },
];

export function CoralredLandingPage({ onEnter }: CoralredLandingPageProps) {
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
          <a href="/login" className={styles.loginSignupLink}>
            로그인 / 회원가입
          </a>
        </div>

        <div className={styles.heroMiddle}>
          <div className={styles.ctaColumn}>
            <button type="button" className={styles.primaryCta} onClick={onEnter}>
              시작하기
            </button>
            <a href="#showcase" className={styles.showcaseLink}>
              만든 앱 구경하기
            </a>
          </div>

          <div className={styles.logoColumn}>
            <LogoAssembly className={styles.logoAssembly} />
          </div>

          <div className={styles.taglineColumn}>
            <p className={styles.taglineMain}>아이디어만 가져오세요</p>
            <p className={styles.taglineSub}>말하면 앱이 되고, 주소가 생겨요</p>
          </div>
        </div>

        <p className={styles.corner}>가입 없이 첫 앱을 만들어볼 수 있어요</p>
      </section>

      <section id="showcase" className={styles.showcase}>
        <h2 className={styles.showcaseTitle}>오늘 누군가는 이런 걸 만들었어요</h2>

        <div className={styles.grid}>
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
                  <p className={styles.mockupHeader} style={{ color: app.accent }}>
                    {app.name}
                  </p>
                  {app.kind === 'number' ? (
                    <>
                      <p className={styles.mockupLabel}>{app.label}</p>
                      <p className={styles.mockupNumber} style={{ color: app.accent }}>
                        {app.value}
                      </p>
                    </>
                  ) : (
                    <ul className={styles.mockupList}>
                      {app.items?.map((item) => (
                        <li key={item} style={{ borderColor: app.accent }}>
                          {item}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <p className={styles.cardName}>{app.name}</p>
              <p className={styles.cardDesc}>{app.desc}</p>
            </div>
          ))}
        </div>

        <div className={styles.showcaseFooter}>
          <button type="button" className={styles.primaryCta} onClick={onEnter}>
            앱 만들러 가기
          </button>
          <p className={styles.footerLegal}>
            코랄레드 · 대표 한성민 · 사업자등록번호 383-23-02498 · coralred@coralred.kr
          </p>
        </div>
      </section>
    </div>
  );
}
