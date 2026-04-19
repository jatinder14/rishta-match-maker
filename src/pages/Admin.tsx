import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Heart, LogOut, LayoutGrid, Download, Pencil, Trash2, Users, Plus } from "lucide-react";
import { parseFeedProfiles, type FeedProfile } from "@/lib/profileVisibility";
import { differenceInYears } from "date-fns";
import { rowsToCsv, downloadCsv } from "@/lib/csvExport";
import { adminDeleteProfile } from "@/lib/adminDeleteProfile";
import { toast } from "sonner";

type AdminAccountRow = {
  user_id: string;
  email: string | null;
  phone: string | null;
  created_at: string | null;
  profile_id: string | null;
};

function parseAdminAccounts(data: unknown): AdminAccountRow[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as AdminAccountRow[];
  if (typeof data === "string") {
    try {
      const parsed = JSON.parse(data) as unknown;
      return Array.isArray(parsed) ? (parsed as AdminAccountRow[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function collectPhotoPaths(p: FeedProfile): string[] {
  const photos = p.profile_photos ?? [];
  return photos.map((x) => x.storage_path).filter(Boolean) as string[];
}

const Admin = () => {
  const { user, isAdmin, entitlementsLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"profiles" | "accounts">("profiles");
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState("");
  const [accountSearch, setAccountSearch] = useState("");

  const { data: rows, isLoading } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_profiles");
      if (error) throw error;
      return parseFeedProfiles(data);
    },
    enabled: !!user && isAdmin,
  });

  const { data: accountRows, isLoading: accountsLoading } = useQuery({
    queryKey: ["admin-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_accounts");
      if (error) throw error;
      return parseAdminAccounts(data);
    },
    enabled: !!user && isAdmin,
  });

  const deleteMutation = useMutation({
    mutationFn: async (p: FeedProfile) => {
      await adminDeleteProfile(p.id, collectPhotoPaths(p));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["profiles-feed"] });
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Profile removed.");
    },
    onError: (e: Error) => toast.error(e.message || "Delete failed"),
  });

  const needle = search.trim().toLowerCase();
  const cityNeedle = cityFilter.trim().toLowerCase();

  const filteredProfiles = useMemo(() => {
    const list = rows ?? [];
    return list.filter((p) => {
      if (genderFilter && genderFilter !== "all") {
        if ((p.gender || "").toLowerCase() !== genderFilter.toLowerCase()) return false;
      }
      if (cityNeedle && !(String(p.residence_city || "").toLowerCase().includes(cityNeedle))) return false;
      if (!needle) return true;
      const hay = [
        p.name,
        p.surname,
        p.residence_city,
        p.occupation,
        p.caste,
        p.account_email,
        p.account_phone,
        p.contact_email,
        p.contact_phone,
        (p as { user_id?: string }).user_id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, needle, genderFilter, cityNeedle]);

  const filteredAccounts = useMemo(() => {
    const list = accountRows ?? [];
    const n = accountSearch.trim().toLowerCase();
    if (!n) return list;
    return list.filter((a) => {
      const hay = [a.email, a.phone, a.user_id, a.profile_id].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(n);
    });
  }, [accountRows, accountSearch]);

  if (!entitlementsLoading && !isAdmin) {
    navigate("/dashboard", { replace: true });
    return null;
  }

  const getAge = (dob: string | null | undefined) => {
    if (!dob) return "—";
    return `${differenceInYears(new Date(), new Date(dob))} yrs`;
  };

  const exportProfilesCsv = () => {
    const headers = [
      "profile_id",
      "user_id",
      "name",
      "surname",
      "gender",
      "age_years",
      "residence_city",
      "occupation",
      "caste",
      "account_email",
      "account_phone",
      "listing_contact_phone",
      "listing_contact_email",
    ];
    const data = filteredProfiles.map((p) => {
      const age =
        p.date_of_birth != null && p.date_of_birth !== ""
          ? differenceInYears(new Date(), new Date(p.date_of_birth as string))
          : "";
      return {
        profile_id: p.id,
        user_id: (p as { user_id?: string }).user_id ?? "",
        name: p.name ?? "",
        surname: p.surname ?? "",
        gender: p.gender ?? "",
        age_years: age === "" ? "" : String(age),
        residence_city: p.residence_city ?? "",
        occupation: p.occupation ?? "",
        caste: p.caste ?? "",
        account_email: p.account_email ?? "",
        account_phone: p.account_phone ?? "",
        listing_contact_phone: p.contact_phone ?? "",
        listing_contact_email: p.contact_email ?? "",
      };
    });
    downloadCsv(`profiles-export-${new Date().toISOString().slice(0, 10)}.csv`, rowsToCsv(headers, data));
    toast.success("CSV downloaded.");
  };

  const exportAccountsCsv = () => {
    const headers = ["user_id", "email", "phone", "created_at", "profile_id", "has_listing"];
    const data = filteredAccounts.map((a) => ({
      user_id: a.user_id,
      email: a.email ?? "",
      phone: a.phone ?? "",
      created_at: a.created_at ?? "",
      profile_id: a.profile_id ?? "",
      has_listing: a.profile_id ? "yes" : "no",
    }));
    downloadCsv(`accounts-export-${new Date().toISOString().slice(0, 10)}.csv`, rowsToCsv(headers, data));
    toast.success("CSV downloaded.");
  };

  const confirmDeleteProfile = (p: FeedProfile) => {
    const name = [p.name, p.surname].filter(Boolean).join(" ") || "this profile";
    if (!window.confirm(`Permanently delete ${name}? This cannot be undone.`)) return;
    deleteMutation.mutate(p);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Heart className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold font-serif">Admin</span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button size="sm" asChild>
              <Link to="/profile/new">
                <Plus className="mr-1 h-4 w-4" /> Add user &amp; profile
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/dashboard">
                <LayoutGrid className="mr-1 h-4 w-4" /> Listings
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/discover">Browse</Link>
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-4 px-4 py-6">
        <div className="flex flex-wrap gap-2">
          <Button variant={tab === "profiles" ? "default" : "outline"} size="sm" onClick={() => setTab("profiles")}>
            Listings ({filteredProfiles.length}
            {rows ? ` / ${rows.length}` : ""})
          </Button>
          <Button variant={tab === "accounts" ? "default" : "outline"} size="sm" onClick={() => setTab("accounts")}>
            <Users className="mr-1 h-4 w-4" />
            Accounts ({filteredAccounts.length}
            {accountRows ? ` / ${accountRows.length}` : ""})
          </Button>
        </div>

        {tab === "profiles" ? (
          <Card>
            <CardHeader className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base">All listings</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Filter and export CSV. Edit opens the form; delete removes DB rows (storage cleaned when paths are
                    known).
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={exportProfilesCsv} disabled={!filteredProfiles.length}>
                  <Download className="mr-1 h-4 w-4" />
                  Download CSV
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <Label htmlFor="admin-search">Search</Label>
                  <Input
                    id="admin-search"
                    placeholder="Name, city, email, phone, user id…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Gender</Label>
                  <Select value={genderFilter} onValueChange={setGenderFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="admin-city">City contains</Label>
                  <Input
                    id="admin-city"
                    placeholder="e.g. Delhi"
                    value={cityFilter}
                    onChange={(e) => setCityFilter(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button type="button" variant="ghost" size="sm" className="mb-0.5" onClick={() => {
                    setSearch("");
                    setGenderFilter("all");
                    setCityFilter("");
                  }}>
                    Clear filters
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Gender</TableHead>
                      <TableHead>Age</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>Account email</TableHead>
                      <TableHead>Account phone</TableHead>
                      <TableHead>Listing contact</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProfiles.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">
                          {[p.name, p.surname].filter(Boolean).join(" ") || "—"}
                        </TableCell>
                        <TableCell>{p.gender ?? "—"}</TableCell>
                        <TableCell>{getAge(p.date_of_birth as string | undefined)}</TableCell>
                        <TableCell>{(p.residence_city as string) || "—"}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs">{p.account_email || "—"}</TableCell>
                        <TableCell className="text-xs">{p.account_phone || "—"}</TableCell>
                        <TableCell className="max-w-[220px] text-xs">
                          {[p.contact_phone, p.contact_email].filter(Boolean).join(" · ") || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="outline" asChild>
                              <Link to={`/profile/${p.id}`}>View</Link>
                            </Button>
                            <Button size="sm" variant="outline" asChild>
                              <Link to={`/profile/${p.id}/edit`}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={deleteMutation.isPending}
                              onClick={() => confirmDeleteProfile(p)}
                              title="Delete profile"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base">Auth accounts</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Every sign-up; profile_id is set when they have a listing. Open edit only when a listing exists.
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={exportAccountsCsv} disabled={!filteredAccounts.length}>
                  <Download className="mr-1 h-4 w-4" />
                  Download CSV
                </Button>
              </div>
              <div className="max-w-md space-y-1.5">
                <Label htmlFor="account-search">Search accounts</Label>
                <Input
                  id="account-search"
                  placeholder="Email, phone, user id…"
                  value={accountSearch}
                  onChange={(e) => setAccountSearch(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {accountsLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>User id</TableHead>
                      <TableHead>Listing</TableHead>
                      <TableHead className="text-right">Open</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAccounts.map((a) => (
                      <TableRow key={a.user_id}>
                        <TableCell className="max-w-[200px] truncate text-xs">{a.email || "—"}</TableCell>
                        <TableCell className="text-xs">{a.phone || "—"}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {a.created_at ? new Date(a.created_at).toLocaleDateString() : "—"}
                        </TableCell>
                        <TableCell className="max-w-[120px] truncate font-mono text-[10px] text-muted-foreground">
                          {a.user_id}
                        </TableCell>
                        <TableCell>{a.profile_id ? "Yes" : "No"}</TableCell>
                        <TableCell className="text-right">
                          {a.profile_id ? (
                            <Button size="sm" variant="outline" asChild>
                              <Link to={`/profile/${a.profile_id}/edit`}>
                                <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                              </Link>
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Admin;
