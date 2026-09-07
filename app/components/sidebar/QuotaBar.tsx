import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { authUserStore } from '~/lib/stores/auth';
import { getV2GenerationsRemaining } from '~/lib/freeTrial';
import styles from './Sidebar.module.scss';

// 재로그인 직후 세션 동기화 레이스(freeTrial.ts의 getV2AccountGenerationStatus 주석 참고) 대비 1회 재시도.
const RETRY_DELAY_MS = 400;

/**
 * Small, unobtrusive — "진행 바 형태, 강조하지 않음". v2 계정 RPC는 한도 없이 remaining count만
 * 돌려주므로(요금제 페이지 값과 클라이언트 상수가 어긋날 위험을 없애려는 설계 — freeTrial.ts 참고)
 * "N회 남았어요" 형태로만 표시한다.
 */
export function QuotaBar() {
  const authUser = useStore(authUserStore);
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    let retryTimeoutId: number | undefined;

    const fetchRemaining = (attempt: number) => {
      getV2GenerationsRemaining()
        .then((value) => {
          if (!cancelled) {
            setRemaining(value);
          }
        })
        .catch(() => {
          if (!cancelled && attempt === 0) {
            retryTimeoutId = window.setTimeout(() => fetchRemaining(1), RETRY_DELAY_MS);
          }
        });
    };

    fetchRemaining(0);

    return () => {
      cancelled = true;
      window.clearTimeout(retryTimeoutId);
    };
  }, [authUser]);

  if (remaining === null) {
    return null;
  }

  const exhausted = remaining <= 0;

  const pricingLink = exhausted ? (
    <a href="/pricing" className={styles.pricingLink}>
      요금제 보기
    </a>
  ) : null;

  return (
    <div className={styles.quotaBar}>
      <p className={styles.quotaLabel}>
        {authUser ? '무료 생성' : '무료 체험'} {remaining}회 남았어요
      </p>
      {pricingLink}
    </div>
  );
}
