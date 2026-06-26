// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

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

  if (!isLoggedIn) return { allowed: false, requiredTier: requiredTier ?? null };

  const rt = requiredTier ?? null;
  const allowed =
    rt === null ||
    rt === "free" ||
    (rt === "pro" && (tier === "pro" || tier === "team")) ||
    (rt === "team" && tier === "team");

  return { allowed, requiredTier: rt };
}
