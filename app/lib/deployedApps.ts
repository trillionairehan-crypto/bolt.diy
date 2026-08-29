import { authUserStore } from '~/lib/stores/auth';
import { platformSupabase } from '~/lib/supabase/platform-client';
import { openDatabase, getMessagesById } from '~/lib/persistence/db';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('deployedApps');

export type StorageMode = 'sample' | 'cloud' | 'supabase';

export interface DeployedAppRecord {
  id: string;
  chat_id: string;
  app_name: string;
  url: string;
  provider: string;
  project_name: string | null;
  storage_mode: StorageMode;
  storage_expires_at: string | null;
  deployed_at: string;
}

/*
 * CONFIRMED LIVE (직접 REST 조회로 확인, 2026-08-30): the base `deployed_apps` table exists and
 * its RLS is correctly scoped (auth.uid() = user_id) — but the live table is missing the
 * `storage_mode`/`storage_expires_at` columns that a later migration (in this repo, still listed
 * as "WRITTEN, NOT APPLIED") added. Every insert/select that names those two columns has been
 * failing with Postgres 42703 ("column does not exist") and silently swallowed by the catch
 * blocks below — meaning no deploy has ever actually been recorded, not "no data yet". This is
 * the real root cause of "배포한 앱 카드가 하나도 안 보인다".
 *
 * Applying supabase/migrations/20260825000001_deployed_apps.sql (if not applied) and
 * .../20260826000000_deployed_apps_ownership_check.sql's ALTER TABLE portion for storage_mode/
 * storage_expires_at against the platform Supabase project is the real fix, and needs DB access
 * this environment doesn't have (only the anon key, RLS-scoped) — flagged for the user to apply.
 * In the meantime, both functions below retry once without those two columns on a 42703 for
 * exactly them, so recording/reading deploys works today regardless of migration status, and
 * automatically starts using the real columns again the moment the migration lands (the full
 * query is always tried first).
 */
const MISSING_STORAGE_COLUMNS_CODE = '42703';

function isMissingStorageColumnsError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  const message = (error as { message?: string } | null)?.message ?? '';

  return code === MISSING_STORAGE_COLUMNS_CODE && /storage_mode|storage_expires_at/.test(message);
}

/**
 * Records a successful deploy for the "내 앱" (/apps) dashboard. Best-effort only — a failure
 * here must never surface to the user or interrupt the deploy flow they just watched succeed
 * (the deploy itself already completed by the time this runs), so every error is swallowed and
 * just logged. Also a deliberate no-op for guests (the table's RLS is keyed to auth.uid(), and
 * /apps itself requires login).
 */
export async function recordDeployedApp(params: {
  chatId: string;
  appName: string;
  url: string;
  provider: string;

  /** Cloudflare Pages project name, when provider is 'cloudflare' — see the migration's own comment. */
  projectName?: string;

  /** Which credentials (if any) this specific build shipped with — see injectSupabaseEnv/injectCloudEnv. */
  storageMode?: StorageMode;

  /** Only meaningful when storageMode is 'cloud' — the app's cloud_apps.expires_at at deploy time. */
  storageExpiresAt?: string | null;
}): Promise<void> {
  if (!authUserStore.get() || !platformSupabase) {
    return;
  }

  try {
    /*
     * The internal chat id (from the shared `chatId` store) is NOT the same as the routable
     * `/chat/<urlId>` slug — urlId is derived from the first artifact's id, only matching
     * chatId by coincidence. Resolved here so /apps' "돌아가기" link actually works; falls back
     * to the raw chatId (best-effort — still better than no link) if the lookup fails.
     */
    let linkId = params.chatId;

    try {
      const db = await openDatabase();
      const chat = db ? await getMessagesById(db, params.chatId) : undefined;

      if (chat?.urlId) {
        linkId = chat.urlId;
      }
    } catch (lookupError) {
      logger.warn('Failed to resolve urlId for deployed app record, falling back to chatId', lookupError);
    }

    const row = {
      chat_id: linkId,
      app_name: params.appName,
      url: params.url,
      provider: params.provider,
      project_name: params.projectName ?? null,
      storage_mode: params.storageMode ?? 'sample',
      storage_expires_at: params.storageExpiresAt ?? null,
    };

    const { error } = await platformSupabase.from('deployed_apps').insert(row);

    if (error && isMissingStorageColumnsError(error)) {
      const { storage_mode: _storageMode, storage_expires_at: _storageExpiresAt, ...rowWithoutStorage } = row;
      const { error: fallbackError } = await platformSupabase.from('deployed_apps').insert(rowWithoutStorage);

      if (fallbackError) {
        throw fallbackError;
      }

      return;
    }

    if (error) {
      throw error;
    }
  } catch (error) {
    logger.warn('Failed to record deployed app (non-fatal)', error);
  }
}

const FULL_SELECT = 'id, chat_id, app_name, url, provider, project_name, storage_mode, storage_expires_at, deployed_at';
const FALLBACK_SELECT = 'id, chat_id, app_name, url, provider, project_name, deployed_at';

export async function getDeployedApps(): Promise<DeployedAppRecord[]> {
  if (!authUserStore.get() || !platformSupabase) {
    return [];
  }

  const { data, error } = await platformSupabase
    .from('deployed_apps')
    .select(FULL_SELECT)
    .order('deployed_at', { ascending: false });

  if (error && isMissingStorageColumnsError(error)) {
    const { data: fallbackData, error: fallbackError } = await platformSupabase
      .from('deployed_apps')
      .select(FALLBACK_SELECT)
      .order('deployed_at', { ascending: false });

    if (fallbackError) {
      logger.warn('Failed to load deployed apps', fallbackError);
      return [];
    }

    return (fallbackData ?? []).map((row) => ({
      ...row,
      storage_mode: 'sample' as StorageMode,
      storage_expires_at: null,
    })) as DeployedAppRecord[];
  }

  if (error) {
    logger.warn('Failed to load deployed apps', error);
    return [];
  }

  return (data ?? []) as DeployedAppRecord[];
}
