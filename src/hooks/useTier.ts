// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { useAuthStore } from "../store/authStore";

const LIMITS = { free: 3, pro: 50, team: Infinity } as const;

// Nur für UX-Entscheidungen: Buttons deaktivieren, Hinweise zeigen.
// Das eigentliche Enforcement passiert auf dem Server in create_track() und save_track().
export function useTier() {
  const { profile } = useAuthStore();
  const tier = profile?.tier ?? "free";
  return {
    tier,
    isLoggedIn: !!profile,
    trackLimit: LIMITS[tier],
    canUsePremiumMapProviders: tier !== "free",
    canUsePolygonArea:         tier !== "free",
    canShareLinks:             tier !== "free",
    canUseVersionHistory:      tier !== "free",
    canExportPng:              tier !== "free",
  };
}
