import type { ActionFunctionArgs } from '@remix-run/cloudflare';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('api.payment.webhook');

/**
 * PortOne V2 webhook receiver — skeleton only, per this overnight run's own instructions ("실연동은
 * 아침 이후"). PortOne V2 signs webhooks Svix-style (webhook-id / webhook-timestamp /
 * webhook-signature headers over the raw body). The structure for reading those and looking up a
 * signing secret is here, but the actual signature check is NOT implemented — right now this logs
 * and 200s every request without verifying or acting on it, so nothing downstream should trust it
 * yet. See OVERNIGHT-REPORT.md for the 3 steps to finish wiring this up.
 */
export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const webhookId = request.headers.get('webhook-id');
  const webhookTimestamp = request.headers.get('webhook-timestamp');
  const webhookSignature = request.headers.get('webhook-signature');
  const rawBody = await request.text();

  const webhookSecret = context.cloudflare?.env?.PORTONE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    logger.warn('PORTONE_WEBHOOK_SECRET not configured — webhook received but not verified, ignoring payload');
    return new Response('ok', { status: 200 });
  }

  /*
   * TODO: verify rawBody against webhookId/webhookTimestamp/webhookSignature using webhookSecret
   * (PortOne V2 webhook signing) before trusting anything in the payload.
   */
  logger.info('Webhook received (signature verification not yet implemented)', {
    webhookId,
    webhookTimestamp,
    hasSignature: Boolean(webhookSignature),
    bodyLength: rawBody.length,
  });

  return new Response('ok', { status: 200 });
}
