import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { authUserStore } from '~/lib/stores/auth';
import { CORALRED_NEW_METERING } from '~/utils/constants';
import {
  FREE_GENERATION_LIMIT,
  GUEST_FREE_LIMIT,
  getGenerationsRemaining,
  getV2GenerationsRemaining,
} from '~/lib/freeTrial';
import styles from './Sidebar.module.scss';

/**
 * Small, unobtrusive — "진행 바 형태, 강조하지 않음". v1 (the currently active metering path, see
 * CORALRED_NEW_METERING) has a known fixed limit per auth state, so a real used/limit bar is
 * possible. v2's account RPC only ever returns a remaining count with no limit — if that flag is
 * ever flipped on for logged-in users, this degrades to a plain count instead of a bar.
 */
export function QuotaBar() {
  const authUser = useStore(authUserStore);
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    (CORALRED_NEW_METERING ? getV2GenerationsRemaining() : getGenerationsRemaining())
      .then((value) => {
        if (!cancelled) {
          setRemaining(value);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [authUser]);

  if (remaining === null) {
    return null;
  }

  const limit = CORALRED_NEW_METERING ? null : authUser ? FREE_GENERATION_LIMIT : GUEST_FREE_LIMIT;

  /*
   * 계정/게스트 구분 문구는 freeGenerationsCounterAudit.spec.ts/pricingCopyAudit.spec.ts가 지킴
   * (예전엔 BaseChat.tsx에 있었고, 이 위젯으로 옮겨왔다).
   */
  const label =
    remaining > 0 ? (
      <>
        {authUser ? '무료 생성' : '무료 체험'} {remaining}회 남았어요
      </>
    ) : (
      <>
        {authUser ? '무료 생성 횟수를 모두 사용했어요' : '무료 체험을 다 썼어요'}. 계속하려면{' '}
        <a href="/pricing" className={styles.pricingLink}>
          요금제
        </a>
        를 확인해주세요
      </>
    );

  if (limit === null) {
    return <p className={styles.quotaLabel}>{label}</p>;
  }

  const used = Math.max(limit - remaining, 0);
  const percent = limit > 0 ? Math.min((used / limit) * 100, 100) : 100;

  return (
    <div className={styles.quotaBar}>
      <div className={styles.quotaTrack}>
        <div className={styles.quotaFill} style={{ width: `${percent}%` }} />
      </div>
      <p className={styles.quotaLabel}>{label}</p>
    </div>
  );
}
