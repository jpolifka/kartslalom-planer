// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.
//
// Lädt das Profil (Tarif/Rolle) des eingeloggten Nutzers und schreibt es in den
// globalen authStore, sobald es ankommt — Session (Auth) und Profil (Tarif) sind
// bewusst getrennte Ladevorgänge, weil die Session synchron beim App-Start verfügbar
// ist (main.tsx), das Profil aber erst per Query nachgeladen wird.
//
// Wird zentral in GlobalLayout aufgerufen, das alle Routen umschließt — auch die ohne
// AuthGuard (z. B. /formations/:id, die ohne Login nutzbar ist, aber profile.tier für das
// Feature-Gate braucht). Seiten müssen den Hook daher nicht selbst aufrufen; ein zusätzlicher
// Aufruf wäre dank gleichem React-Query-Key ("profile", userId) aber unschädlich.

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
        .select("id, email, tier, role, display_name")
        .eq("id", session!.user.id)
        .single();
      if (error) throw error;
      return data as { id: string; email: string; tier: "free" | "pro" | "team"; role: string | null; display_name: string | null };
    },
    enabled: !!session,
  });

  // Profil in den globalen Store spiegeln, sobald die Query neue Daten liefert —
  // so lesen andere Hooks/Komponenten (z. B. useTier) es synchron aus dem Store
  // statt selbst eine eigene Query abonnieren zu müssen.
  useEffect(() => {
    if (query.data) setProfile(query.data);
  }, [query.data, setProfile]);

  return query;
}
