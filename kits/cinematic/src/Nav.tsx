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
        /*
         * v0.4: 배경 띠 없음. 스크롤 후 블러 바가 풀블리드 사진을 가로질러 검은 띠로 보였다(2026-09-18 감사).
         * 흰 글자 + difference 블렌드 — 사진·밝은 배경·어두운 배경 어디서나 읽히는 수상작 문법.
         */
        color: '#fff',
        mixBlendMode: 'difference',
        background: 'transparent',
        opacity: scrolled ? 0.92 : 1,
        transition: 'opacity 400ms',
      }}
    >
      {/* v0.4: 상호 16px·500, 링크는 13px 모노풍, CTA는 알약 대신 밑줄 링크 — 헤드라인 하나가 화면을 지배하도록 크롬을 낮춘다 */}
      <a href="#" className="ck-navlink" data-cursor="hover" style={{ fontFamily: 'var(--ck-font-body)', fontWeight: 500, fontSize: '16px', textDecoration: 'none', color: 'inherit', letterSpacing: '-0.01em' }}>
        {brand}
      </a>
      <nav style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
        {isDesktop
          ? links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="ck-navlink"
                data-cursor="hover"
                style={{ fontSize: '13px', textDecoration: 'none', color: 'inherit', opacity: 0.88, whiteSpace: 'nowrap' }}
              >
                {link.label}
              </a>
            ))
          : null}
        {cta ? (
          <a className="ck-btn" href={cta.href} data-cursor="hover" style={{ fontSize: '13px', padding: '2px 0', whiteSpace: 'nowrap' }}>
            {cta.label}
          </a>
        ) : null}
      </nav>
    </header>
  );
}
