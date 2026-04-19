import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMyProfile } from "@/hooks/useMyProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Upload, X, Heart } from "lucide-react";
import { Link } from "react-router-dom";

const Field = ({ label, field, type = "text", placeholder = "", value, onChange }: { label: string; field: string; type?: string; placeholder?: string; value: string; onChange: (field: string, value: string) => void }) => (
  <div className="space-y-1.5">
    <Label htmlFor={field}>{label}</Label>
    <Input
      id={field}
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(field, e.target.value)}
    />
  </div>
);

const ProfileForm = () => {
  const { id } = useParams();
  const isEditing = !!id && id !== "new";
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { data: existingOwn } = useMyProfile({ enabled: !!user && !isEditing && !isAdmin });

  const [form, setForm] = useState({
    gender: "Male",
    marital_status: "",
    surname: "",
    name: "",
    date_of_birth: "",
    time_of_birth: "",
    place_of_birth: "",
    height: "",
    manglik: "",
    qualification: "",
    occupation: "",
    income: "",
    work_location: "",
    religion: "",
    gotar: "",
    caste: "",
    father_occupation: "",
    mother_occupation: "",
    siblings: "",
    family_class: "",
    residence_city: "",
    property_details: "",
    notes: "",
    contact_phone: "",
    contact_email: "",
  });

  const [photos, setPhotos] = useState<File[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<{ id: string; storage_path: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [ownerUserId, setOwnerUserId] = useState("");

  useEffect(() => {
    if (!isEditing && !isAdmin && existingOwn?.id) {
      navigate(`/profile/${existingOwn.id}/edit`, { replace: true });
    }
  }, [isEditing, isAdmin, existingOwn?.id, navigate]);

  // Load existing profile for editing
  useQuery({
    queryKey: ["profile-edit", id],
    queryFn: async () => {
      if (!isEditing) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*, profile_photos(id, storage_path, display_order)")
        .eq("id", id)
        .single();
      if (error) throw error;
      if (data) {
        setForm({
          gender: data.gender,
          marital_status: data.marital_status || "",
          surname: data.surname || "",
          name: data.name,
          date_of_birth: data.date_of_birth || "",
          time_of_birth: data.time_of_birth || "",
          place_of_birth: data.place_of_birth || "",
          height: data.height || "",
          manglik: data.manglik || "",
          qualification: data.qualification || "",
          occupation: data.occupation || "",
          income: data.income || "",
          work_location: data.work_location || "",
          religion: data.religion || "",
          gotar: data.gotar || "",
          caste: data.caste || "",
          father_occupation: data.father_occupation || "",
          mother_occupation: data.mother_occupation || "",
          siblings: data.siblings || "",
          family_class: data.family_class || "",
          residence_city: data.residence_city || "",
          property_details: data.property_details || "",
          notes: data.notes || "",
          contact_phone: (data as { contact_phone?: string }).contact_phone || "",
          contact_email: (data as { contact_email?: string }).contact_email || "",
        });
        setExistingPhotos(data.profile_photos || []);
      }
      return data;
    },
    enabled: isEditing,
  });

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const total = photos.length + existingPhotos.length + files.length;
    if (total > 4) {
      toast.error("Maximum 4 photos allowed");
      return;
    }
    setPhotos((prev) => [...prev, ...files]);
  };

  const removeNewPhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingPhoto = async (photoId: string, storagePath: string) => {
    await supabase.storage.from("profile-photos").remove([storagePath]);
    await supabase.from("profile_photos").delete().eq("id", photoId);
    setExistingPhotos((prev) => prev.filter((p) => p.id !== photoId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }

    setSaving(true);
    try {
      let profileId = id;

      const targetUserId =
        isAdmin && ownerUserId.trim().length > 0 ? ownerUserId.trim() : user.id;

      if (isAdmin && ownerUserId.trim().length > 0) {
        const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuid.test(ownerUserId.trim())) {
          toast.error("Profile owner must be a valid user UUID");
          setSaving(false);
          return;
        }
      }

      if (isEditing) {
        const { error } = await supabase.from("profiles").update(form).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("profiles")
          .insert({ ...form, user_id: targetUserId })
          .select("id")
          .single();
        if (error) throw error;
        profileId = data.id;
      }

      // Upload new photos
      for (let i = 0; i < photos.length; i++) {
        const file = photos[i];
        const ext = file.name.split(".").pop();
        const path = `${profileId}/${Date.now()}-${i}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("profile-photos")
          .upload(path, file);
        if (uploadError) throw uploadError;

        await supabase.from("profile_photos").insert({
          profile_id: profileId!,
          storage_path: path,
          display_order: existingPhotos.length + i,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      queryClient.invalidateQueries({ queryKey: ["profiles-feed"] });
      queryClient.invalidateQueries({ queryKey: ["profile-view"] });
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      toast.success(isEditing ? "Profile updated!" : "Profile created!");
      navigate(`/profile/${profileId}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Something went wrong";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const getPhotoUrl = (path: string) => {
    const { data } = supabase.storage.from("profile-photos").getPublicUrl(path);
    return data.publicUrl;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Link to="/dashboard" className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-primary" />
          </Link>
          <h1 className="text-lg font-semibold">{isEditing ? "Edit Profile" : "New Profile"}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {!isEditing && isAdmin && (
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="text-base">Admin: profile owner</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Leave blank to attach this listing to your admin account. Paste a member&apos;s Supabase auth user id
                  to create their profile.
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="owner-user-id">User UUID (optional)</Label>
                  <Input
                    id="owner-user-id"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    value={ownerUserId}
                    onChange={(e) => setOwnerUserId(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          )}
          {/* Personal Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">💠 Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Gender</Label>
                <RadioGroup value={form.gender} onValueChange={(v) => updateField("gender", v)} className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="Male" id="male" />
                    <Label htmlFor="male">Male</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="Female" id="female" />
                    <Label htmlFor="female">Female</Label>
                  </div>
                </RadioGroup>
              </div>
              <Field label="Marital Status" field="marital_status" placeholder="e.g., Unmarried, Divorced" value={form.marital_status} onChange={updateField} />
              <div className="grid grid-cols-2 gap-4">
                <Field label="Surname" field="surname" value={form.surname} onChange={updateField} />
                <Field label="Name *" field="name" value={form.name} onChange={updateField} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Date of Birth" field="date_of_birth" type="date" value={form.date_of_birth} onChange={updateField} />
                <Field label="Time of Birth" field="time_of_birth" placeholder="e.g., 10:30 AM" value={form.time_of_birth} onChange={updateField} />
              </div>
              <Field label="Place of Birth" field="place_of_birth" value={form.place_of_birth} onChange={updateField} />
              <div className="grid grid-cols-2 gap-4">
                <Field label="Height" field="height" placeholder="e.g., 5'8&quot;" value={form.height} onChange={updateField} />
                <div className="space-y-2">
                  <Label>Manglik</Label>
                  <RadioGroup value={form.manglik} onValueChange={(v) => updateField("manglik", v)} className="flex gap-4 pt-2">
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="Yes" id="manglik-yes" />
                      <Label htmlFor="manglik-yes">Yes</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="No" id="manglik-no" />
                      <Label htmlFor="manglik-no">No</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
              <Field label="Qualification 🎓" field="qualification" value={form.qualification} onChange={updateField} />
              <Field label="Occupation" field="occupation" value={form.occupation} onChange={updateField} />
              <Field label="Income" field="income" value={form.income} onChange={updateField} />
              <Field label="🏢 Work Location" field="work_location" value={form.work_location} onChange={updateField} />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label="Listing contact phone (optional)"
                  field="contact_phone"
                  type="tel"
                  placeholder="Visible to you and admins only"
                  value={form.contact_phone}
                  onChange={updateField}
                />
                <Field
                  label="Listing contact email (optional)"
                  field="contact_email"
                  type="email"
                  placeholder="Visible to you and admins only"
                  value={form.contact_email}
                  onChange={updateField}
                />
              </div>
            </CardContent>
          </Card>

          {/* Family Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">💠 Family Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Religion / Gotar / Caste" field="religion" placeholder="Religion" value={form.religion} onChange={updateField} />
              <div className="grid grid-cols-2 gap-4">
                <Field label="Gotar" field="gotar" value={form.gotar} onChange={updateField} />
                <Field label="Caste" field="caste" value={form.caste} onChange={updateField} />
              </div>
              <Field label="Father's Occupation" field="father_occupation" value={form.father_occupation} onChange={updateField} />
              <Field label="Mother's Occupation" field="mother_occupation" value={form.mother_occupation} onChange={updateField} />
              <Field label="Siblings" field="siblings" placeholder="e.g., 1 Brother, 1 Sister" value={form.siblings} onChange={updateField} />
              <Field label="Family Class" field="family_class" value={form.family_class} onChange={updateField} />
            </CardContent>
          </Card>

          {/* Additional */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">📍 Additional Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="🏠 Residence City" field="residence_city" value={form.residence_city} onChange={updateField} />
              <Field label="Property Details" field="property_details" value={form.property_details} onChange={updateField} />
              <div className="space-y-1.5">
                <Label htmlFor="notes">👉🏻 Notes</Label>
                <Textarea
                  id="notes"
                  value={form.notes}
                  onChange={(e) => updateField("notes", e.target.value)}
                  placeholder="Any additional notes..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Photos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">📸 Photos (max 4)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {existingPhotos.map((photo) => (
                  <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                    <img src={getPhotoUrl(photo.storage_path)} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeExistingPhoto(photo.id, photo.storage_path)}
                      className="absolute top-1 right-1 rounded-full bg-destructive p-1 text-destructive-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {photos.map((file, i) => (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                    <img src={URL.createObjectURL(file)} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeNewPhoto(i)}
                      className="absolute top-1 right-1 rounded-full bg-destructive p-1 text-destructive-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {existingPhotos.length + photos.length < 4 && (
                  <label className="flex aspect-square cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 transition-colors">
                    <div className="text-center text-muted-foreground">
                      <Upload className="mx-auto h-6 w-6 mb-1" />
                      <span className="text-xs">Upload</span>
                    </div>
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
                  </label>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? "Saving..." : isEditing ? "Update Profile" : "Create Profile"}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              Cancel
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
};

export default ProfileForm;
