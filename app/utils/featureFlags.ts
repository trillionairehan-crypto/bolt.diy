export const SHOW_DEV_TOOLS = false;

/*
 * overnight3 A5 — new message-metering logic (1 user utterance = 1 message, auto-fix excluded,
 * free tier = 10/month + 1/day) lives behind this flag. Default false: current (pre-existing)
 * behavior — only the very first message of a chat is ever counted — is 100% preserved until
 * this is flipped. See supabase/migrations for the new schema (written, not applied) and
 * app/lib/freeTrial.ts for the v2 functions, and OVERNIGHT-REPORT-3.md's A5 section for the full
 * investigation and the morning application procedure.
 */
export const CORALRED_NEW_METERING = false;
