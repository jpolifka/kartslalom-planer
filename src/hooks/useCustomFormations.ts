// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

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
  type CreateFormationParams,
} from "../lib/api/customFormations";

export function useCustomFormationList() {
  const { session } = useAuthStore();
  return useQuery({
    queryKey: ["custom_formations"],
    queryFn: fetchCustomFormations,
    enabled: !!session,
    staleTime: 0, // immer frisch laden wenn Fenster/Tab fokussiert wird
  });
}

export function useCustomFormation(id: string | undefined) {
  return useQuery({
    queryKey: ["custom_formation", id],
    queryFn: () => fetchCustomFormation(id!),
    enabled: !!id,
  });
}

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

export function useDuplicateCustomFormation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sourceId: string) => duplicateCustomFormation(sourceId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom_formations"] }),
  });
}
