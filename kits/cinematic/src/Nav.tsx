import { useEffect, useState } from 'react';
import { useIsDesktop } from './hooks';

export interface NavProps {
  brand: string;
  links?: Array<{ label: string; href: string }>;
  cta?: { label: string; href: string };
}

/** 상단 고정 내비 — 처음엔 투명, 스크롤하면 블러 배경. 링크는 3개 이하로. */
export function Nav({ brand, links = [], cta }: NavProps) {
  const [scrolled, setScrolled] = useState(false);

  /*
   * 400px에서는 브랜드·링크 3개·CTA가 한 줄에 다 안 들어가 링크가 글자 단위로 세로로 쪼개진다
   * (2026-09-12 생성물 모바일 실측). 좁은 화면에서는 링크를 접고 브랜드와 CTA만 남긴다 — 섹션 이동은
   * SceneNav가 맡는다.
   */
  const isDesktop = useIsDesktop();

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
        // 히어로(항상 어두운 사진) 위에서는 흰색, 스크롤해 블러 배경이 깔리면 킷 글자색.
        color: scrolled ? 'var(--ck-text)' : '#fff',
        background: scrolled ? 'color-mix(in srgb, var(--ck-bg) 72%, transparent)' : 'transparent',
        backdropFilter: scrolled ? 'blur(14px)' : 'none',
        transition: 'background 400ms, backdrop-filter 400ms',
      }}
    >
      <a href="#" data-cursor="hover" style={{ fontFamily: 'var(--ck-font-display)', fontWeight: 600, fontSize: '20px', textDecoration: 'none', color: 'inherit', letterSpacing: '-0.01em' }}>
        {brand}
      </a>
      <nav style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
        {isDesktop
          ? links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                data-cursor="hover"
                style={{ fontSize: '14px', textDecoration: 'none', color: 'inherit', opacity: 0.8, whiteSpace: 'nowrap' }}
              >
                {link.label}
              </a>
            ))
          : null}
        {cta ? (
          <a className="ck-btn" href={cta.href} data-cursor="hover" style={{ padding: '10px 18px', fontSize: '14px', whiteSpace: 'nowrap' }}>
            {cta.label}
          </a>
        ) : null}
      </nav>
    </header>
  );
}
