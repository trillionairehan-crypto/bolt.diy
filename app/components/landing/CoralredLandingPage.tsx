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
}

/*
 * Same 6 pieces as public/logo/coralred-symbol.svg — scattered start position per piece for the
 * assembly animation, converging on their real coordinates (see CoralredLandingPage.module.scss).
 */
const LOGO_PIECES: LogoPiece[] = [
  { x: 153, y: 63, size: 104, radius: 30, fill: '#FF5330', dx: -40, dy: -160, rot: -25, delayMs: 0 },
  { x: 63, y: 153, size: 104, radius: 30, fill: '#FF5330', dx: -180, dy: 20, rot: 20, delayMs: 70 },
  { x: 63, y: 255, size: 104, radius: 30, fill: '#FF5330', dx: -160, dy: 140, rot: -15, delayMs: 140 },
  { x: 153, y: 345, size: 104, radius: 30, fill: '#FF5330', dx: 30, dy: 180, rot: 25, delayMs: 210 },
  { x: 289, y: 84, size: 84, radius: 26, fill: '#FFB5A3', dx: 160, dy: -120, rot: -20, delayMs: 280 },
  { x: 289, y: 344, size: 84, radius: 26, fill: '#FFB5A3', dx: 180, dy: 130, rot: 18, delayMs: 350 },
];

function LogoAssembly({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} role="img" aria-label="코랄레드">
      {LOGO_PIECES.map((piece, index) => (
        <rect
          key={index}
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

/*
 * 6개 예시 앱 — 이름/설명은 사용자가 준 문구를 그대로 씀. 마지막 둘(동네 미용실 예약, 독서
 * 기록)은 "이름(설명)" 형태로 안 주어져서 짧은 이름을 새로 붙였다. 주소는 실제로 배포된
 * 프로젝트를 가리키지 않는 예시 형태 텍스트라 클릭 불가능한 일반 텍스트로만 표시한다.
 */
const SHOWCASE_APPS = [
  { name: '모카빈 카페', desc: '포인트 적립', url: 'coralred-app-31.pages.dev' },
  { name: '자산모아', desc: '자산 관리', url: 'coralred-app-47.pages.dev' },
  { name: '은혜교회 소식', desc: '공지·행사', url: 'coralred-app-52.pages.dev' },
  { name: '트렌드파일럿', desc: '투자 기록', url: 'coralred-app-63.pages.dev' },
  { name: '동네 미용실', desc: '예약 관리', url: 'coralred-app-74.pages.dev' },
  { name: '책갈피', desc: '독서 기록', url: 'coralred-app-89.pages.dev' },
];

export function CoralredLandingPage({ onEnter }: CoralredLandingPageProps) {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.topBar}>
          <LogoMark className={styles.logoSmall} />
          <div className={styles.topRight}>
            <a href="/login" className={styles.loginLink}>
              로그인
            </a>
            <button type="button" className={styles.startButton} onClick={onEnter}>
              시작하기
            </button>
          </div>
        </div>

        <div className={styles.heroMiddle}>
          <div className={styles.ctaColumn}>
            <button type="button" className={styles.primaryCta} onClick={onEnter}>
              앱 만들러 가기
            </button>
            <a href="#showcase" className={styles.showcaseLink}>
              만든 앱 구경하기
            </a>
          </div>

          <div className={styles.logoColumn}>
            <LogoAssembly className={styles.logoAssembly} />
          </div>

          <div className={styles.taglineColumn}>
            <p className={styles.tagline}>말하면 만들어져요</p>
            <p className={styles.tagline}>버튼 하나로 진짜 주소가 나와요</p>
            <p className={styles.tagline}>코딩은 몰라도 돼요</p>
          </div>
        </div>

        <p className={styles.corner}>가입 없이 첫 앱을 만들어볼 수 있어요</p>
      </section>

      <section id="showcase" className={styles.showcase}>
        <h2 className={styles.showcaseTitle}>코랄레드로 만들어진 앱</h2>

        <div className={styles.grid}>
          {SHOWCASE_APPS.map((app) => (
            <div key={app.name} className={styles.card}>
              <p className={styles.cardName}>{app.name}</p>
              <p className={styles.cardDesc}>{app.desc}</p>
              <p className={styles.cardUrl}>{app.url}</p>
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
