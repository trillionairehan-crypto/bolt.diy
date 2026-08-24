/**
 * The "샘플 데이터로 보고 있어요" banner (new-prompt.ts's Supabase-unconnected rule) is rendered
 * INSIDE the generated app's own code, running in a sandboxed WebContainer preview iframe — a
 * different document from this host page, so a DOM click handler here can never reach it
 * directly. The prompt instructs the AI to make that banner a button that calls
 * `window.parent.postMessage({ type: OPEN_SUPABASE_CONNECTION_MESSAGE_TYPE }, '*')` on click;
 * this is the shared contract both sides (prompt-authored generated code, and the host's
 * SupabaseConnection listener) agree on.
 */
export const OPEN_SUPABASE_CONNECTION_MESSAGE_TYPE = 'coralred:open-supabase-connection';

export function isOpenSupabaseConnectionMessage(data: unknown): boolean {
  return (
    !!data && typeof data === 'object' && (data as { type?: unknown }).type === OPEN_SUPABASE_CONNECTION_MESSAGE_TYPE
  );
}
