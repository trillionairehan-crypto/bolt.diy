import { describe, expect, it } from 'vitest';
import { isOpenSupabaseConnectionMessage, OPEN_SUPABASE_CONNECTION_MESSAGE_TYPE } from './previewBridge';

describe('isOpenSupabaseConnectionMessage', () => {
  it('is true for the exact expected shape', () => {
    expect(isOpenSupabaseConnectionMessage({ type: OPEN_SUPABASE_CONNECTION_MESSAGE_TYPE })).toBe(true);
  });

  it('is false for an unrelated message type (e.g. the Inspector channel)', () => {
    expect(isOpenSupabaseConnectionMessage({ type: 'INSPECTOR_HOVER' })).toBe(false);
  });

  it('is false for non-object / nullish payloads', () => {
    expect(isOpenSupabaseConnectionMessage(null)).toBe(false);
    expect(isOpenSupabaseConnectionMessage(undefined)).toBe(false);
    expect(isOpenSupabaseConnectionMessage('coralred:open-supabase-connection')).toBe(false);
    expect(isOpenSupabaseConnectionMessage(42)).toBe(false);
  });

  it('is false for an object with no type field', () => {
    expect(isOpenSupabaseConnectionMessage({})).toBe(false);
    expect(isOpenSupabaseConnectionMessage({ foo: 'bar' })).toBe(false);
  });
});
