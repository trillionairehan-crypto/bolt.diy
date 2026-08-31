import { useEffect, useRef, useState } from 'react';
import { classNames } from '~/utils/classNames';
import styles from './LogoAssembly.module.scss';

/*
 * 로그인/회원가입 브랜드 디테일 라운드 — 원래 CoralredLandingPage.tsx 안에 로컬로만 있던
 * LogoAssembly를 공용 컴포넌트로 뺐다(AuthPageShell.tsx가 재사용 대상). 랜딩(큰 크기, 넓은 흩어짐,
 * 1.3s)과 로그인(64px, 좁은 흩어짐 6~10px, 500ms)이 타이밍/흩어짐 폭만 다르고 조각 배치·구조는
 * 완전히 같아서, 그 차이만 프롭으로 뺐다 — 값 자체(6개 조각의 x/y/size/fill, hover 반응 방향)는
 * 원본과 100% 동일하게 유지.
 */
export interface LogoPiece {
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

export const LOGO_PIECES: LogoPiece[] = [
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

const WIDE_EASING = 'cubic-bezier(0.16, 1, 0.3, 1)';

export interface LogoAssemblyProps {
  className?: string;

  /** px 고정 크기 — 주면 width/height를 인라인으로 설정한다(로그인의 64px 케이스). 안 주면 className의 반응형 크기를 그대로 쓴다(랜딩). */
  size?: number;

  /** 'wide' = 원래 랜딩의 큰 흩어짐(dx/dy). 'compact' = 6~10px 흩어짐(spreadX/spreadY 재사용, 로그인용). */
  scatter?: 'wide' | 'compact';

  /** 진입 애니메이션 길이 — 기본 1300ms(랜딩). */
  durationMs?: number;

  /** 조각마다 순차 딜레이(ms) — 주면 index*staggerMs로 균등 적용, 안 주면 조각별 delayMs(랜딩 원본) 사용. */
  staggerMs?: number;

  /** 진입 easing — 기본 랜딩의 cubic-bezier. */
  easing?: string;

  /** hover/tap 시 조각이 살짝 벌어지는 반응 — 기본 true(랜딩). */
  hoverReaction?: boolean;

  /** 조립 후 계속되는 미세한 숨쉬기 모션 — 기본 true. */
  breathe?: boolean;

  /** 2: OAuth 이동 직전 로고 전체가 한 번 튀는 반응(scale 1→1.08→1, 250ms) — true로 바뀌는 순간 재생. */
  pulse?: boolean;
}

export function LogoAssembly({
  className,
  size,
  scatter = 'wide',
  durationMs = 1300,
  staggerMs,
  easing = WIDE_EASING,
  hoverReaction = true,
  breathe = true,
  pulse = false,
}: LogoAssemblyProps) {
  const [tapActive, setTapActive] = useState(false);
  const tapTimeoutRef = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      window.clearTimeout(tapTimeoutRef.current);
    },
    [],
  );

  const handleTap = () => {
    if (!hoverReaction) {
      return;
    }

    setTapActive(true);
    window.clearTimeout(tapTimeoutRef.current);
    tapTimeoutRef.current = window.setTimeout(() => setTapActive(false), 500);
  };

  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={classNames(className, styles.logoAssembly, {
        [styles.tapActive]: tapActive,
        [styles.pulse]: pulse,
      })}
      role="img"
      aria-label="코랄레드"
      onClick={handleTap}
    >
      {LOGO_PIECES.map((piece, index) => {
        const [dx, dy] = scatter === 'compact' ? [piece.spreadX, piece.spreadY] : [piece.dx, piece.dy];
        const delayMs = staggerMs !== undefined ? index * staggerMs : piece.delayMs;

        return (
          <g
            key={index}
            className={classNames({ [styles.pieceSpread]: hoverReaction })}
            style={
              {
                '--spread-x': `${piece.spreadX}px`,
                '--spread-y': `${piece.spreadY}px`,
              } as React.CSSProperties
            }
          >
            <g
              className={classNames({ [styles.pieceBreathe]: breathe })}
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
                    '--dx': `${dx}px`,
                    '--dy': `${dy}px`,
                    '--rot': `${piece.rot}deg`,
                    animationDelay: `${delayMs}ms`,
                    animationDuration: `${durationMs}ms`,
                    animationTimingFunction: easing,
                  } as React.CSSProperties
                }
              />
            </g>
          </g>
        );
      })}
    </svg>
  );
}
