interface LogoProps {
  height?: number;
  className?: string;

  /**
   * 'default' — coral symbol, for light/neutral backgrounds (legal pages, pricing, workspace
   * header). 'onCoral' — cream symbol, for placement directly on the coral brand surface (the
   * landing hero header) where a coral-on-coral symbol is invisible.
   */
  variant?: 'default' | 'onCoral';

  /** Wordmark text color override. Defaults to the theme text token for 'default', cream for 'onCoral'. */
  textColor?: string;

  /** false renders just the symbol — small top-bar/rail placements where "코랄레드" text doesn't fit. */
  showWordmark?: boolean;
}

const SYMBOL_FILL = { default: '#FF5330', onCoral: '#FAF7F0' } as const;

/** Coralred mark, inline SVG (same coordinates as public/logo/coralred-symbol.svg). */
export function Logo({ height = 24, className, variant = 'default', textColor, showWordmark = true }: LogoProps) {
  const mainFill = SYMBOL_FILL[variant];
  const resolvedTextColor = textColor ?? (variant === 'onCoral' ? '#FAF7F0' : 'var(--bolt-elements-textPrimary)');

  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <svg viewBox="0 0 512 512" width={height} height={height} aria-hidden="true">
        <rect x="153" y="63" width="104" height="104" rx="30" fill={mainFill} />
        <rect x="63" y="153" width="104" height="104" rx="30" fill={mainFill} />
        <rect x="63" y="255" width="104" height="104" rx="30" fill={mainFill} />
        <rect x="153" y="345" width="104" height="104" rx="30" fill={mainFill} />
        <rect x="289" y="84" width="84" height="84" rx="26" fill="#FFB5A3" />
        <rect x="289" y="344" width="84" height="84" rx="26" fill="#FFB5A3" />
      </svg>
      {showWordmark && (
        <span translate="no" style={{ color: resolvedTextColor, fontWeight: 700, fontSize: 18 }}>
          코랄레드
        </span>
      )}
    </span>
  );
}
