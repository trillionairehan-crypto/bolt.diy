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
// 재로그인 직후 세션 동기화 레이스(freeTrial.ts의 getV2AccountGenerationStatus 주석 참고) 대비 1회 재시도.
const RETRY_DELAY_MS = 400;

export function QuotaBar() {
  const authUser = useStore(authUserStore);
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    let retryTimeoutId: number | undefined;

    const fetchRemaining = (attempt: number) => {
      (CORALRED_NEW_METERING ? getV2GenerationsRemaining() : getGenerationsRemaining())
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

  const limit = CORALRED_NEW_METERING ? null : authUser ? FREE_GENERATION_LIMIT : GUEST_FREE_LIMIT;
  const exhausted = remaining <= 0;
  const used = limit === null ? null : Math.max(limit - remaining, 0);

  /*
   * 7-2: v1 카운터는 평생 누적(월별 리셋 없음, freeTrial.ts 참고)이라 "이번 달" 같은 기간
   * 표현은 쓰지 않는다 — "OO회 중 OO회 사용" 형태만. "요금제 보기" 링크는 소진 시에만 별도로
   * 붙이고 문장 안에 섞지 않는다(강조하지 않음). 문구는 freeGenerationsCounterAudit.spec.ts/
   * pricingCopyAudit.spec.ts가 지킴.
   */
  const label =
    limit === null || used === null ? (
      <>
        {authUser ? '무료 생성' : '무료 체험'} {remaining}회 남았어요
      </>
    ) : (
      <>
        {authUser ? '무료 생성' : '무료 체험'} {limit}회 중 {used}회 사용
      </>
    );

  const pricingLink = exhausted ? (
    <a href="/pricing" className={styles.pricingLink}>
      요금제 보기
    </a>
  ) : null;

  if (limit === null || used === null) {
    return (
      <div className={styles.quotaBar}>
        <p className={styles.quotaLabel}>{label}</p>
        {pricingLink}
      </div>
    );
  }

  const percent = limit > 0 ? Math.min((used / limit) * 100, 100) : 100;

  return (
    <div className={styles.quotaBar}>
      <div className={styles.quotaTrack}>
        <div className={styles.quotaFill} style={{ width: `${percent}%` }} />
      </div>
      <p className={styles.quotaLabel}>{label}</p>
      {pricingLink}
    </div>
  );
}
