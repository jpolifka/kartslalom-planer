// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { useQuery } from "@tanstack/react-query";
import { getSharedTrack } from "../api/getSharedTrack";

export function useSharedTrack(token: string | undefined) {
  return useQuery({
    queryKey: ["shared_track", token],
    queryFn: () => getSharedTrack(token!),
    enabled: !!token,
    retry: false,
  });
}
