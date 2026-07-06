// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { supabase } from "../../../lib/supabase";
import type { SharedTrackDetail } from "../types";

export async function getSharedTrack(token: string): Promise<SharedTrackDetail> {
  const { data, error } = await supabase.rpc("get_track_by_share_token", { p_token: token });
  if (error) {
    if (error.message.includes("token_invalid"))       throw new Error("TOKEN_INVALID");
    if (error.message.includes("rate_limit_exceeded")) throw new Error("RATE_LIMIT_EXCEEDED");
    throw error;
  }
  const rows = data as SharedTrackDetail[] | null;
  if (!rows || rows.length === 0) throw new Error("TOKEN_INVALID");
  return rows[0];
}
