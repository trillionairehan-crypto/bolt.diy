import type { SupabaseClient } from '@supabase/supabase-js';
import {
  isValidCollectionName,
  isValidDeviceKey,
  isValidUuid,
  isPlainObject,
  validateDocumentShape,
  jsonByteSize,
  MAX_DOCUMENT_BYTES,
  clampListLimit,
} from './cloudValidation';
import { jsonError, jsonOk } from './cloudResponses';

/**
 * Every query in this file filters by app_id AND (device_key or id-within-that-app) — see
 * CLOUD-DESIGN.md's threat model T1/T2. app_id always comes from the already-authenticated
 * request context (cloudAuth.ts), never from anything the client can independently choose;
 * device_key comes raw from the request but only ever narrows a query, never widens one.
 */

function validateCollectionOrFail(collection: string, corsHeaders: Record<string, string>): Response | null {
  if (!isValidCollectionName(collection)) {
    return jsonError(400, '저장 공간 이름이 올바르지 않아요.', corsHeaders);
  }

  return null;
}

function validatePayloadOrFail(data: unknown, corsHeaders: Record<string, string>): Response | null {
  if (!isPlainObject(data)) {
    return jsonError(400, '저장할 내용의 형식이 올바르지 않아요.', corsHeaders);
  }

  const shape = validateDocumentShape(data);

  if (!shape.ok) {
    return jsonError(400, '저장할 내용의 구조가 너무 복잡해요.', corsHeaders);
  }

  if (jsonByteSize(data) > MAX_DOCUMENT_BYTES) {
    return jsonError(413, '저장할 내용이 너무 커요 (64KB 제한).', corsHeaders);
  }

  return null;
}

function mapDbErrorToResponse(
  error: { message?: string } | null,
  corsHeaders: Record<string, string>,
): Response | null {
  if (!error) {
    return null;
  }

  const msg = error.message || '';

  if (msg.includes('cloud_quota_documents_exceeded')) {
    return jsonError(507, '이 앱의 저장 공간이 다 찼어요. 요금제를 확인해주세요.', corsHeaders);
  }

  if (msg.includes('cloud_quota_bytes_exceeded')) {
    return jsonError(507, '이 앱의 저장 용량이 다 찼어요. 요금제를 확인해주세요.', corsHeaders);
  }

  if (msg.includes('cloud_quota_collections_exceeded')) {
    return jsonError(507, '저장 공간 종류가 너무 많아요. 요금제를 확인해주세요.', corsHeaders);
  }

  return jsonError(500, '저장하다가 문제가 생겼어요. 잠시 후 다시 시도해주세요.', corsHeaders);
}

export async function createDocument(
  supabase: SupabaseClient,
  appId: string,
  collection: string,
  body: unknown,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const collFail = validateCollectionOrFail(collection, corsHeaders);

  if (collFail) {
    return collFail;
  }

  if (!isPlainObject(body)) {
    return jsonError(400, '요청 형식이 올바르지 않아요.', corsHeaders);
  }

  const deviceKey = body.deviceKey;
  const data = body.data;

  if (!isValidDeviceKey(deviceKey)) {
    return jsonError(400, '기기 정보가 올바르지 않아요.', corsHeaders);
  }

  const payloadFail = validatePayloadOrFail(data, corsHeaders);

  if (payloadFail) {
    return payloadFail;
  }

  const { data: row, error } = await supabase
    .from('cloud_documents')
    .insert({ app_id: appId, collection, device_key: deviceKey, data })
    .select('id, data, created_at, updated_at')
    .single();

  const dbErrorResponse = mapDbErrorToResponse(error, corsHeaders);

  if (dbErrorResponse) {
    return dbErrorResponse;
  }

  if (!row) {
    return jsonError(500, '저장하다가 문제가 생겼어요. 잠시 후 다시 시도해주세요.', corsHeaders);
  }

  return jsonOk(201, { id: row.id, data: row.data, createdAt: row.created_at, updatedAt: row.updated_at }, corsHeaders);
}

