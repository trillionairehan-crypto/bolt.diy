import type { ReactNode } from 'react';
import { Logo } from '~/components/ui/Logo';
import styles from './PageShell.module.scss';

interface PageShellProps {
  headline: string;
  subheadline: string;
  children: ReactNode;
}

/**
 * /apps, /guide 등 채팅 홈이 아닌 정보성 페이지가 공유하는 셸 — 좌상단 로고, "← 채팅으로",
 * 헤드라인/서브헤드, 사업자 정보 푸터까지 한 곳에서 관리한다. 새 정보성 페이지를 만들 때마다
 * 여기 구조를 다시 베끼지 말고 이 컴포넌트를 감싸 쓴다.
 */
export function PageShell({ headline, subheadline, children }: PageShellProps) {
  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <a href="/" className={styles.logoLink}>
          <Logo height={24} showWordmark={false} />
        </a>
      </div>

      <div className={styles.container}>
        <a href="/" className={styles.backLink}>
          ← 채팅으로
        </a>
        <h1 className={styles.headline}>{headline}</h1>
        <p className={styles.subheadline}>{subheadline}</p>
        <div className={styles.body}>{children}</div>
      </div>

      <footer className={styles.footer}>
        <p className={styles.footerLine}>코랄레드 · 대표자 한성민 · 사업자등록번호 383-23-02498</p>
        <p className={styles.footerLine}>경기도 여주시 가남읍 심석2길 50-6 · coralred.kr</p>
        <p className={styles.footerLine}>
          <a href="mailto:coralred@coralred.kr" className={styles.footerLink}>
            coralred@coralred.kr
          </a>{' '}
          ·{' '}
          <a href="/terms" className={styles.footerLink}>
            이용약관
          </a>{' '}
          ·{' '}
          <a href="/privacy" className={styles.footerLink}>
            개인정보처리방침
          </a>
        </p>
      </footer>
    </div>
  );
}
