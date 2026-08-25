import type { SupabaseClient } from '@supabase/supabase-js';
import { buildPlatformClient } from '~/lib/cloud/cloudPlatformAuth';

/**
 * SECURITY_PLAN.md's ownership check — "does this project_name already belong to someone other
 * than this user". Uses the deployed_app_project_owned_by_other RPC (SECURITY DEFINER, so the
 * anon key can call it safely — see that migration's own comment for why no service_role key is
 * involved). Deliberately fails OPEN (returns false = "not owned by someone else, proceed") when
 * the RPC itself errors — most commonly because the migration or the deployed_apps table isn't
 * applied yet. The alternative (fail closed) would mean deploys break for everyone the instant
 * this code ships, until the migration is applied — worse than today's status quo of no ownership
 * check at all. Auth (a separate, unrelated check) never fails open like this.
 *
 * @param injectedClient test-only seam — routes never pass this, so production always builds the
 * real client from env.
 */
export async function isProjectOwnedByOther(
  projectName: string,
  userId: string,
  injectedClient?: SupabaseClient,
): Promise<boolean> {
  const client = injectedClient ?? buildPlatformClient();

  if (!client) {
    return false;
  }

  const { data, error } = await client.rpc('deployed_app_project_owned_by_other', {
    p_project_name: projectName,
    p_user_id: userId,
  });

  if (error) {
    return false;
  }

  return data === true;
}