export async function listDocuments(
  supabase: SupabaseClient,
  appId: string,
  collection: string,
  url: URL,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const collFail = validateCollectionOrFail(collection, corsHeaders);

  if (collFail) {
    return collFail;
  }

  const deviceKey = url.searchParams.get('deviceKey') || '';

  if (!isValidDeviceKey(deviceKey)) {
    return jsonError(400, '기기 정보가 올바르지 않아요.', corsHeaders);
  }

  const limit = clampListLimit(url.searchParams.get('limit'));
  const cursor = url.searchParams.get('cursor');

  let query = supabase
    .from('cloud_documents')
    .select('id, data, created_at, updated_at')
    .eq('app_id', appId)
    .eq('collection', collection)
    .eq('device_key', deviceKey)
    .order('created_at', { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data: rows, error } = await query;

  if (error || !rows) {
    return jsonError(500, '목록을 가져오지 못했어요. 잠시 후 다시 시도해주세요.', corsHeaders);
  }

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const items = pageRows.map((r) => ({ id: r.id, data: r.data, createdAt: r.created_at, updatedAt: r.updated_at }));
  const nextCursor = hasMore ? items[items.length - 1].createdAt : null;

  return jsonOk(200, { items, nextCursor }, corsHeaders);
}

export async function getDocument(
  supabase: SupabaseClient,
  appId: string,
  collection: string,
  docId: string,
  deviceKey: string,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const collFail = validateCollectionOrFail(collection, corsHeaders);

  if (collFail) {
    return collFail;
  }

  if (!isValidUuid(docId)) {
    return jsonError(404, '찾을 수 없어요.', corsHeaders);
  }

  if (!isValidDeviceKey(deviceKey)) {
    return jsonError(400, '기기 정보가 올바르지 않아요.', corsHeaders);
  }

  const { data: row, error } = await supabase
    .from('cloud_documents')
    .select('id, data, created_at, updated_at')
    .eq('id', docId)
    .eq('app_id', appId)
    .eq('collection', collection)
    .eq('device_key', deviceKey)
    .maybeSingle();

  if (error) {
    return jsonError(500, '불러오지 못했어요. 잠시 후 다시 시도해주세요.', corsHeaders);
  }

  if (!row) {
    return jsonError(404, '찾을 수 없어요.', corsHeaders);
  }

  return jsonOk(200, { id: row.id, data: row.data, createdAt: row.created_at, updatedAt: row.updated_at }, corsHeaders);
}

export async function updateDocument(
  supabase: SupabaseClient,
  appId: string,
  collection: string,
  docId: string,
  body: unknown,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const collFail = validateCollectionOrFail(collection, corsHeaders);

  if (collFail) {
    return collFail;
  }

  if (!isValidUuid(docId)) {
    return jsonError(404, '찾을 수 없어요.', corsHeaders);
  }

  if (!isPlainObject(body)) {
    return jsonError(400, '요청 형식이 올바르지 않아요.', corsHeaders);
  }

  const deviceKey = body.deviceKey;
  const data = body.data;

  if (!isValidDeviceKey(deviceKey)) {
    return jsonError(400, '기기 정보가 올바르지 않아요.', corsHeaders);
  }

  const payloadFail = validatePayloadOrFail(data, corsHeaders);

  if (payloadFail) {
    return payloadFail;
  }

  const { data: row, error } = await supabase
    .from('cloud_documents')
    .update({ data, updated_at: new Date().toISOString() })
    .eq('id', docId)
    .eq('app_id', appId)
    .eq('collection', collection)
    .eq('device_key', deviceKey)
    .select('id, data, created_at, updated_at')
    .maybeSingle();

  const dbErrorResponse = mapDbErrorToResponse(error, corsHeaders);

  if (dbErrorResponse) {
    return dbErrorResponse;
  }

  if (!row) {
    return jsonError(404, '찾을 수 없어요.', corsHeaders);
  }

  return jsonOk(200, { id: row.id, data: row.data, createdAt: row.created_at, updatedAt: row.updated_at }, corsHeaders);
}

export async function deleteDocument(
  supabase: SupabaseClient,
  appId: string,
  collection: string,
  docId: string,
  deviceKey: string,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const collFail = validateCollectionOrFail(collection, corsHeaders);

  if (collFail) {
    return collFail;
  }

  if (!isValidUuid(docId)) {
    return jsonError(404, '찾을 수 없어요.', corsHeaders);
  }

  if (!isValidDeviceKey(deviceKey)) {
    return jsonError(400, '기기 정보가 올바르지 않아요.', corsHeaders);
  }

  const { data: row, error } = await supabase
    .from('cloud_documents')
    .delete()
    .eq('id', docId)
    .eq('app_id', appId)
    .eq('collection', collection)
    .eq('device_key', deviceKey)
    .select('id')
    .maybeSingle();

  if (error) {
    return jsonError(500, '지우지 못했어요. 잠시 후 다시 시도해주세요.', corsHeaders);
  }

  if (!row) {
    return jsonError(404, '찾을 수 없어요.', corsHeaders);
  }

  return new Response(null, { status: 204, headers: corsHeaders });
}
