import { supabase } from "@/integrations/supabase/client";
import { parseFeedProfiles, type FeedProfile, type VisibilityTier } from "@/lib/profileVisibility";

type PhotoRow = { id?: string; storage_path: string; display_order?: number | null };

function sortPhotos(photos: PhotoRow[] | null | undefined): PhotoRow[] {
  return [...(photos ?? [])].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
}

function mapLegacyRow(
  row: Record<string, unknown>,
  opts: { viewerUserId: string; isPaid: boolean; isAdmin: boolean },
): FeedProfile {
  const userId = String(row.user_id ?? "");
  const owner = userId === opts.viewerUserId;
  const tier: VisibilityTier = owner ? "owner" : opts.isAdmin ? "admin" : opts.isPaid ? "paid" : "free";
  const photos = sortPhotos(row.profile_photos as PhotoRow[] | null);

  if (tier === "free") {
    const one = photos.slice(0, 1);
    return {
      id: String(row.id),
      gender: row.gender as string | undefined,
      profile_photos: one,
      visibility_tier: "free",
    };
  }

  return {
    ...(row as unknown as FeedProfile),
    profile_photos: photos,
    visibility_tier: tier,
  };
}

async function fetchPaidOwnerIds(userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from("user_subscriptions")
    .select("user_id,status,current_period_end")
    .in("user_id", userIds);
  if (error) throw error;
  const now = Date.now();
  const set = new Set<string>();
  for (const row of data ?? []) {
    const end = row.current_period_end ? new Date(row.current_period_end).getTime() : null;
    if (row.status === "active" && (end == null || end > now)) {
      set.add(row.user_id);
    }
  }
  return set;
}

async function fetchProfilesFeedLegacy(opts: {
  search: string;
  genderFilter: string;
  viewerUserId: string;
  isPaid: boolean;
  isAdmin: boolean;
}): Promise<FeedProfile[]> {
  let q = supabase.from("profiles").select("*, profile_photos(id, storage_path, display_order)");
  if (opts.genderFilter !== "all") {
    q = q.eq("gender", opts.genderFilter);
  }
  const s = opts.search.trim();
  if (s) {
    const esc = s.replace(/%/g, "\\%").replace(/_/g, "\\_");
    q = q.or(
      `name.ilike.%${esc}%,surname.ilike.%${esc}%,residence_city.ilike.%${esc}%,caste.ilike.%${esc}%,occupation.ilike.%${esc}%`,
    );
  }
  q = q.order("created_at", { ascending: false });
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  const mapped = rows.map((row) => mapLegacyRow(row, opts));
  if (!opts.isAdmin || rows.length === 0) return mapped;
  const ids = [...new Set(rows.map((r) => String(r.user_id ?? "")).filter(Boolean))];
  const paidSet = await fetchPaidOwnerIds(ids);
  return mapped.map((p, i) => ({
    ...p,
    owner_is_paid: paidSet.has(String(rows[i].user_id ?? "")),
  }));
}

export type FeedQueryOpts = {
  search: string;
  genderFilter: string;
  viewerUserId: string;
  isPaid: boolean;
  isAdmin: boolean;
};

/**
 * Prefer `feed_profiles` RPC (masked free tier). If the RPC is missing or errors (e.g. migration not applied),
 * fall back to `profiles` + `profile_photos` so the same data as Lovable still loads.
 */
export async function fetchProfilesFeed(opts: FeedQueryOpts): Promise<FeedProfile[]> {
  const { data, error } = await supabase.rpc("feed_profiles", {
    p_search: opts.search.trim() || null,
    p_gender: opts.genderFilter === "all" ? null : opts.genderFilter,
  });

  if (!error) {
    return parseFeedProfiles(data);
  }

  const msg = (error.message ?? "").toLowerCase();
  if (msg.includes("not authenticated")) {
    throw error;
  }

  console.warn("[fetchProfilesFeed] feed_profiles RPC failed, using table fallback:", error.message);
  return fetchProfilesFeedLegacy(opts);
}
