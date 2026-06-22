// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

export const supabase = createClient(
  SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
  { auth: { flowType: "pkce" } }
);

export function functionsUrl(name: string): string {
  return `${SUPABASE_URL}/functions/v1/${name}`;
}
