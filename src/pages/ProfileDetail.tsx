import { useParams, useNavigate, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { ArrowLeft, Edit, Share2, FileDown, Heart, User, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { adminDeleteProfile } from "@/lib/adminDeleteProfile";
import { differenceInYears } from "date-fns";
import { SubscribeButton } from "@/components/SubscribeButton";
import type { FeedProfile, VisibilityTier } from "@/lib/profileVisibility";

const ProfileDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isAdmin } = useAuth();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile-view", id, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_profile_for_viewer", { p_profile_id: id! });
      if (error) throw error;
      return data as (FeedProfile & Record<string, unknown>) | null;
    },
    enabled: !!id && !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!id || !profile) return;
      const paths =
        ((profile.profile_photos as FeedProfile["profile_photos"]) ?? [])
          .map((x) => x.storage_path)
          .filter(Boolean) as string[];
      await adminDeleteProfile(id, paths);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["profiles-feed"] });
      queryClient.invalidateQueries({ queryKey: ["profile-view"] });
      toast.success("Profile removed.");
      navigate("/admin");
    },
    onError: (e: Error) => toast.error(e.message || "Delete failed"),
  });

  const getPhotoUrl = (path: string) => {
    const { data } = supabase.storage.from("profile-photos").getPublicUrl(path);
    return data.publicUrl;
  };

  const tier = (profile?.visibility_tier as VisibilityTier | undefined) ?? undefined;
  const isMasked = tier === "free";
  const canEdit = tier === "owner" || tier === "admin";
  const canAdminDelete = isAdmin && !!id && !!profile && tier === "admin";
  const showContact = tier === "owner" || tier === "admin";
  const canExport = tier === "paid" || tier === "owner" || tier === "admin";

  const formatWhatsAppMessage = () => {
    if (!profile || isMasked) return "";
    const age = profile.date_of_birth ? differenceInYears(new Date(), new Date(profile.date_of_birth as string)) : "";
    return `💠 *PERSONAL INFORMATION*💠
----------------------------------------------
*Gender*:- ${profile.gender}
*Marital Status*:- ${profile.marital_status || ""}
*Surname*:- ${profile.surname || ""}
*Name* :- ${profile.name}
*Date of Birth* :- ${profile.date_of_birth || ""}${age ? ` (${age} yrs)` : ""}
*Time of Birth*:- ${profile.time_of_birth || ""}
*Place of Birth*:- ${profile.place_of_birth || ""}
*Height* :- ${profile.height || ""}
*Manglik yes/no* : ${profile.manglik || ""}
*Qualification 🎓* : ${profile.qualification || ""}
*Occupation* : ${profile.occupation || ""}
*Income* : ${profile.income || ""}
🏢 *Work Location*:- ${profile.work_location || ""}

💠 *FAMILY INFORMATION*💠
------------------------------------------
*Religion/Gotar/Caste*:- ${[profile.religion, profile.gotar, profile.caste].filter(Boolean).join(" / ")}
*Father Occupation* : ${profile.father_occupation || ""}
*Mother occupation* :- ${profile.mother_occupation || ""}
*Siblings* : ${profile.siblings || ""}
*Family Class-*:- ${profile.family_class || ""}

👉🏻 *Note*:- ${profile.notes || ""}
🏠 *Residence City*: ${profile.residence_city || ""}
*Property Details*: ${profile.property_details || ""}`;
  };

  const shareWhatsApp = () => {
    if (!canExport) {
      toast.message("Subscribe to share full biodata.");
      return;
    }
    const msg = formatWhatsAppMessage();
    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  const downloadPDF = async () => {
    if (!canExport) {
      toast.message("Subscribe to download the full profile.");
      return;
    }
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    const lines = formatWhatsAppMessage().replace(/\*/g, "").split("\n");

    doc.setFontSize(10);
    let y = 20;
    doc.setFontSize(16);
    doc.text("Rishte Wale Sardarji", 105, y, { align: "center" });
    y += 10;
    doc.setFontSize(10);

    for (const line of lines) {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, 15, y);
      y += 6;
    }

    doc.save(`${profile?.name || "profile"}-${profile?.surname || ""}.pdf`);
    toast.success("PDF downloaded!");
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Profile not found</p>
      </div>
    );
  }

  const photos =
    (profile.profile_photos as FeedProfile["profile_photos"])?.sort(
      (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)
    ) || [];
  const age = profile.date_of_birth ? differenceInYears(new Date(), new Date(profile.date_of_birth as string)) : null;

  const InfoRow = ({ label, value }: { label: string; value: string | null | undefined }) => {
    if (!value) return null;
    return (
      <div className="flex justify-between py-2 border-b border-border/50 last:border-0">
        <span className="text-muted-foreground text-sm">{label}</span>
        <span className="font-medium text-sm text-right max-w-[60%]">{value}</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Link to={isAdmin ? "/admin" : "/dashboard"} className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-primary" />
            </Link>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && id && (
              <Button variant="outline" size="sm" onClick={() => navigate(`/profile/${id}/edit`)}>
                <Edit className="mr-1 h-4 w-4" /> Edit
              </Button>
            )}
            {canAdminDelete && (
              <Button
                variant="destructive"
                size="sm"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  if (!window.confirm("Permanently delete this listing? This cannot be undone.")) return;
                  deleteMutation.mutate();
                }}
              >
                <Trash2 className="mr-1 h-4 w-4" /> Delete
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 space-y-6">
        {isMasked && (
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-base">Preview listing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                Free accounts see one photo and gender only. Subscribe at ₹499/month to unlock full biodata and all
                photos. After you like someone, our team reaches out over WhatsApp — paid members do not see other
                people&apos;s phone numbers or emails in the app.
              </p>
              <SubscribeButton />
            </CardContent>
          </Card>
        )}

        {photos.length > 0 ? (
          <div className="px-10">
            <Carousel>
              <CarouselContent>
                {photos.map((photo) => (
                  <CarouselItem key={photo.id ?? photo.storage_path}>
                    <div className="aspect-[3/4] sm:aspect-[4/3] rounded-xl overflow-hidden bg-muted">
                      <img
                        src={getPhotoUrl(photo.storage_path)}
                        alt="Profile photo"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              {photos.length > 1 && !isMasked && (
                <>
                  <CarouselPrevious />
                  <CarouselNext />
                </>
              )}
            </Carousel>
          </div>
        ) : (
          <div className="flex items-center justify-center aspect-[4/3] rounded-xl bg-muted">
            <User className="h-20 w-20 text-muted-foreground/30" />
          </div>
        )}

        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold">
            {isMasked ? "Member" : `${profile.name} ${profile.surname || ""}`}
          </h1>
          {!isMasked && (
            <div className="flex items-center justify-center gap-3 text-muted-foreground text-sm">
              {age && <span>{age} years</span>}
              {profile.residence_city && <span>• {profile.residence_city as string}</span>}
              {profile.occupation && <span>• {profile.occupation as string}</span>}
            </div>
          )}
        </div>

        {!isMasked && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">💠 Personal Information</CardTitle>
              </CardHeader>
              <CardContent>
                <InfoRow label="Gender" value={profile.gender as string} />
                <InfoRow label="Marital Status" value={profile.marital_status as string} />
                <InfoRow
                  label="Date of Birth"
                  value={
                    profile.date_of_birth
                      ? `${profile.date_of_birth}${age ? ` (${age} yrs)` : ""}`
                      : null
                  }
                />
                <InfoRow label="Time of Birth" value={profile.time_of_birth as string} />
                <InfoRow label="Place of Birth" value={profile.place_of_birth as string} />
                <InfoRow label="Height" value={profile.height as string} />
                <InfoRow label="Manglik" value={profile.manglik as string} />
                <InfoRow label="Qualification" value={profile.qualification as string} />
                <InfoRow label="Occupation" value={profile.occupation as string} />
                <InfoRow label="Income" value={profile.income as string} />
                <InfoRow label="Work Location" value={profile.work_location as string} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">💠 Family Information</CardTitle>
              </CardHeader>
              <CardContent>
                <InfoRow label="Religion" value={profile.religion as string} />
                <InfoRow label="Gotar" value={profile.gotar as string} />
                <InfoRow label="Caste" value={profile.caste as string} />
                <InfoRow label="Father's Occupation" value={profile.father_occupation as string} />
                <InfoRow label="Mother's Occupation" value={profile.mother_occupation as string} />
                <InfoRow label="Siblings" value={profile.siblings as string} />
                <InfoRow label="Family Class" value={profile.family_class as string} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">📍 Additional Details</CardTitle>
              </CardHeader>
              <CardContent>
                <InfoRow label="Residence City" value={profile.residence_city as string} />
                <InfoRow label="Property Details" value={profile.property_details as string} />
                {profile.notes && (
                  <div className="pt-2">
                    <span className="text-muted-foreground text-sm">Notes</span>
                    <p className="mt-1 text-sm">{profile.notes as string}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {showContact && (profile.contact_phone || profile.contact_email) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Listing contact (owner / admin only)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {profile.contact_phone && (
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Phone</span>
                      <span className="font-medium text-right">{profile.contact_phone as string}</span>
                    </div>
                  )}
                  {profile.contact_email && (
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Email</span>
                      <span className="font-medium text-right break-all">{profile.contact_email as string}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button onClick={shareWhatsApp} className="flex-1" variant="default" disabled={!canExport}>
            <Share2 className="mr-2 h-4 w-4" /> Share via WhatsApp
          </Button>
          <Button onClick={downloadPDF} className="flex-1" variant="outline" disabled={!canExport}>
            <FileDown className="mr-2 h-4 w-4" /> Download PDF
          </Button>
        </div>
      </main>
    </div>
  );
};

export default ProfileDetail;
