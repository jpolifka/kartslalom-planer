// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { supabase } from "../../../lib/supabase";
import type { SharedTrackDetail } from "../types";

// Löst einen öffentlichen Share-Token in die zugehörige Strecke auf. Der
// Endpunkt ist bewusst ohne Login nutzbar (siehe SharedTrackDetail), daher
// gelten hier andere Regeln als bei authentifizierten Requests:
// - token_invalid: Token existiert nicht (mehr) — falsch, abgelaufen, oder
//   der Link wurde vom Eigentümer widerrufen/durch einen neuen ersetzt
//   ("ein aktiver Link pro Strecke", siehe ShareLinkDialog).
// - rate_limit_exceeded: Serverseitiges Limit pro Token/Stunde. Da der
//   Endpunkt ohne Auth erreichbar ist, könnte er sonst zum Durchprobieren
//   von Tokens (Brute-Force) oder für Scraping missbraucht werden — das
//   Limit schützt davor, nicht vor normaler Nutzung.
export async function getSharedTrack(token: string): Promise<SharedTrackDetail> {
  const { data, error } = await supabase.rpc("get_track_by_share_token", { p_token: token });
  if (error) {
    if (error.message.includes("token_invalid"))       throw new Error("TOKEN_INVALID");
    if (error.message.includes("rate_limit_exceeded")) throw new Error("RATE_LIMIT_EXCEEDED");
    throw error;
  }
  const rows = data as SharedTrackDetail[] | null;
  // Leeres Ergebnis ohne SQL-Fehler wird ebenfalls wie ein ungültiger Token
  // behandelt (RPC liefert z.B. aus RLS-Gründen einfach keine Zeile statt
  // eines Fehlers) — der Aufrufer soll in beiden Fällen dieselbe Meldung sehen.
  if (!rows || rows.length === 0) throw new Error("TOKEN_INVALID");
  return rows[0];
}
