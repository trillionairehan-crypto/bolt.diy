import { useState, type CSSProperties } from 'react';
import { useStore } from '@nanostores/react';
import { authUserStore } from '~/lib/stores/auth';
import { setSidebarOpen } from '~/lib/stores/sidebar';
import { LoginModal } from '~/components/auth/LoginModal';
import styles from './CoralredHero.module.scss';

interface CoralredHeroProps {
  onFocusPrompt: () => void;
}

interface TileSpec {
  side: 'left' | 'right';
  offset: number; // % from that side's edge
  top: number; // % from top
  size: number; // px
  radius: number; // %
  variant: 'cream' | 'peach';
  floatDuration: number;
  floatDelay: number;
}

/*
 * Demoted to ambient decoration for the landing rebuild — small, scattered along the edges so
 * they never compete with the input card for attention. Sizes are ~72% of the original cluster's,
 * positions expressed relative to each side so they read as a loose halo around the centered
 * column rather than a self-contained block.
 */
const TILE_POSITIONS: TileSpec[] = [
  { side: 'right', offset: 7, top: 14, size: 70, radius: 29, variant: 'cream', floatDuration: 3.6, floatDelay: 0 },
  { side: 'left', offset: 6, top: 22, size: 70, radius: 29, variant: 'cream', floatDuration: 4.2, floatDelay: 0.6 },
  { side: 'right', offset: 4, top: 34, size: 57, radius: 31, variant: 'peach', floatDuration: 4.0, floatDelay: 0.9 },
  { side: 'right', offset: 8, top: 56, size: 70, radius: 29, variant: 'cream', floatDuration: 3.9, floatDelay: 1.2 },
  { side: 'left', offset: 9, top: 62, size: 57, radius: 31, variant: 'peach', floatDuration: 3.7, floatDelay: 1.5 },
  { side: 'right', offset: 5, top: 76, size: 70, radius: 29, variant: 'cream', floatDuration: 4.4, floatDelay: 0.3 },
];

const CREAM_BG = '#FAF7F0';
const CREAM_INK = '#FF5330';
const PEACH_BG = '#FFB5A3';
const PEACH_INK = '#8F2410';

function floatStyle(spec: TileSpec): CSSProperties {
  return {
    [spec.side]: `${spec.offset}%`,
    top: `${spec.top}%`,
    width: `${spec.size}px`,
    height: `${spec.size}px`,
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

  return (
    <div className={styles.container} role="group" aria-label="코랄레드 바로가기">
      <div className={`${styles.tileFloat} ${styles.tileRight}`} style={floatStyle(TILE_POSITIONS[0])}>
        <button
          type="button"
          aria-label="새 앱 만들기"
          className={styles.tile}
          style={tileStyle(TILE_POSITIONS[0], 0)}
          onClick={onFocusPrompt}
        >
          <span className={styles.dot} />
          <span className={styles.label}>새 앱 만들기</span>
        </button>
      </div>

      <div className={`${styles.tileFloat} ${styles.tileLeft}`} style={floatStyle(TILE_POSITIONS[1])}>
        <button
          type="button"
          aria-label="내 프로젝트"
          className={styles.tile}
          style={tileStyle(TILE_POSITIONS[1], 1)}
          onClick={openAccount}
        >
          <span className={styles.dot} />
          <span className={styles.label}>내 프로젝트</span>
        </button>
      </div>

      <div className={`${styles.tileFloat} ${styles.tileRight}`} style={floatStyle(TILE_POSITIONS[2])}>
        <a href="/templates" aria-label="템플릿" className={styles.tile} style={tileStyle(TILE_POSITIONS[2], 2)}>
          <span className={styles.dot} />
          <span className={styles.label}>템플릿</span>
        </a>
      </div>

      <div className={`${styles.tileFloat} ${styles.tileRight}`} style={floatStyle(TILE_POSITIONS[3])}>
        <a href="/pricing" aria-label="요금제" className={styles.tile} style={tileStyle(TILE_POSITIONS[3], 3)}>
          <span className={styles.dot} />
          <span className={styles.label}>요금제</span>
        </a>
      </div>

      <div className={`${styles.tileFloat} ${styles.tileLeft}`} style={floatStyle(TILE_POSITIONS[4])}>
        <button
          type="button"
          aria-label={authUser ? '내 계정' : '로그인'}
          className={styles.tile}
          style={tileStyle(TILE_POSITIONS[4], 4)}
          onClick={openAccount}
        >
          <span className={styles.dot} />
          <span className={styles.label}>{authUser ? '내 계정' : '로그인'}</span>
        </button>
      </div>

      <div className={`${styles.tileFloat} ${styles.tileRight}`} style={floatStyle(TILE_POSITIONS[5])}>
        <a
          href="mailto:coralred@coralred.kr"
          aria-label="문의"
          className={styles.tile}
          style={tileStyle(TILE_POSITIONS[5], 5)}
        >
          <span className={styles.dot} />
          <span className={styles.label}>문의</span>
        </a>
      </div>

      <LoginModal open={showLogin} onClose={() => setShowLogin(false)} />
    </div>
  );
}
