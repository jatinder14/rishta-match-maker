import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate, Link } from "react-router-dom";
import { Search, Plus, LogOut, Heart, User, MapPin, Calendar } from "lucide-react";
import { format, differenceInYears } from "date-fns";

const Dashboard = () => {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState<string>("all");

  const { data: profiles, isLoading } = useQuery({
    queryKey: ["profiles", search, genderFilter],
    queryFn: async () => {
      let query = supabase.from("profiles").select("*, profile_photos(storage_path, display_order)");

      if (genderFilter !== "all") {
        query = query.eq("gender", genderFilter);
      }

      if (search.trim()) {
        query = query.or(
          `name.ilike.%${search}%,surname.ilike.%${search}%,residence_city.ilike.%${search}%,caste.ilike.%${search}%,occupation.ilike.%${search}%`
        );
      }

      query = query.order("created_at", { ascending: false });
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const getPhotoUrl = (path: string) => {
    const { data } = supabase.storage.from("profile-photos").getPublicUrl(path);
    return data.publicUrl;
  };

  const getAge = (dob: string | null) => {
    if (!dob) return null;
    return differenceInYears(new Date(), new Date(dob));
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link to="/dashboard" className="flex items-center gap-2">
            <Heart className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold font-serif">Rishte Wale Sardarji</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button onClick={() => navigate("/profile/new")} size="sm">
              <Plus className="mr-1 h-4 w-4" /> Add Profile
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        {/* Search & Filters */}
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

        {/* Profile Grid */}
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
        ) : profiles?.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <User className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="text-lg font-medium">No profiles found</h3>
            <p className="text-muted-foreground">
              {search ? "Try a different search term" : "Add your first profile to get started"}
            </p>
            <Button onClick={() => navigate("/profile/new")}>
              <Plus className="mr-1 h-4 w-4" /> Add Profile
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {profiles?.map((profile) => {
              const photos = profile.profile_photos as any[];
              const firstPhoto = photos?.sort((a: any, b: any) => a.display_order - b.display_order)?.[0];
              const age = getAge(profile.date_of_birth);

              return (
                <Card
                  key={profile.id}
                  className="overflow-hidden cursor-pointer hover:shadow-[var(--shadow-elevated)] transition-shadow group"
                  onClick={() => navigate(`/profile/${profile.id}`)}
                >
                  <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                    {firstPhoto ? (
                      <img
                        src={getPhotoUrl(firstPhoto.storage_path)}
                        alt={`${profile.name}'s photo`}
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <User className="h-16 w-16 text-muted-foreground/30" />
                      </div>
                    )}
                    <div className="absolute top-2 right-2">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        profile.gender === "Male"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-pink-100 text-pink-800"
                      }`}>
                        {profile.gender}
                      </span>
                    </div>
                  </div>
                  <CardContent className="p-4 space-y-1">
                    <h3 className="font-semibold text-lg truncate">
                      {profile.name} {profile.surname}
                    </h3>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      {age && (
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
                    {profile.occupation && (
                      <p className="text-sm text-muted-foreground truncate">{profile.occupation}</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
