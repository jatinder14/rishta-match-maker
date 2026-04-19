import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useMyProfile(options?: { enabled?: boolean }) {
  const { user } = useAuth();
  const enabled = options?.enabled !== false;
  return useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string } | null;
    },
    enabled: !!user && enabled,
  });
}
