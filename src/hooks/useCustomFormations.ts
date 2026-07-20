// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.
//
// React-Query-Fassade über die Custom-Formations-API (src/lib/api/customFormations.ts).
// Deckt den gesamten Lebenszyklus einer eigenen Formation ab: eigene Liste/CRUD,
// Freigabe an andere Nutzer (Sharing), Community-Bibliothek (Library) sowie die
// Admin-Moderation (Freigabe/Ablehnung eingereichter Formationen). Alle Mutationen
// gehen serverseitig durch SECURITY DEFINER RPCs; hier wird nur invalidiert, nicht
// selbst geprüft — Tarif-Gates (z. B. premium_required) und RLS entscheiden am Server.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../store/authStore";
import {
  fetchCustomFormations,
  fetchCustomFormation,
  fetchLibraryFormations,
  createCustomFormation,
  updateCustomFormation,
  deleteCustomFormation,
  findShareableUser,
  shareFormation,
  unshareFormation,
  fetchFormationShares,
  fetchSharedFormations,
  fetchFormationPermission,
  duplicateCustomFormation,
  setDisplayName,
  isCurrentUserAdmin,
  adminGetFormation,
  adminListFormations,
  adminDeleteFormation,
  adminPromoteToLibrary,
  adminUpdateFormation,
  type CreateFormationParams,
} from "../lib/api/customFormations";

// Liefert alle eigenen Formationen (private, geteilt, eingereicht ...) des eingeloggten Nutzers.
export function useCustomFormationList() {
  const { session } = useAuthStore();
  return useQuery({
    queryKey: ["custom_formations", session?.user.id],
    queryFn: () => fetchCustomFormations(session!.user.id),
    enabled: !!session,
    staleTime: 0, // immer frisch laden wenn Fenster/Tab fokussiert wird
  });
}

// Liefert eine einzelne Formation per ID — greift sowohl für eigene als auch für
// per Sharing/Library freigegebene Formationen (RLS entscheidet, was zurückkommt).
export function useCustomFormation(id: string | undefined) {
  return useQuery({
    queryKey: ["custom_formation", id],
    queryFn: () => fetchCustomFormation(id!),
    enabled: !!id,
    retry: false, // kein Retry — null (RLS) und Fehler werden sofort als Admin-Fallback behandelt
  });
}

// Öffentliche Formations-Bibliothek (status="library", von Admins freigegeben).
// Ändert sich selten → langes staleTime spart unnötige Refetches.
export function useLibraryFormations() {
  return useQuery({
    queryKey: ["library_formations"],
    queryFn: fetchLibraryFormations,
    staleTime: 10 * 60 * 1000,
  });
}

export function useCreateCustomFormation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: CreateFormationParams) => createCustomFormation(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom_formations"] }),
  });
}

export function useUpdateCustomFormation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...p }: { id: string } & Omit<CreateFormationParams, "source_formation_key" | "source_custom_formation_id">) =>
      updateCustomFormation(id, p),
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: ["custom_formation", id] });
      qc.invalidateQueries({ queryKey: ["custom_formations"] });
    },
  });
}

export function useDeleteCustomFormation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteCustomFormation,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom_formations"] }),
  });
}

// Fehlercodes der obigen Mutationen (z. B. "premium_required", wenn das Server-Feature-Gate
// aus useFeatureGate greift) werden bewusst nicht hier behandelt, sondern von mapError()
// in lib/api/customFormations.ts übersetzt und von den aufrufenden Komponenten ausgewertet.

// --- Sharing ---

export function useFormationShares(formationId: string | undefined) {
  return useQuery({
    queryKey: ["formation_shares", formationId],
    queryFn: () => fetchFormationShares(formationId!),
    enabled: !!formationId,
  });
}

export function useShareFormation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ formationId, targetId, permission }: { formationId: string; targetId: string; permission: "view" | "edit" }) =>
      shareFormation(formationId, targetId, permission),
    onSuccess: (_d, { formationId }) =>
      qc.invalidateQueries({ queryKey: ["formation_shares", formationId] }),
  });
}

export function useUnshareFormation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ formationId, targetId }: { formationId: string; targetId: string }) =>
      unshareFormation(formationId, targetId),
    onSuccess: (_d, { formationId }) =>
      qc.invalidateQueries({ queryKey: ["formation_shares", formationId] }),
  });
}

export function useFindShareableUser() {
  return useMutation({
    mutationFn: (query: string) => findShareableUser(query),
  });
}

export function useSharedFormations() {
  const { session } = useAuthStore();
  return useQuery({
    queryKey: ["shared_formations"],
    queryFn: fetchSharedFormations,
    enabled: !!session,
  });
}

export function useFormationPermission(id: string | undefined) {
  const { session } = useAuthStore();
  return useQuery({
    queryKey: ["formation_permission", id],
    queryFn: () => fetchFormationPermission(id!),
    enabled: !!id && !!session,
    staleTime: 30 * 1000,
  });
}

// Erstellt eine eigene, unabhängige Kopie einer Library-/geteilten Formation
// (z. B. um eine Bibliotheks-Formation als Ausgangspunkt für eigene Änderungen zu nutzen).
export function useDuplicateCustomFormation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sourceId: string) => duplicateCustomFormation(sourceId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom_formations"] }),
  });
}

// --- Profil ---

export function useSetDisplayName() {
  const { profile, setProfile } = useAuthStore();
  return useMutation({
    mutationFn: (displayName: string | null) => setDisplayName(displayName),
    onSuccess: (_d, displayName) => {
      if (profile) setProfile({ ...profile, display_name: displayName ?? null });
    },
  });
}

// --- Admin ---
// Moderations-Workflow für zur Bibliothek eingereichte Formationen (status="submitted"):
// Admins sichten, promoten (→ Kopie in die öffentliche Library) oder bearbeiten/löschen.
// Zugriffsschutz liegt komplett serverseitig (RPCs prüfen is_admin) — useIsAdmin dient nur
// dem UI (z. B. Admin-Menüpunkt ein-/ausblenden).

export function useIsAdmin() {
  const { session } = useAuthStore();
  return useQuery({
    queryKey: ["is_admin"],
    queryFn: isCurrentUserAdmin,
    enabled: !!session,
    staleTime: 60_000,
  });
}

export function useAdminFormation(id: string | undefined) {
  return useQuery({
    queryKey: ["admin_formation", id],
    queryFn: () => adminGetFormation(id!),
    enabled: !!id,
  });
}

export function useAdminFormationList(status?: string, category?: string, limit = 100, offset = 0) {
  return useQuery({
    queryKey: ["admin_formations", status ?? null, category ?? null, limit, offset],
    queryFn: () => adminListFormations(status, category, limit, offset),
    staleTime: 0,
  });
}

export function useAdminDeleteFormation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: adminDeleteFormation,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin_formations"] }),
  });
}

// Übernimmt eine eingereichte Formation als Kopie in die öffentliche Library
// (Original des Einreichers bleibt unangetastet) — daher Invalidierung beider Listen.
export function useAdminPromoteToLibrary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, category }: { id: string; category: string }) =>
      adminPromoteToLibrary(id, category),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin_formations"] });
      qc.invalidateQueries({ queryKey: ["library_formations"] });
    },
  });
}

export function useAdminUpdateFormation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...p }: { id: string } & Omit<CreateFormationParams, "source_formation_key" | "source_custom_formation_id">) =>
      adminUpdateFormation(id, p),
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: ["admin_formation", id] });
      qc.invalidateQueries({ queryKey: ["admin_formations"] });
    },
  });
}
