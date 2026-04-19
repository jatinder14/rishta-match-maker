import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "react-router-dom";
import { Search, LogOut, Heart, User, Shield, Plus } from "lucide-react";
import { fetchProfilesFeed } from "@/lib/fetchProfilesFeed";
import { SubscribeButton } from "@/components/SubscribeButton";
import { ProfileFeedCardGrid } from "@/components/ProfileFeedCardGrid";
import { partitionFeedByOwnerSubscription } from "@/lib/partitionAdminFeed";

/** Browse listings (all roles). Admins use this from the admin header because `/dashboard` redirects admins to `/admin`. */
const Discover = () => {
  const { user, isAdmin, isPaid, signOut } = useAuth();
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState<string>("all");

  const { data: profiles, isLoading, error: profilesError } = useQuery({
    queryKey: ["profiles-feed", "discover", search, genderFilter, user?.id, isPaid, isAdmin],
    queryFn: async () => {
      if (!user?.id) return [];
      return fetchProfilesFeed({
        search,
        genderFilter,
        viewerUserId: user.id,
        isPaid,
        isAdmin,
      });
    },
    enabled: !!user,
  });

  const feedSections = useMemo(
    () => partitionFeedByOwnerSubscription(profiles, !!isAdmin),
    [profiles, isAdmin],
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link to={isAdmin ? "/admin" : "/dashboard"} className="flex items-center gap-2">
            <Heart className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold font-serif">Discover</span>
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {isAdmin && (
              <>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/admin">
                    <Shield className="mr-1 h-4 w-4" /> Admin directory
                  </Link>
                </Button>
                <Button size="sm" asChild>
                  <Link to="/profile/new">
                    <Plus className="mr-1 h-4 w-4" /> Add user &amp; profile
                  </Link>
                </Button>
              </>
            )}
            {!isAdmin && !isPaid && <SubscribeButton className="hidden sm:inline-flex" />}
            <Button variant="ghost" size="icon" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        {!isAdmin && !isPaid && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">Free preview</p>
                <p className="text-sm text-muted-foreground">
                  One photo per profile; other fields stay masked until you subscribe (₹499/month).
                </p>
              </div>
              <SubscribeButton />
            </CardContent>
          </Card>
        )}

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, city, caste, occupation..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={genderFilter} onValueChange={setGenderFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Gender" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Genders</SelectItem>
              <SelectItem value="Male">Male</SelectItem>
              <SelectItem value="Female">Female</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {profilesError && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="py-3 text-sm">
              <p className="font-medium text-destructive">Could not load listings</p>
              <p className="text-muted-foreground">{profilesError.message}</p>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <div className="aspect-[4/3] bg-muted rounded-t-lg" />
                <CardContent className="p-4 space-y-2">
                  <div className="h-5 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !profiles?.length ? (
          <div className="py-16 text-center text-muted-foreground">
            <User className="mx-auto mb-2 h-10 w-10 opacity-40" />
            <p>No profiles match your filters.</p>
          </div>
        ) : feedSections.showSections ? (
          <div className="space-y-10">
            <section className="space-y-3">
              <div className="flex items-baseline justify-between gap-2 border-b pb-2">
                <h2 className="text-lg font-semibold">Paid subscribers</h2>
                <span className="text-sm text-muted-foreground">{feedSections.paid.length} listing(s)</span>
              </div>
              <ProfileFeedCardGrid profiles={feedSections.paid} emptyLabel="No listings from paid members." />
            </section>
            <section className="space-y-3">
              <div className="flex items-baseline justify-between gap-2 border-b pb-2">
                <h2 className="text-lg font-semibold">Free / not subscribed</h2>
                <span className="text-sm text-muted-foreground">{feedSections.free.length} listing(s)</span>
              </div>
              <ProfileFeedCardGrid profiles={feedSections.free} emptyLabel="No listings from free members." />
            </section>
          </div>
        ) : (
          <ProfileFeedCardGrid profiles={profiles ?? []} />
        )}
      </main>
    </div>
  );
};

export default Discover;
