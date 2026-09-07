const UTM_SESSION_KEY = 'coralred_utm_attribution';

export interface UtmParams {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
}

/**
 * 랜딩/로그인 진입 시 한 번 호출한다(root.tsx). sessionStorage에 이미 값이 있으면 아무것도 하지
 * 않는다 — 첫 진입 값만 유지하고 이후 내부 이동으로 다른 utm_* 쿼리를 지나가도 덮어쓰지 않기 위해서다.
 * URL에 utm_* 파라미터가 하나도 없으면(오가닉 진입) 아무것도 저장하지 않는다 — 다음 진입에서 실제
 * 캠페인 파라미터가 오면 그때 잡을 수 있게, 빈 값으로 슬롯을 선점하지 않는다.
 */
export function captureUtmFromUrl(search: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (sessionStorage.getItem(UTM_SESSION_KEY)) {
      return;
    }

    const params = new URLSearchParams(search);
    const utm: UtmParams = {
      utmSource: params.get('utm_source'),
      utmMedium: params.get('utm_medium'),
      utmCampaign: params.get('utm_campaign'),
      utmContent: params.get('utm_content'),
    };

    if (!utm.utmSource && !utm.utmMedium && !utm.utmCampaign && !utm.utmContent) {
      return;
    }

    sessionStorage.setItem(UTM_SESSION_KEY, JSON.stringify(utm));
  } catch {
    // sessionStorage 접근 불가(프라이빗 모드 등) — 유입 경로 저장을 못 할 뿐 무해하게 넘어간다.
  }
}

export function getStoredUtmParams(): UtmParams | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = sessionStorage.getItem(UTM_SESSION_KEY);
    return raw ? (JSON.parse(raw) as UtmParams) : null;
  } catch {
    return null;
  }
}
