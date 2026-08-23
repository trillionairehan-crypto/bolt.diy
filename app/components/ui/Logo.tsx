interface LogoProps {
  height?: number;
  className?: string;
}

/** Coralred mark, inline SVG (same coordinates as public/logo/coralred-symbol.svg). */
export function Logo({ height = 24, className }: LogoProps) {
  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <svg viewBox="0 0 512 512" width={height} height={height} aria-hidden="true">
        <rect x="153" y="63" width="104" height="104" rx="30" fill="#FF5330" />
        <rect x="63" y="153" width="104" height="104" rx="30" fill="#FF5330" />
        <rect x="63" y="255" width="104" height="104" rx="30" fill="#FF5330" />
        <rect x="153" y="345" width="104" height="104" rx="30" fill="#FF5330" />
        <rect x="289" y="84" width="84" height="84" rx="26" fill="#FFB5A3" />
        <rect x="289" y="344" width="84" height="84" rx="26" fill="#FFB5A3" />
      </svg>
      <span style={{ color: 'var(--bolt-elements-textPrimary)', fontWeight: 700, fontSize: 18 }}>코랄레드</span>
    </span>
  );
}
