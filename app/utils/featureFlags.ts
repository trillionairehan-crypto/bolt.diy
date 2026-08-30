export const SHOW_DEV_TOOLS = false;

/*
 * overnight5 — dark mode excluded from launch scope (DEV_UI_HIDE_REPORT.md). Forces every theme
 * resolution path (root.tsx's pre-hydration inline script, theme.ts's initStore()/toggleTheme())
 * to light, regardless of localStorage['bolt_theme'] or the OS's prefers-color-scheme, and hides
 * every <ThemeSwitch> instance. No dark-mode CSS/tokens/code removed — flipping this back to true
 * restores the exact previous behavior (including honoring a user's already-saved dark preference,
 * since that value in localStorage is never cleared, only ignored while this is false).
 */
export const DARK_MODE_ENABLED = false;

/*
 * overnight3 A5, turned on 08-31 — new message-metering logic (1 user utterance = 1 message,
 * auto-fix excluded, free tier = 10/month for accounts, 1/month for guests, no daily cap — see
 * app/lib/freeTrial.ts's doc comment for why) replaces the old (pre-existing) behavior where only
 * the very first message of a chat was ever counted. Requires the generation_usage_v2 schema and
 * get_generation_status_v2/increment_generation_count_v2 RPCs from supabase/migrations to be live
 * on the platform Supabase project — see RUN-2-metering-v2-fix.sql for the correction needed on
 * top of the already-applied RUN-1-metering.sql (the live RPC still enforced a 1/day cap that was
 * never in the pricing page).
 */
export const CORALRED_NEW_METERING = true;
