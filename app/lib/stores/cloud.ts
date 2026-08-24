import { atom } from 'nanostores';

/**
 * Unlike supabaseConnection (one connection, account-wide), Cloud is provisioned per app/chat —
 * each generated app gets its own cloud_apps row and token. Kept in localStorage keyed by chatId,
 * not the platform DB, since the token itself must not round-trip through anywhere but the one
 * provisioning response (CLOUD-DESIGN.md section 3).
 */
export interface CloudAppState {
  appId: string;
  token: string;
  expiresAt: string | null;
}

export const cloudAppState = atom<CloudAppState | null>(null);

function storageKeyFor(chatId: string): string {
  return `coralred_cloud_app_${chatId}`;
}

export function loadCloudAppForChat(chatId: string): CloudAppState | null {
  try {
    const raw = localStorage.getItem(storageKeyFor(chatId));

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<CloudAppState>;

    if (typeof parsed.appId !== 'string' || typeof parsed.token !== 'string') {
      return null;
    }

    return { appId: parsed.appId, token: parsed.token, expiresAt: parsed.expiresAt ?? null };
  } catch {
    return null;
  }
}

export function saveCloudAppForChat(chatId: string, state: CloudAppState): void {
  try {
    localStorage.setItem(storageKeyFor(chatId), JSON.stringify(state));
  } catch {
    // localStorage unavailable — Cloud state just won't survive a reload for this chat.
  }

  cloudAppState.set(state);
}

export function clearCloudAppForChat(chatId: string): void {
  try {
    localStorage.removeItem(storageKeyFor(chatId));
  } catch {
    // Nothing to clean up if localStorage itself is unavailable.
  }

  cloudAppState.set(null);
}
