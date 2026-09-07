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
