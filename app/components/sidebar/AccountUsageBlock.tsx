import { useEffect, useState } from 'react';
import { getV2AccountGenerationStatus } from '~/lib/freeTrial';
import styles from './Sidebar.module.scss';

/*
 * get_generation_status_v2 RPC(supabase/migrations/20260831000000_message_metering_v2_drop_daily_cap.sql
 * 확인)는 monthRemaining만 돌려주고 한도는 서버 상수(10)라 응답에 없다 — 요금제 페이지에 이미
 * 공개된 "월 10건"과 같은 값이라 여기서 상수로 둔다. 응답이 바뀌면(예: 플랜별 한도) 그때 서버가
 * 한도 필드를 같이 내려주도록 RPC를 바꿔야 한다.
 */
const ACCOUNT_MONTHLY_LIMIT = 10;

/** "10월 1일" — 다음 달 1일. 리셋 문구용, 연도는 표시하지 않는다. */
export function getNextMonthResetLabel(now: Date = new Date()): string {
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return `${next.getMonth() + 1}월 ${next.getDate()}일`;
}

interface UsageStatus {
  used: number;
  limit: number;
}

/**
 * 계정 메뉴 최상단 사용량 블록 — 예전엔 사이드바 하단에 QuotaBar로 상시 노출됐다(D-1로 제거,
 * Menu.client.tsx 참고). 값 로딩/에러 시 아무것도 렌더하지 않는다(D-2, "값 미로드 시 블록 전체
 * 미표시") — QuotaBar와 같은 안전장치. 이전 QuotaBar가 쓰던 getV2GenerationsRemaining() 대신
 * getV2AccountGenerationStatus()(callPlatformRpc 경로, 미터링 재로그인 버그 수정에서 확정된 경로)를
 * 직접 부른다 — D-5.
 */
export function AccountUsageBlock() {
  const [status, setStatus] = useState<UsageStatus | null>(null);

  useEffect(() => {
    let cancelled = false;

    getV2AccountGenerationStatus()
      .then(({ monthRemaining }) => {
        if (!cancelled) {
          setStatus({ used: Math.max(ACCOUNT_MONTHLY_LIMIT - monthRemaining, 0), limit: ACCOUNT_MONTHLY_LIMIT });
        }
      })
      .catch(() => {
        // 로딩 실패 — 블록을 아예 안 보여준다(틀린 값을 보여주는 것보다 안전).
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!status) {
    return null;
  }

  const { used, limit } = status;
  const exhausted = used >= limit;
  const percent = limit > 0 ? Math.min((used / limit) * 100, 100) : 100;

  return (
    <div className={styles.usageBlock}>
      <p className={styles.usageTitle}>이번 달 사용량</p>
      <p className={styles.usageReset}>{getNextMonthResetLabel()} 갱신</p>
      <div className={styles.usageRow}>
        <span className={styles.usageRowLabel}>메시지</span>
        <span className={styles.usageRowValue}>
          {used} / {limit}
        </span>
      </div>
      <div className={styles.usageTrack}>
        <div className={styles.usageFill} style={{ width: `${percent}%` }} />
      </div>
      {exhausted && (
        <a href="/pricing" className={styles.usagePricingLink}>
          요금제 보기
        </a>
      )}
    </div>
  );
}
