// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
  { auth: { flowType: "pkce" } }
);
