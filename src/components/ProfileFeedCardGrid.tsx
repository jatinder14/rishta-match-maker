import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { User, MapPin, Calendar } from "lucide-react";
import { differenceInYears } from "date-fns";
import { type FeedProfile, type VisibilityTier } from "@/lib/profileVisibility";

type Props = {
  profiles: FeedProfile[];
  emptyLabel?: string;
};

function tierLabel(t: VisibilityTier | undefined) {
  if (t === "free") return "Preview";
  if (t === "paid" || t === "owner") return "Full";
  if (t === "admin") return "Admin";
  return "";
}

export function ProfileFeedCardGrid({ profiles, emptyLabel = "No listings in this section" }: Props) {
  const navigate = useNavigate();

  const getPhotoUrl = (path: string) => {
    const { data } = supabase.storage.from("profile-photos").getPublicUrl(path);
    return data.publicUrl;
  };

  const getAge = (dob: string | null | undefined) => {
    if (!dob) return null;
    return differenceInYears(new Date(), new Date(dob));
  };

  if (profiles.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">{emptyLabel}</p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {profiles.map((profile) => {
        const photos = (profile.profile_photos as FeedProfile["profile_photos"]) ?? [];
        const firstPhoto = photos?.[0];
        const age = getAge(profile.date_of_birth as string | undefined);
        const tier = profile.visibility_tier as VisibilityTier | undefined;
        const isPreview = tier === "free";

        return (
          <Card
            key={profile.id}
            className="group cursor-pointer overflow-hidden transition-shadow hover:shadow-[var(--shadow-elevated)]"
            onClick={() => navigate(`/profile/${profile.id}`)}
          >
            <div className="relative aspect-[4/3] overflow-hidden bg-muted">
              {firstPhoto ? (
                <img
                  src={getPhotoUrl(firstPhoto.storage_path)}
                  alt="Profile"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <User className="h-16 w-16 text-muted-foreground/30" />
                </div>
              )}
              <div className="absolute right-2 top-2 flex flex-col items-end gap-1">
                {tier && (
                  <span className="inline-flex items-center rounded-full border bg-background/90 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {tierLabel(tier)}
                  </span>
                )}
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    profile.gender === "Male" ? "bg-blue-100 text-blue-800" : "bg-pink-100 text-pink-800"
                  }`}
                >
                  {profile.gender}
                </span>
              </div>
            </div>
            <CardContent className="space-y-1 p-4">
              <h3 className="truncate text-lg font-semibold">
                {isPreview ? "Member (hidden)" : [profile.name, profile.surname].filter(Boolean).join(" ")}
              </h3>
              {!isPreview && (
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  {age != null && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" /> {age} yrs
                    </span>
                  )}
                  {profile.residence_city && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" /> {profile.residence_city}
                    </span>
                  )}
                </div>
              )}
              {!isPreview && profile.occupation && (
                <p className="truncate text-sm text-muted-foreground">{profile.occupation}</p>
              )}
              {isPreview && (
                <p className="text-sm text-muted-foreground">Subscribe to unlock full biodata and all photos.</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
