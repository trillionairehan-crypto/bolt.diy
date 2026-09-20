import { describe, expect, it } from 'vitest';
import { isProviderBillingError } from './provider-error';

describe('isProviderBillingError', () => {
  it('Anthropic 크레딧 부족 메시지를 결제 오류로 본다 (2026-09-18 실측 문구)', () => {
    expect(
      isProviderBillingError(
        'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.',
      ),
    ).toBe(true);
  });

  it('Gemini 선불 크레딧 소진(402 RESOURCE_EXHAUSTED)도 잡는다 (2026-09-20 실측)', () => {
    expect(
      isProviderBillingError(
        'Your prepayment credits are depleted. Please go to AI Studio at https://ai.studio/projects to manage your project and billing.',
      ),
    ).toBe(true);
  });

  it('OpenAI 쿼터 초과 문구도 잡는다', () => {
    expect(isProviderBillingError('You exceeded your current quota, please check your plan and billing details.')).toBe(
      true,
    );
    expect(isProviderBillingError('insufficient_quota')).toBe(true);
  });

  it('토큰 한도·형식 오류는 결제 오류가 아니다', () => {
    expect(isProviderBillingError('max_tokens: 200000 > 8192, which is the maximum allowed')).toBe(false);
    expect(isProviderBillingError('Invalid or missing model')).toBe(false);
    expect(isProviderBillingError(undefined)).toBe(false);
  });
});
