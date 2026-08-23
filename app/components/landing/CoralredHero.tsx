import { useState, type CSSProperties } from 'react';
import { useStore } from '@nanostores/react';
import { authUserStore } from '~/lib/stores/auth';
import { setSidebarOpen } from '~/lib/stores/sidebar';
import { EmailOtpModal } from '~/components/auth/EmailOtpModal';
import styles from './CoralredHero.module.scss';

interface CoralredHeroProps {
  onFocusPrompt: () => void;
}

interface TileSpec {
  left: number;
  top: number;
  size: number;
  radius: number;
  variant: 'cream' | 'peach';
  floatDuration: number;
  floatDelay: number;
}

// Coordinates are the 512-grid spec values expressed as % of the (square) container.
const TILE_POSITIONS: TileSpec[] = [
  { left: 29.88, top: 12.3, size: 20.31, radius: 29, variant: 'cream', floatDuration: 3.6, floatDelay: 0 },
  { left: 12.3, top: 29.88, size: 20.31, radius: 29, variant: 'cream', floatDuration: 4.2, floatDelay: 0.6 },
  { left: 12.3, top: 49.8, size: 20.31, radius: 29, variant: 'cream', floatDuration: 3.9, floatDelay: 1.2 },
  { left: 29.88, top: 67.38, size: 20.31, radius: 29, variant: 'cream', floatDuration: 4.4, floatDelay: 0.3 },
  { left: 56.45, top: 16.41, size: 16.41, radius: 31, variant: 'peach', floatDuration: 4.0, floatDelay: 0.9 },
  { left: 56.45, top: 67.19, size: 16.41, radius: 31, variant: 'peach', floatDuration: 3.7, floatDelay: 1.5 },
];

const CREAM_BG = '#FAF7F0';
const CREAM_INK = '#FF5330';
const PEACH_BG = '#FFB5A3';
const PEACH_INK = '#8F2410';

function floatStyle(spec: TileSpec): CSSProperties {
  return {
    left: `${spec.left}%`,
    top: `${spec.top}%`,
    width: `${spec.size}%`,
    height: `${spec.size}%`,
    animationDuration: `${spec.floatDuration}s`,
    animationDelay: `${spec.floatDelay}s`,
  };
}

function tileStyle(spec: TileSpec, index: number): CSSProperties {
  return {
    background: spec.variant === 'cream' ? CREAM_BG : PEACH_BG,
    color: spec.variant === 'cream' ? CREAM_INK : PEACH_INK,
    borderRadius: `${spec.radius}%`,
    animationDelay: `${150 + index * 70}ms`,
  };
}

export function CoralredHero({ onFocusPrompt }: CoralredHeroProps) {
  const authUser = useStore(authUserStore);
  const [showLogin, setShowLogin] = useState(false);

  const openAccount = () => {
    if (authUser) {
      setSidebarOpen(true);
    } else {
      setShowLogin(true);
    }
  };

  const scrollToTemplates = () => {
    const el = document.getElementById('examples');

    if (!el) {
      return;
    }

    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add(styles.examplesHighlight);
    setTimeout(() => el.classList.remove(styles.examplesHighlight), 700);
  };

  return (
    <div className={styles.container} role="group" aria-label="코랄레드 바로가기">
      <div className={styles.tileFloat} style={floatStyle(TILE_POSITIONS[0])}>
        <button type="button" className={styles.tile} style={tileStyle(TILE_POSITIONS[0], 0)} onClick={onFocusPrompt}>
          <span className={styles.dot} />
          <span className={styles.label}>새 앱 만들기</span>
        </button>
      </div>

      <div className={styles.tileFloat} style={floatStyle(TILE_POSITIONS[1])}>
        <button
          type="button"
          className={styles.tile}
          style={tileStyle(TILE_POSITIONS[1], 1)}
          onClick={scrollToTemplates}
        >
          <span className={styles.dot} />
          <span className={styles.label}>템플릿</span>
        </button>
      </div>

      <div className={styles.tileFloat} style={floatStyle(TILE_POSITIONS[2])}>
        <button type="button" className={styles.tile} style={tileStyle(TILE_POSITIONS[2], 2)} onClick={openAccount}>
          <span className={styles.dot} />
          <span className={styles.label}>내 프로젝트</span>
        </button>
      </div>

      <div className={styles.tileFloat} style={floatStyle(TILE_POSITIONS[3])}>
        <a href="/pricing" className={styles.tile} style={tileStyle(TILE_POSITIONS[3], 3)}>
          <span className={styles.dot} />
          <span className={styles.label}>요금제</span>
        </a>
      </div>

      <div className={styles.tileFloat} style={floatStyle(TILE_POSITIONS[4])}>
        <button type="button" className={styles.tile} style={tileStyle(TILE_POSITIONS[4], 4)} onClick={openAccount}>
          <span className={styles.dot} />
          <span className={styles.label}>{authUser ? '내 계정' : '로그인'}</span>
        </button>
      </div>

      <div className={styles.tileFloat} style={floatStyle(TILE_POSITIONS[5])}>
        <a href="mailto:coralred@coralred.kr" className={styles.tile} style={tileStyle(TILE_POSITIONS[5], 5)}>
          <span className={styles.dot} />
          <span className={styles.label}>문의</span>
        </a>
      </div>

      <EmailOtpModal open={showLogin} onClose={() => setShowLogin(false)} />
    </div>
  );
}
