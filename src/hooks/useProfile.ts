// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../store/authStore";

export function useProfile() {
  const { session, setProfile } = useAuthStore();

  const query = useQuery({
    queryKey: ["profile", session?.user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, tier, role")
        .eq("id", session!.user.id)
        .single();
      if (error) throw error;
      return data as { id: string; email: string; tier: "free" | "pro" | "team"; role: string | null };
    },
    enabled: !!session,
  });

  useEffect(() => {
    if (query.data) setProfile(query.data);
  }, [query.data, setProfile]);

  return query;
}
