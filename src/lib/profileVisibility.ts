export type VisibilityTier = "free" | "paid" | "owner" | "admin";

export type FeedProfile = {
  id: string;
  gender?: string;
  visibility_tier?: VisibilityTier;
  name?: string;
  surname?: string | null;
  date_of_birth?: string | null;
  residence_city?: string | null;
  occupation?: string | null;
  profile_photos?: { id?: string; storage_path: string; display_order?: number | null }[];
  contact_phone?: string | null;
  contact_email?: string | null;
  account_email?: string | null;
  account_phone?: string | null;
  /** Listing owner's active subscription (admin feed only). */
  owner_is_paid?: boolean;
  [key: string]: unknown;
};

export function parseFeedProfiles(data: unknown): FeedProfile[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as FeedProfile[];
  if (typeof data === "string") {
    try {
      const parsed = JSON.parse(data) as unknown;
      return Array.isArray(parsed) ? (parsed as FeedProfile[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}
