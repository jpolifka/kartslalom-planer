// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.
//
// Alle Schreiboperationen laufen durch SECURITY DEFINER RPCs — kein direktes .insert()/.update()

import { supabase } from "../supabase";
import type { FormationCategory, ConePoint, PlacedArrow } from "../../types";

export type CustomFormationRow = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  category: FormationCategory;
  status: string;
  is_library: boolean;
  pylon_count: number;
  lichte_breite: number | null;
  duration_seconds: number | null;
  cones_json: ConePoint[];
  arrows_json: PlacedArrow[];
  default_direction: string | null;
  source_formation_key: string | null;
  source_custom_formation_id: string | null;
  edited_by_admin_id: string | null;
  edited_by_admin_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateFormationParams = {
  name: string;
  description: string | null;
  category: FormationCategory;
  cones_json: ConePoint[];
  arrows_json: PlacedArrow[];
  default_direction: string | null;
  lichte_breite: number | null;
  duration_seconds: number | null;
  source_formation_key: string | null;
  source_custom_formation_id: string | null;
};

function mapError(msg: string): Error {
  if (msg.includes("premium_required"))              return new Error("PREMIUM_REQUIRED");
  if (msg.includes("custom_formation_limit_reached")) return new Error("FORMATION_LIMIT_REACHED");
  if (msg.includes("too_many_cones"))                return new Error("TOO_MANY_CONES");
  if (msg.includes("too_many_arrows"))               return new Error("TOO_MANY_ARROWS");
  if (msg.includes("invalid_name"))                  return new Error("INVALID_NAME");
  if (msg.includes("invalid_category"))              return new Error("INVALID_CATEGORY");
  if (msg.includes("invalid_lichte_breite"))         return new Error("INVALID_LICHTE_BREITE");
  if (msg.includes("invalid_duration_seconds"))      return new Error("INVALID_DURATION_SECONDS");
  if (msg.includes("invalid_default_direction"))     return new Error("INVALID_DEFAULT_DIRECTION");
  if (msg.includes("invalid_cone_coordinates"))      return new Error("INVALID_CONE_COORDINATES");
  if (msg.includes("not_authorized"))                return new Error("NOT_AUTHORIZED");
  if (msg.includes("account_deleted"))               return new Error("ACCOUNT_DELETED");
  return new Error(msg);
}

export async function createCustomFormation(p: CreateFormationParams): Promise<string> {
  const { data, error } = await supabase.rpc("create_custom_formation", {
    p_name:                       p.name,
    p_description:                p.description,
    p_category:                   p.category,
    p_cones_json:                 p.cones_json,
    p_arrows_json:                p.arrows_json,
    p_default_direction:          p.default_direction,
    p_lichte_breite:              p.lichte_breite,
    p_duration_seconds:           p.duration_seconds,
    p_source_formation_key:       p.source_formation_key,
    p_source_custom_formation_id: p.source_custom_formation_id,
  });
  if (error) throw mapError(error.message);
  return data as string;
}

export async function updateCustomFormation(id: string, p: Omit<CreateFormationParams, "source_formation_key" | "source_custom_formation_id">): Promise<void> {
  const { error } = await supabase.rpc("update_custom_formation", {
    p_id:               id,
    p_name:             p.name,
    p_description:      p.description,
    p_category:         p.category,
    p_cones_json:       p.cones_json,
    p_arrows_json:      p.arrows_json,
    p_default_direction: p.default_direction,
    p_lichte_breite:    p.lichte_breite,
    p_duration_seconds: p.duration_seconds,
  });
  if (error) throw mapError(error.message);
}

export async function deleteCustomFormation(id: string): Promise<void> {
  const { error } = await supabase.rpc("delete_custom_formation", { p_id: id });
  if (error) throw mapError(error.message);
}

export async function fetchCustomFormations(): Promise<CustomFormationRow[]> {
  const { data, error } = await supabase
    .from("custom_formations")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data as CustomFormationRow[];
}

export async function fetchCustomFormation(id: string): Promise<CustomFormationRow | null> {
  const { data, error } = await supabase
    .from("custom_formations")
    .select("*")
    .eq("id", id)
    .maybeSingle(); // null statt 406 wenn RLS keine Zeile liefert
  if (error) throw error;
  return data as CustomFormationRow | null;
}

