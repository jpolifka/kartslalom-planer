// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { useQuery } from "@tanstack/react-query";
import { getSharedTrack } from "../api/getSharedTrack";

// React-Query-Wrapper um getSharedTrack() für die öffentliche Viewer-Seite.
// retry: false, weil die möglichen Fehler (TOKEN_INVALID, RATE_LIMIT_EXCEEDED)
// beide durch automatisches Wiederholen nicht behoben würden — ein ungültiger
// Token bleibt ungültig, und gegen ein Rate-Limit erneut anzufragen würde die
// Sperre nur verschärfen. enabled: !!token verhindert den Query-Aufruf,
// solange die Token-Route (z.B. während des initialen Routings) noch keinen
// Wert geliefert hat.
export function useSharedTrack(token: string | undefined) {
  return useQuery({
    queryKey: ["shared_track", token],
    queryFn: () => getSharedTrack(token!),
    enabled: !!token,
    retry: false,
  });
}
