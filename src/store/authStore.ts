// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.
//
// Globaler Auth-/Profil-State als Zustand-Store (kein Context/Provider nötig — der
// Store ist ein Modul-Singleton, überall per useAuthStore() abrufbar). Der Store hält
// selbst KEINE Supabase-Subscription; er wird von außen synchron gehalten:
// main.tsx ruft beim App-Start supabase.auth.getSession() ab und abonniert
// supabase.auth.onAuthStateChange(), um setSession() bei Login/Logout/Token-Refresh
// aufzurufen. Das Profil (Tarif/Rolle) kommt separat über useProfile() aus der
// profiles-Tabelle und wird per setProfile() gespiegelt — Session (Auth) und
// Profil (Tarifdaten) sind bewusst getrennte Datenquellen.

import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";

type Tier = "free" | "pro" | "team";

export type Profile = { id: string; email: string; tier: Tier; role: string | null; display_name?: string | null };

type AuthStore = {
  session: Session | null;
  profile: Profile | null;
  // true bis zum ersten getSession()-Ergebnis — verhindert, dass AppRouter kurz
  // einen "ausgeloggt"-Zustand rendert, bevor die Session überhaupt geprüft wurde.
  isLoading: boolean;
  setSession: (s: Session | null) => void;
  setProfile: (p: Profile | null) => void;
};

export const useAuthStore = create<AuthStore>((set) => ({
  session: null,
  profile: null,
  isLoading: true,
  setSession: (session) => set({ session, isLoading: false }),
  setProfile: (profile) => set({ profile }),
}));
