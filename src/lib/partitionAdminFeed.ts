import type { FeedProfile } from "@/lib/profileVisibility";

/** Admin: split feed by listing owner's subscription. Order within each group follows the feed (newest first). */
export function partitionFeedByOwnerSubscription(profiles: FeedProfile[] | undefined, isAdmin: boolean) {
  const list = profiles ?? [];
  if (!isAdmin) {
    return { showSections: false as const, paid: [] as FeedProfile[], free: [] as FeedProfile[], all: list };
  }
  const paid = list.filter((p) => p.owner_is_paid === true);
  const free = list.filter((p) => p.owner_is_paid !== true);
  return { showSections: true as const, paid, free, all: list };
}
