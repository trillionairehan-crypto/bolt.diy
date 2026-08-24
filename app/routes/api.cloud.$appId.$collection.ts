import { type ActionFunctionArgs, type LoaderFunctionArgs, json } from '@remix-run/cloudflare';
import { authenticateCloudRequest, checkCloudRateLimit } from '~/lib/cloud/cloudAuth';
import { createDocument, listDocuments } from '~/lib/cloud/cloudDocuments';
import { jsonError, preflightResponse } from '~/lib/cloud/cloudResponses';
import { isValidDeviceKey } from '~/lib/cloud/cloudValidation';

export async function action({ request, context, params }: ActionFunctionArgs) {
  if (request.method === 'OPTIONS') {
    return preflightResponse(request);
  }

  if (request.method !== 'POST') {
    return json({ error: '지원하지 않는 요청이에요.' }, { status: 405 });
  }

  const appId = params.appId || '';
  const collection = params.collection || '';
  const env = context?.cloudflare?.env ?? {};

  const auth = await authenticateCloudRequest(request, env, appId);

  if (!auth.ok) {
    return auth.response;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError(400, '요청 형식이 올바르지 않아요.', auth.context.corsHeaders);
  }

  const deviceKey = (body as { deviceKey?: unknown })?.deviceKey;

  if (!isValidDeviceKey(deviceKey)) {
    return jsonError(400, '기기 정보가 올바르지 않아요.', auth.context.corsHeaders);
  }

  const withinLimit = await checkCloudRateLimit(auth.context.supabase, auth.context.appId, deviceKey);

  if (!withinLimit) {
    return jsonError(429, '요청이 너무 많아요. 잠시 후 다시 시도해주세요.', auth.context.corsHeaders);
  }

  return createDocument(auth.context.supabase, auth.context.appId, collection, body, auth.context.corsHeaders);
}

export async function loader({ request, context, params }: LoaderFunctionArgs) {
  const appId = params.appId || '';
  const collection = params.collection || '';
  const env = context?.cloudflare?.env ?? {};

  const auth = await authenticateCloudRequest(request, env, appId);

  if (!auth.ok) {
    return auth.response;
  }

  const url = new URL(request.url);
  const deviceKey = url.searchParams.get('deviceKey') || '';

  if (!isValidDeviceKey(deviceKey)) {
    return jsonError(400, '기기 정보가 올바르지 않아요.', auth.context.corsHeaders);
  }

  const withinLimit = await checkCloudRateLimit(auth.context.supabase, auth.context.appId, deviceKey);

  if (!withinLimit) {
    return jsonError(429, '요청이 너무 많아요. 잠시 후 다시 시도해주세요.', auth.context.corsHeaders);
  }

  return listDocuments(auth.context.supabase, auth.context.appId, collection, url, auth.context.corsHeaders);
}
