/** CLOUD-DESIGN.md 4/6번 섹션에 명시된 검증 상수·함수 — 서버 코드와 vitest가 공유. */

export const COLLECTION_NAME_REGEX = /^[a-z][a-z0-9_]{0,30}$/;

export function isValidCollectionName(name: string): boolean {
  return typeof name === 'string' && COLLECTION_NAME_REGEX.test(name);
}

export const MAX_DOCUMENT_BYTES = 65536;
export const MAX_JSON_DEPTH = 8;
export const MAX_ARRAY_LENGTH = 1000;
export const MAX_DEVICE_KEY_LENGTH = 128;
export const MAX_LIST_LIMIT = 100;
export const DEFAULT_LIST_LIMIT = 20;

export function isValidDeviceKey(key: unknown): key is string {
  return typeof key === 'string' && key.length >= 1 && key.length <= MAX_DEVICE_KEY_LENGTH;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string): boolean {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

export type DocumentShapeIssue = 'depth' | 'array_length' | 'not_plain_object';

/**
 * Single walk that catches both the "깊이 8" and "배열 최대" limits from CLOUD-DESIGN.md's threat
 * model (T5) — depth check alone doesn't stop a wide, shallow array bomb (many siblings at the
 * same depth), so array length is checked at every level too, not just leaves.
 */
export function validateDocumentShape(
  value: unknown,
  depth = 1,
): { ok: true } | { ok: false; issue: DocumentShapeIssue } {
  if (depth > MAX_JSON_DEPTH) {
    return { ok: false, issue: 'depth' };
  }

  if (value === null || typeof value !== 'object') {
    return { ok: true };
  }

  if (Array.isArray(value)) {
    if (value.length > MAX_ARRAY_LENGTH) {
      return { ok: false, issue: 'array_length' };
    }

    for (const item of value) {
      const result = validateDocumentShape(item, depth + 1);

      if (!result.ok) {
        return result;
      }
    }

    return { ok: true };
  }

  for (const v of Object.values(value as Record<string, unknown>)) {
    const result = validateDocumentShape(v, depth + 1);

    if (!result.ok) {
      return result;
    }
  }

  return { ok: true };
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Byte length of the JSON-serialized form — matches the DB's own pg_column_size-based CHECK closely enough for a pre-DB reject. */
export function jsonByteSize(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

export function clampListLimit(rawLimit: string | null): number {
  if (!rawLimit) {
    return DEFAULT_LIST_LIMIT;
  }

  const parsed = Number(rawLimit);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIST_LIMIT;
  }

  return Math.min(Math.floor(parsed), MAX_LIST_LIMIT);
}
