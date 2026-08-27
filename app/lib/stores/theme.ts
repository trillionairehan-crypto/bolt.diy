import { atom } from 'nanostores';
import { logStore } from './logs';
import { DARK_MODE_ENABLED } from '~/utils/featureFlags';

export type Theme = 'dark' | 'light';

export const kTheme = 'bolt_theme';

export function themeIsDark() {
  return themeStore.get() === 'dark';
}

export const DEFAULT_THEME = 'light';

export const themeStore = atom<Theme>(initStore());

function initStore() {
  // 다크모드 출시 제외 (overnight5) — 이전에 dark로 저장해둔 사용자도 라이트로 뜨게 한다.
  if (!DARK_MODE_ENABLED) {
    return DEFAULT_THEME;
  }

  if (!import.meta.env.SSR) {
    const persistedTheme = localStorage.getItem(kTheme) as Theme | undefined;
    const themeAttribute = document.querySelector('html')?.getAttribute('data-theme');

    return persistedTheme ?? (themeAttribute as Theme) ?? DEFAULT_THEME;
  }

  return DEFAULT_THEME;
}

const THEME_TRANSITION_MS = 200;

export function toggleTheme() {
  // 다크모드 출시 제외 (overnight5) — 토글 버튼은 전부 숨겼지만, 방어적으로 여기서도 막는다.
  if (!DARK_MODE_ENABLED) {
    return;
  }

  const currentTheme = themeStore.get();
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

  const html = document.querySelector('html');

  /*
   * Transition class applied only for the duration of the flip, not left on permanently — an
   * always-on `transition: background-color` on every element would fire on every unrelated
   * re-render too, not just this one.
   */
  html?.classList.add('theme-transitioning');
  setTimeout(() => html?.classList.remove('theme-transitioning'), THEME_TRANSITION_MS + 50);

  // Update the theme store
  themeStore.set(newTheme);

  // Update localStorage
  localStorage.setItem(kTheme, newTheme);

  // Update the HTML attribute
  html?.setAttribute('data-theme', newTheme);

  // Update user profile if it exists
  try {
    const userProfile = localStorage.getItem('bolt_user_profile');

    if (userProfile) {
      const profile = JSON.parse(userProfile);
      profile.theme = newTheme;
      localStorage.setItem('bolt_user_profile', JSON.stringify(profile));
    }
  } catch (error) {
    console.error('Error updating user profile theme:', error);
  }

  logStore.logSystem(`Theme changed to ${newTheme} mode`);
}
