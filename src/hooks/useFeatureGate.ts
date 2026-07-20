// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.
//
// Feature-Gate für Features, deren Tarif-Voraussetzung sich ändern kann, OHNE einen
// Deploy zu brauchen: der nötige Tarif steht in der app_config-Tabelle (server-konfigurierbar,
// von Admins per SQL/Dashboard änderbar) statt hartcodiert im Client wie in useTier.ts.
// useTier.ts bildet die aktuell feststehenden Free/Pro/Team-Limits ab (Compile-Time-Konstanten);
// useFeatureGate ist für Features gedacht, die z. B. erst später kostenpflichtig werden sollen
// oder testweise für alle freigeschaltet sind (custom_formations_required_tier = null, siehe
// docs/planning/CUSTOM_FORMATIONS_PLAN.md — noch kein aktives Tarif-Modell dafür).
// Wie bei useTier gilt: das hier ist nur die UX-Anzeige, das eigentliche Enforcement
// übernehmen die SECURITY DEFINER RPCs am Server (siehe mapError() in customFormations.ts).

import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useTier } from "./useTier";

type Feature = "custom_formations";

const CONFIG_KEY: Record<Feature, string> = {
  custom_formations: "custom_formations_required_tier",
};

export function useFeatureGate(feature: Feature) {
  const { tier, isLoggedIn } = useTier();

  const { data: requiredTier } = useQuery({
    queryKey: ["app_config", feature],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_config")
        .select("value")
        .eq("key", CONFIG_KEY[feature])
        .single();
      // value is stored as JSONB null → data?.value is null or a quoted string
      const v = data?.value;
      if (v === null || v === undefined || v === "null") return null;
      return (v as string).replace(/^"|"$/g, ""); // strip JSON quotes if present
    },
    staleTime: 5 * 60 * 1000,
  });

  // Nicht eingeloggt → nie erlaubt, unabhängig vom konfigurierten Tarif
  if (!isLoggedIn) return { allowed: false, requiredTier: requiredTier ?? null };

  const rt = requiredTier ?? null;
  const allowed =
    rt === null ||
    rt === "free" ||
    (rt === "pro" && (tier === "pro" || tier === "team")) ||
    (rt === "team" && tier === "team");

  return { allowed, requiredTier: rt };
}
