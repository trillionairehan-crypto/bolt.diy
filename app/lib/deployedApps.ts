import { authUserStore } from '~/lib/stores/auth';
import { platformSupabase } from '~/lib/supabase/platform-client';
import { openDatabase, getMessagesById } from '~/lib/persistence/db';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('deployedApps');

export interface DeployedAppRecord {
  id: string;
  chat_id: string;
  app_name: string;
  url: string;
  provider: string;
  project_name: string | null;
  deployed_at: string;
}

/**
 * Records a successful deploy for the "내 앱" (/apps) dashboard. Best-effort only — a failure
 * here must never surface to the user or interrupt the deploy flow they just watched succeed
 * (the deploy itself already completed by the time this runs), so every error is swallowed and
 * just logged. Also a deliberate no-op for guests (the table's RLS is keyed to auth.uid(), and
 * /apps itself requires login) and silently no-ops until the deployed_apps table migration
 * (supabase/migrations/20260825000001_deployed_apps.sql) is actually applied — until then this
 * always fails past the `.from('deployed_apps')` call and is caught below.
 */
export async function recordDeployedApp(params: {
  chatId: string;
  appName: string;
  url: string;
  provider: string;

  /** Cloudflare Pages project name, when provider is 'cloudflare' — see the migration's own comment. */
  projectName?: string;
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

    const { error } = await platformSupabase.from('deployed_apps').insert({
      chat_id: linkId,
      app_name: params.appName,
      url: params.url,
      provider: params.provider,
      project_name: params.projectName ?? null,
    });

    if (error) {
      throw error;
    }
  } catch (error) {
    logger.warn('Failed to record deployed app (non-fatal)', error);
  }
}

export async function getDeployedApps(): Promise<DeployedAppRecord[]> {
  if (!authUserStore.get() || !platformSupabase) {
    return [];
  }

  const { data, error } = await platformSupabase
    .from('deployed_apps')
    .select('id, chat_id, app_name, url, provider, project_name, deployed_at')
    .order('deployed_at', { ascending: false });

  if (error) {
    logger.warn('Failed to load deployed apps', error);
    return [];
  }

  return (data ?? []) as DeployedAppRecord[];
}
