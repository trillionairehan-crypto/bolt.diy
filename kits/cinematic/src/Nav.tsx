import { useEffect, useState } from 'react';

export interface NavProps {
  brand: string;
  links?: Array<{ label: string; href: string }>;
  cta?: { label: string; href: string };
}

/** 상단 고정 내비 — 처음엔 투명, 스크롤하면 블러 배경. 링크는 3개 이하로. */
export function Nav({ brand, links = [], cta }: NavProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      data-ck="nav"
      style={{
        position: 'fixed',
        inset: '0 0 auto 0',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '24px',
        padding: '18px var(--ck-gutter)',
        color: 'var(--ck-text)',
        background: scrolled ? 'color-mix(in srgb, var(--ck-bg) 72%, transparent)' : 'transparent',
        backdropFilter: scrolled ? 'blur(14px)' : 'none',
        transition: 'background 400ms, backdrop-filter 400ms',
      }}
    >
      <a href="#" data-cursor="hover" style={{ fontFamily: 'var(--ck-font-display)', fontWeight: 600, fontSize: '20px', textDecoration: 'none', color: 'inherit', letterSpacing: '-0.01em' }}>
        {brand}
      </a>
      <nav style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
        {links.map((link) => (
          <a key={link.href} href={link.href} data-cursor="hover" style={{ fontSize: '14px', textDecoration: 'none', color: 'inherit', opacity: 0.8 }}>
            {link.label}
          </a>
        ))}
        {cta ? (
          <a className="ck-btn" href={cta.href} data-cursor="hover" style={{ padding: '10px 18px', fontSize: '14px' }}>
            {cta.label}
          </a>
        ) : null}
      </nav>
    </header>
  );
}
