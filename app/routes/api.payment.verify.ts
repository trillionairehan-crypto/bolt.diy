import { json, type ActionFunctionArgs } from '@remix-run/cloudflare';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('api.payment.verify');

const PORTONE_API_BASE = 'https://api.portone.io';

interface VerifyRequestBody {
  paymentId?: string;
  expectedAmount?: number;
  expectedCurrency?: string;
}

interface PortOnePayment {
  status?: string;
  amount?: { total?: number };
  currency?: string;
}

/**
 * Server-side re-check for a PortOne V2 payment — the client's requestPayment() response can be
 * forged, so pricing.tsx's TODO (see the comment above its requestPayment call) is to call this
 * before ever activating a plan. Not wired into pricing.tsx yet — that file is off-limits this
 * session (uncommitted PortOne work pending the user's own browser test); this route exists so
 * it's ready to call once that's done.
 */
export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const apiSecret = context.cloudflare?.env?.PORTONE_API_SECRET;

  if (!apiSecret) {
    logger.error('PORTONE_API_SECRET is not configured');
    return json({ verified: false, error: 'payment_verification_unavailable' }, { status: 500 });
  }

  let body: VerifyRequestBody;

  try {
    body = (await request.json()) as VerifyRequestBody;
  } catch {
    return json({ verified: false, error: 'invalid_request_body' }, { status: 400 });
  }

  const { paymentId, expectedAmount, expectedCurrency } = body;

  if (!paymentId || typeof paymentId !== 'string') {
    return json({ verified: false, error: 'missing_payment_id' }, { status: 400 });
  }

  try {
    const response = await fetch(`${PORTONE_API_BASE}/payments/${encodeURIComponent(paymentId)}`, {
      headers: {
        Authorization: `PortOne ${apiSecret}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('PortOne lookup failed', response.status, errorText);

      return json({ verified: false, error: 'portone_lookup_failed', status: response.status }, { status: 502 });
    }

    const payment = (await response.json()) as PortOnePayment;

    const isPaid = payment.status === 'PAID';
    const amountMatches = expectedAmount === undefined || payment.amount?.total === expectedAmount;
    const currencyMatches = expectedCurrency === undefined || payment.currency === expectedCurrency;
    const verified = isPaid && amountMatches && currencyMatches;

    if (!verified) {
      logger.warn('Payment verification failed', {
        paymentId,
        status: payment.status,
        amountMatches,
        currencyMatches,
      });
    }

    return json({
      verified,
      status: payment.status,
      amount: payment.amount?.total,
      currency: payment.currency,
    });
  } catch (error) {
    logger.error('Payment verification error', error);
    return json({ verified: false, error: 'verification_request_failed' }, { status: 500 });
  }
}
