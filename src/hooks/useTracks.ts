// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchTracks, fetchTrack, createTrack, saveTrack, renameTrack, deleteTrack, adminListTracks, adminGetTrack, adminDeleteTrack, createTrackVersion, getTrackVersions, restoreTrackVersion, deleteTrackVersion, getTrackVersionDetail, createTrackFromVersion, createTrackShareLink, revokeTrackShareLink } from "../lib/api/tracks";
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

// --- Share-Links ---

export function useCreateTrackShareLink(trackId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => createTrackShareLink(trackId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["track", trackId] }),
  });
}

export function useRevokeTrackShareLink(trackId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => revokeTrackShareLink(trackId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["track", trackId] }),
  });
}

// --- Versionshistorie ---

export function useTrackVersions(trackId: string | undefined) {
  return useQuery({
    queryKey: ["track_versions", trackId],
    queryFn: () => getTrackVersions(trackId!),
    enabled: !!trackId,
  });
}

export function useCreateTrackVersion(trackId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => createTrackVersion(trackId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["track_versions", trackId] }),
  });
}

export function useRestoreTrackVersion(trackId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (versionId: string) => restoreTrackVersion(versionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["track", trackId] });
      qc.invalidateQueries({ queryKey: ["tracks"] });
    },
  });
}

// Legt eine neue, eigenständige Strecke aus einem Snapshot an.
// Invalidiert bewusst nur ["tracks"] (Liste) — der Ursprungstrack
// (["track", trackId]) bleibt unverändert und muss nicht neu geladen werden.
export function useCreateTrackFromVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ versionId, name }: { versionId: string; name: string }) =>
      createTrackFromVersion(versionId, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tracks"] }),
  });
}

export function useTrackVersionDetail(versionId: string | undefined) {
  return useQuery({
    queryKey: ["track_version_detail", versionId],
    queryFn: () => getTrackVersionDetail(versionId!),
    enabled: !!versionId,
  });
}

export function useDeleteTrackVersion(trackId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (versionId: string) => deleteTrackVersion(versionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["track_versions", trackId] }),
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
