import { useEffect, useRef, useState } from 'react';
import { classNames } from '~/utils/classNames';
import { LogoAssembly } from '~/components/ui/LogoAssembly';
import { SHOWCASE_APPS } from './showcaseApps';
import { SkeletonShowcaseCard } from './SkeletonShowcaseCard';
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
            <SkeletonShowcaseCard key={app.name} app={app} />
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
