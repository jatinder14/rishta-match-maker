import { supabase } from "@/integrations/supabase/client";

/** Best-effort storage cleanup, then DB delete via SECURITY DEFINER RPC. */
export async function adminDeleteProfile(profileId: string, storagePaths: string[]) {
  const paths = [...new Set(storagePaths.filter(Boolean))];
  if (paths.length > 0) {
    await supabase.storage.from("profile-photos").remove(paths);
  }
  const { error } = await supabase.rpc("admin_delete_profile", { p_profile_id: profileId });
  if (error) throw error;
}
