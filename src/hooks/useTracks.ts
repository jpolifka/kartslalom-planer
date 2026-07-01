// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchTracks, fetchTrack, createTrack, saveTrack, renameTrack, deleteTrack, adminListTracks, adminGetTrack, adminDeleteTrack } from "../lib/api/tracks";
import { useAuthStore } from "../store/authStore";

export function useTrackList() {
  const { session } = useAuthStore();
  return useQuery({ queryKey: ["tracks"], queryFn: fetchTracks, enabled: !!session });
}

export function useTrack(id: string | undefined) {
  return useQuery({
    queryKey: ["track", id],
    queryFn: () => fetchTrack(id!),
    enabled: !!id,
    retry: false, // kein Retry — null (RLS) und Fehler sofort als Admin-Fallback behandeln
  });
}

export function useCreateTrack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createTrack,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tracks"] }),
  });
}

export function useSaveTrack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, state }: { id: string; state: Parameters<typeof saveTrack>[1] }) =>
      saveTrack(id, state),
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: ["track", id] });
      qc.invalidateQueries({ queryKey: ["tracks"] });
    },
  });
}

export function useRenameTrack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameTrack(id, name),
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: ["track", id] });
      qc.invalidateQueries({ queryKey: ["tracks"] });
    },
    onError: () => alert("Umbenennen fehlgeschlagen. Bitte versuche es erneut."),
  });
}

export function useDeleteTrack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteTrack,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tracks"] }),
  });
}

// --- Admin ---

export function useAdminTrackList() {
  return useQuery({
    queryKey: ["admin_tracks"],
    queryFn: () => adminListTracks(),
    staleTime: 0,
  });
}

export function useAdminTrack(id: string | undefined) {
  return useQuery({
    queryKey: ["admin_track", id],
    queryFn: () => adminGetTrack(id!),
    enabled: !!id,
  });
}

export function useAdminDeleteTrack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: adminDeleteTrack,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin_tracks"] }),
  });
}
