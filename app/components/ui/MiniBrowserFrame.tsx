import type { ReactNode } from 'react';
import { classNames } from '~/utils/classNames';
import styles from './MiniBrowserFrame.module.scss';

interface MiniBrowserFrameProps {
  url: string;
  title: string;

  /** 'default' — 채팅 홈 "내가 만든 앱" 카드 크기. 'compact' — 사이드바 배포 항목(56px) 크기. */
  size?: 'default' | 'compact';

  /** compact 전용 — 주소줄 오른쪽 끝에 렌더되는 편집·삭제 등 아이콘 버튼. */
  actions?: ReactNode;
  className?: string;

  /**
   * 주소줄에 url에서 뽑은 도메인 대신 보여줄 문구 — 아직 배포 안 된 대화의 "배포하면 주소가
   * 생겨요" 같은 안내용. 프레임 모양·테두리·제목 행은 배포 여부와 완전히 동일하게 유지된다.
   */
  addressOverride?: string;
}

const Dots = () => (
  <span className={styles.dots}>
    <span className={styles.dot} />
    <span className={styles.dot} />
    <span className={styles.dot} />
  </span>
);

/**
 * 채팅 홈의 미니 브라우저 프레임(점 3개 + 주소줄 + 제목)을 공용 컴포넌트로 뺀 것 — 사이드바의
 * 배포 항목도 이걸 size="compact"로 재사용한다(별도 컴포넌트를 새로 만들지 않는다는 요청).
 */
export function MiniBrowserFrame({
  url,
  title,
  size = 'default',
  actions,
  className,
  addressOverride,
}: MiniBrowserFrameProps) {
  const domain = addressOverride ?? url.replace(/^https?:\/\//, '');

  if (size === 'compact') {
    return (
      <div className={classNames(styles.frame, styles.compact, className)}>
        <div className={styles.compactBar}>
          <Dots />
          <span className={styles.compactAddress}>{domain}</span>
          {actions && <div className={styles.compactActions}>{actions}</div>}
        </div>
        <div className={styles.compactTitleRow}>
          <p className={styles.compactTitle}>{title}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={classNames(styles.frame, styles.default, className)}>
      <div className={styles.bar}>
        <Dots />
        <span className={styles.address}>{domain}</span>
      </div>
      <div className={styles.content}>
        <p className={styles.title}>{title}</p>
      </div>
    </div>
  );
}
