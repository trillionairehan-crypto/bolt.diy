/*
 * LLM 공급자 오류 분류 — 2026-09-18 실측: Anthropic이 "Your credit balance is too low to access the
 * Anthropic API. Please go to Plans & Billing…"를 HTTP 400으로 돌려줬고, api.llmcall은 그 statusCode를
 * 그대로 통과시켜 자동 검토 로그엔 "llmcall failed 400"만 남았다. 요청 형식 오류(진짜 400)와 결제 문제는
 * 대응이 완전히 다르므로 여기서 갈라 402로 낸다.
 */
const BILLING_PATTERNS = [
  /credit balance/i,
  /purchase credits/i,
  /plans\s*&\s*billing/i,
  /insufficient[_ ]quota/i,
  /insufficient funds/i,
  /exceeded your current quota/i,
  /billing (?:hard )?limit/i,
  /payment required/i,
];

export function isProviderBillingError(message: string | undefined | null): boolean {
  if (!message) {
    return false;
  }

  return BILLING_PATTERNS.some((pattern) => pattern.test(message));
}

export const PROVIDER_BILLING_STATUS = 402;
export const PROVIDER_BILLING_MESSAGE = 'LLM 공급자 크레딧이 부족합니다 — 결제·충전 후 다시 시도하세요';
