// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";

type Tier = "free" | "pro" | "team";

export type Profile = { id: string; email: string; tier: Tier; role: string | null };

type AuthStore = {
  session: Session | null;
  profile: Profile | null;
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
