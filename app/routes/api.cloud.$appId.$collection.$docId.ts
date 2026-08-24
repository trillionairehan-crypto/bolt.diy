import { type ActionFunctionArgs, type LoaderFunctionArgs, json } from '@remix-run/cloudflare';
import { authenticateCloudRequest, checkCloudRateLimit } from '~/lib/cloud/cloudAuth';
import { getDocument, updateDocument, deleteDocument } from '~/lib/cloud/cloudDocuments';
import { jsonError, preflightResponse } from '~/lib/cloud/cloudResponses';
import { isValidDeviceKey } from '~/lib/cloud/cloudValidation';

export async function action({ request, context, params }: ActionFunctionArgs) {
  if (request.method === 'OPTIONS') {
    return preflightResponse(request);
  }

  if (request.method !== 'PATCH' && request.method !== 'DELETE') {
    return json({ error: '지원하지 않는 요청이에요.' }, { status: 405 });
  }

  const appId = params.appId || '';
  const collection = params.collection || '';
  const docId = params.docId || '';
  const env = context?.cloudflare?.env ?? {};

  const auth = await authenticateCloudRequest(request, env, appId);

  if (!auth.ok) {
    return auth.response;
  }

  if (request.method === 'DELETE') {
    const url = new URL(request.url);
    let deviceKey = url.searchParams.get('deviceKey') || '';

    if (!deviceKey) {
      try {
        const body = (await request.json()) as { deviceKey?: unknown };
        deviceKey = typeof body?.deviceKey === 'string' ? body.deviceKey : '';
      } catch {
        // deviceKey stays empty — falls through to the validation error below.
      }
    }

    if (!isValidDeviceKey(deviceKey)) {
      return jsonError(400, '기기 정보가 올바르지 않아요.', auth.context.corsHeaders);
    }

    const withinLimit = await checkCloudRateLimit(auth.context.supabase, auth.context.appId, deviceKey);

    if (!withinLimit) {
      return jsonError(429, '요청이 너무 많아요. 잠시 후 다시 시도해주세요.', auth.context.corsHeaders);
    }

    return deleteDocument(
      auth.context.supabase,
      auth.context.appId,
      collection,
      docId,
      deviceKey,
      auth.context.corsHeaders,
    );
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

  return updateDocument(auth.context.supabase, auth.context.appId, collection, docId, body, auth.context.corsHeaders);
}

export async function loader({ request, context, params }: LoaderFunctionArgs) {
  const appId = params.appId || '';
  const collection = params.collection || '';
  const docId = params.docId || '';
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

  return getDocument(auth.context.supabase, auth.context.appId, collection, docId, deviceKey, auth.context.corsHeaders);
}
