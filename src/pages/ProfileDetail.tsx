import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { ArrowLeft, Edit, Share2, FileDown, Heart, User } from "lucide-react";
import { toast } from "sonner";
import { differenceInYears } from "date-fns";

const ProfileDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*, profile_photos(id, storage_path, display_order)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const getPhotoUrl = (path: string) => {
    const { data } = supabase.storage.from("profile-photos").getPublicUrl(path);
    return data.publicUrl;
  };

  const canEdit = isAdmin || profile?.user_id === user?.id;

  const formatWhatsAppMessage = () => {
    if (!profile) return "";
    const age = profile.date_of_birth ? differenceInYears(new Date(), new Date(profile.date_of_birth)) : "";
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
    const msg = formatWhatsAppMessage();
    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  const downloadPDF = async () => {
    // Dynamic import to keep bundle small
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

  const photos = (profile.profile_photos as any[])?.sort((a: any, b: any) => a.display_order - b.display_order) || [];
  const age = profile.date_of_birth ? differenceInYears(new Date(), new Date(profile.date_of_birth)) : null;

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
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Link to="/dashboard" className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-primary" />
            </Link>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && (
              <Button variant="outline" size="sm" onClick={() => navigate(`/profile/${id}/edit`)}>
                <Edit className="mr-1 h-4 w-4" /> Edit
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 space-y-6">
        {/* Photo Gallery */}
        {photos.length > 0 ? (
          <div className="px-10">
            <Carousel>
              <CarouselContent>
                {photos.map((photo: any) => (
                  <CarouselItem key={photo.id}>
                    <div className="aspect-[3/4] sm:aspect-[4/3] rounded-xl overflow-hidden bg-muted">
                      <img
                        src={getPhotoUrl(photo.storage_path)}
                        alt={`${profile.name}'s photo`}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              {photos.length > 1 && (
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

        {/* Name & Quick Info */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold">{profile.name} {profile.surname}</h1>
          <div className="flex items-center justify-center gap-3 text-muted-foreground text-sm">
            {age && <span>{age} years</span>}
            {profile.residence_city && <span>• {profile.residence_city}</span>}
            {profile.occupation && <span>• {profile.occupation}</span>}
          </div>
        </div>

        {/* Personal Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">💠 Personal Information</CardTitle>
          </CardHeader>
          <CardContent>
            <InfoRow label="Gender" value={profile.gender} />
            <InfoRow label="Marital Status" value={profile.marital_status} />
            <InfoRow label="Date of Birth" value={profile.date_of_birth ? `${profile.date_of_birth}${age ? ` (${age} yrs)` : ""}` : null} />
            <InfoRow label="Time of Birth" value={profile.time_of_birth} />
            <InfoRow label="Place of Birth" value={profile.place_of_birth} />
            <InfoRow label="Height" value={profile.height} />
            <InfoRow label="Manglik" value={profile.manglik} />
            <InfoRow label="Qualification" value={profile.qualification} />
            <InfoRow label="Occupation" value={profile.occupation} />
            <InfoRow label="Income" value={profile.income} />
            <InfoRow label="Work Location" value={profile.work_location} />
          </CardContent>
        </Card>

        {/* Family Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">💠 Family Information</CardTitle>
          </CardHeader>
          <CardContent>
            <InfoRow label="Religion" value={profile.religion} />
            <InfoRow label="Gotar" value={profile.gotar} />
            <InfoRow label="Caste" value={profile.caste} />
            <InfoRow label="Father's Occupation" value={profile.father_occupation} />
            <InfoRow label="Mother's Occupation" value={profile.mother_occupation} />
            <InfoRow label="Siblings" value={profile.siblings} />
            <InfoRow label="Family Class" value={profile.family_class} />
          </CardContent>
        </Card>

        {/* Additional */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">📍 Additional Details</CardTitle>
          </CardHeader>
          <CardContent>
            <InfoRow label="Residence City" value={profile.residence_city} />
            <InfoRow label="Property Details" value={profile.property_details} />
            {profile.notes && (
              <div className="pt-2">
                <span className="text-muted-foreground text-sm">Notes</span>
                <p className="mt-1 text-sm">{profile.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button onClick={shareWhatsApp} className="flex-1" variant="default">
            <Share2 className="mr-2 h-4 w-4" /> Share via WhatsApp
          </Button>
          <Button onClick={downloadPDF} className="flex-1" variant="outline">
            <FileDown className="mr-2 h-4 w-4" /> Download PDF
          </Button>
        </div>
      </main>
    </div>
  );
};

export default ProfileDetail;