export type LibraryFormationRow = {
  id: string;
  name: string;
  description: string | null;
  category: FormationCategory;
  pylon_count: number;
  lichte_breite: number | null;
  duration_seconds: number | null;
  cones_json: ConePoint[];
  arrows_json: PlacedArrow[];
  default_direction: string | null;
  source_formation_key: string | null;
  created_at: string;
};

export async function fetchLibraryFormations(): Promise<LibraryFormationRow[]> {
  const { data, error } = await supabase.rpc("get_library_formations");
  if (error) throw error;
  return data as LibraryFormationRow[];
}

// --- Sharing ---

export type FormationShareEntry = {
  shared_with_id: string;
  username: string | null;
  email: string;
  permission: "view" | "edit";
  created_at: string;
};

export async function findShareableUser(query: string): Promise<{ id: string; username: string } | null> {
  const { data, error } = await supabase.rpc("find_shareable_user", { p_query: query });
  if (error) throw error;
  return (data as Array<{ id: string; username: string }>)[0] ?? null;
}

export async function shareFormation(formationId: string, targetId: string, permission: "view" | "edit"): Promise<void> {
  const { error } = await supabase.rpc("share_custom_formation", {
    p_formation_id: formationId,
    p_target_id: targetId,
    p_permission: permission,
  });
  if (error) {
    if (error.message.includes("cannot_share_with_self")) throw new Error("SHARE_WITH_SELF");
    if (error.message.includes("target_not_found")) throw new Error("TARGET_NOT_FOUND");
    if (error.message.includes("not_owner")) throw new Error("NOT_OWNER");
    throw error;
  }
}

export async function unshareFormation(formationId: string, targetId: string): Promise<void> {
  const { error } = await supabase.rpc("unshare_custom_formation", {
    p_formation_id: formationId,
    p_target_id: targetId,
  });
  if (error) throw error;
}

export async function fetchFormationShares(formationId: string): Promise<FormationShareEntry[]> {
  const { data, error } = await supabase.rpc("get_formation_shares", { p_formation_id: formationId });
  if (error) throw error;
  return data as FormationShareEntry[];
}

export type SharedFormationRow = CustomFormationRow & { permission: "view" | "edit" };

export async function fetchSharedFormations(): Promise<SharedFormationRow[]> {
  const { data, error } = await supabase.rpc("get_shared_formations");
  if (error) throw error;
  return data as SharedFormationRow[];
}

export type FormationPermission = "owner" | "edit" | "view";

export async function fetchFormationPermission(id: string): Promise<FormationPermission | null> {
  const { data, error } = await supabase.rpc("get_my_formation_permission", { p_id: id });
  if (error) throw error;
  return data as FormationPermission | null;
}

export async function duplicateCustomFormation(sourceId: string): Promise<string> {
  const { data, error } = await supabase.rpc("duplicate_custom_formation", { p_source_id: sourceId });
  if (error) throw mapError(error.message);
  return data as string;
}

// --- Admin ---

export async function adminGetFormation(id: string): Promise<CustomFormationRow> {
  const { data, error } = await supabase.rpc("admin_get_custom_formation", { p_id: id });
  if (error) throw mapError(error.message);
  return data as CustomFormationRow;
}

export async function adminListFormations(status?: string, category?: string): Promise<CustomFormationRow[]> {
  const { data, error } = await supabase.rpc("admin_list_custom_formations", {
    p_status: status ?? null,
    p_category: category ?? null,
  });
  if (error) throw mapError(error.message);
  return data as CustomFormationRow[];
}

export async function adminDeleteFormation(id: string): Promise<void> {
  const { error } = await supabase.rpc("admin_delete_custom_formation", { p_id: id });
  if (error) throw mapError(error.message);
}

export async function adminPromoteToLibrary(id: string, category: string): Promise<string> {
  const { data, error } = await supabase.rpc("admin_promote_to_library", {
    p_formation_id: id,
    p_category: category,
  });
  if (error) throw mapError(error.message);
  return data as string;
}

export async function adminUpdateFormation(
  id: string,
  p: Omit<CreateFormationParams, "source_formation_key" | "source_custom_formation_id">
): Promise<void> {
  const { error } = await supabase.rpc("admin_update_custom_formation", {
    p_id:                id,
    p_name:              p.name,
    p_description:       p.description,
    p_category:          p.category,
    p_cones_json:        p.cones_json,
    p_arrows_json:       p.arrows_json,
    p_default_direction: p.default_direction,
    p_lichte_breite:     p.lichte_breite,
    p_duration_seconds:  p.duration_seconds,
  });
  if (error) throw mapError(error.message);
}
