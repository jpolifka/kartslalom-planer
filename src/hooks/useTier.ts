// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { useAuthStore } from "../store/authStore";

// Hartcodierte, fest zum Deploy-Zeitpunkt kompilierte Tarif-Grenzen (Anzahl Strecken)
// — im Unterschied zu useFeatureGate.ts, wo der nötige Tarif serverseitig in app_config
// hinterlegt ist und sich ohne Deploy ändern lässt. Diese Werte hier ändern sich nur mit
// einem Release, daher genügt eine lokale Konstante statt einer Server-Query.
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
