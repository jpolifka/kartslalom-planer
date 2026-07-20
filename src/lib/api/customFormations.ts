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
  owner_email?: string | null; // nur in Admin-RPCs vorhanden
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
  // Audit-Felder: optional — nicht in öffentlichen Tabellen-Abfragen enthalten
  edited_by_admin_id?: string | null;
  edited_by_admin_at?: string | null;
  edited_by_admin_email?: string | null; // nur in admin_list_custom_formations
  created_at: string;
  updated_at: string;
};

// Explizite Spalten für Tabellen-Abfragen — schließt Admin-Audit-Felder aus,
// damit Share-Empfänger (view/edit) keine internen Historienfelder sehen.
// as const nötig: String-Verkettung erzeugt keinen Literal-Typ, den der Supabase-Query-Parser
// für die Rückgabe-Inferenz benötigt.
const FORMATION_PUBLIC_COLUMNS =
  "id, owner_id, name, description, category, status, is_library, pylon_count, lichte_breite, duration_seconds, cones_json, arrows_json, default_direction, source_formation_key, source_custom_formation_id, created_at, updated_at" as const;

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

// Übersetzt die Postgres-exception-Message der RPCs in stabile, UI-taugliche
// Fehlercodes. Die Server-Strings sind interne Implementierungsdetails der
// SECURITY DEFINER Funktionen — der Code hier ist der einzige Ort, der sie kennen muss.
function mapError(msg: string): Error {
  // premium_required: Gate ist serverseitig vorbereitet (app_config.custom_formations_required_tier),
  // aktuell aber auf null gesetzt — es existiert noch kein aktives Tarif-Modell,
  // das diesen Fehler tatsächlich auslöst (siehe docs/planning/CUSTOM_FORMATIONS_PLAN.md).
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

// Legt eine neue eigene Formation an (status="private", is_library=false).
// Owner ist implizit der eingeloggte Nutzer (auth.uid() serverseitig) — kann
// später per shareFormation() an einzelne Nutzer freigegeben oder per
// admin_promote_to_library() (Kopie!) in die öffentliche Bibliothek übernommen werden.
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

// Bearbeitet eine eigene Formation. source_formation_key/source_custom_formation_id
// sind hier bewusst ausgeschlossen — die Herkunft (Kopie einer Registry- oder
// Custom-Formation) ist ein Erstellungs-Attribut und wird nachträglich nicht verändert.
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

export async function fetchCustomFormations(ownerId: string): Promise<CustomFormationRow[]> {
  // Owner-Filter explizit setzen: die RLS-Policy erlaubt zusätzlich das Lesen
  // geteilter und Library-Formationen (is_library=true) — ohne diesen Filter
  // würden fremde Library-Einträge in "Meine Hindernisse" auftauchen.
  const { data, error } = await supabase
    .from("custom_formations")
    .select(FORMATION_PUBLIC_COLUMNS)
    .eq("owner_id", ownerId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data as CustomFormationRow[];
}

export async function fetchCustomFormation(id: string): Promise<CustomFormationRow | null> {
  const { data, error } = await supabase
    .from("custom_formations")
    .select(FORMATION_PUBLIC_COLUMNS)
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
  display_name: string | null; // null = "Community-Formation" (kein Anzeigename gesetzt)
  created_at: string;
};

// Formationen mit is_library=true — für alle Nutzer (auch ohne Login) sichtbar,
// da RLS-Policy "custom_formations_select_library" is_library=true generell freigibt.
// display_name ist der frei wählbare Anzeigename des ursprünglichen Erstellers
// (null = anonym, UI zeigt dann "Community-Formation").
export async function fetchLibraryFormations(): Promise<LibraryFormationRow[]> {
  const { data, error } = await supabase.rpc("get_library_formations");
  if (error) throw error;
  return data as LibraryFormationRow[];
}

// --- Sharing ---
// Direktes Teilen einer einzelnen Formation mit einem anderen registrierten Nutzer
// (Owner behält die Kontrolle, RLS erlaubt dem Ziel-Nutzer je nach permission
// nur Lesen oder auch Bearbeiten) — unabhängig von der öffentlichen Library.

export type FormationShareEntry = {
  shared_with_id: string;
  email: string;
  permission: "view" | "edit";
  created_at: string;
};

export async function findShareableUser(email: string): Promise<{ id: string; email: string } | null> {
  const { data, error } = await supabase.rpc("find_shareable_user", { p_email: email });
  if (error) throw error;
  return (data as Array<{ id: string; email: string }>)[0] ?? null;
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

// Formationen, die ANDERE Nutzer per shareFormation() mit dem aktuellen Nutzer
// geteilt haben (Gegenstück zu fetchCustomFormations, das nur eigene liefert).
export async function fetchSharedFormations(): Promise<SharedFormationRow[]> {
  const { data, error } = await supabase.rpc("get_shared_formations");
  if (error) throw error;
  return data as SharedFormationRow[];
}

export type FormationPermission = "owner" | "edit" | "view";

// null = weder Owner noch Share-Empfänger — UI blendet Bearbeiten/Teilen-Aktionen
// entsprechend aus, unabhängig davon, ob die Formation überhaupt geladen werden konnte.
export async function fetchFormationPermission(id: string): Promise<FormationPermission | null> {
  const { data, error } = await supabase.rpc("get_my_formation_permission", { p_id: id });
  if (error) throw error;
  return data as FormationPermission | null;
}

// Kopiert eine fremde (geteilte oder Library-)Formation als neue eigene
// Formation des aktuellen Nutzers — z. B. um eine Library-Formation als
// Ausgangspunkt für eigene Anpassungen zu übernehmen.
export async function duplicateCustomFormation(sourceId: string): Promise<string> {
  const { data, error } = await supabase.rpc("duplicate_custom_formation", { p_source_id: sourceId });
  if (error) throw mapError(error.message);
  return data as string;
}

// --- Profil ---

export async function setDisplayName(displayName: string | null): Promise<void> {
  const { error } = await supabase.rpc("set_display_name", { p_display_name: displayName });
  if (error) {
    if (error.message.includes("invalid_display_name")) throw new Error("INVALID_DISPLAY_NAME");
    if (error.message.includes("account_deleted"))      throw new Error("ACCOUNT_DELETED");
    throw error;
  }
}

// --- Admin ---
// Admin-RPCs dürfen fremde/alle Formationen unabhängig vom Owner sehen/ändern
// (u.a. status in {submitted, library, rejected}, edited_by_admin_*-Audit-Felder).

export async function isCurrentUserAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_current_user_admin");
  if (error) throw error;
  return data as boolean;
}

export async function adminGetFormation(id: string): Promise<CustomFormationRow> {
  const { data, error } = await supabase.rpc("admin_get_custom_formation", { p_id: id });
  if (error) throw mapError(error.message);
  return data as CustomFormationRow;
}

export async function adminListFormations(
  status?: string,
  category?: string,
  limit = 100,
  offset = 0,
): Promise<CustomFormationRow[]> {
  const { data, error } = await supabase.rpc("admin_list_custom_formations", {
    p_status:   status   ?? null,
    p_category: category ?? null,
    p_limit:    limit,
    p_offset:   offset,
  });
  if (error) throw mapError(error.message);
  return data as CustomFormationRow[];
}

export async function adminDeleteFormation(id: string): Promise<void> {
  const { error } = await supabase.rpc("admin_delete_custom_formation", { p_id: id });
  if (error) throw mapError(error.message);
}

// Übernimmt eine von einem Nutzer eingereichte Formation (typischerweise status="submitted")
// in die öffentliche Bibliothek. Erzeugt dabei eine eigenständige KOPIE mit is_library=true —
// das Original bleibt beim ursprünglichen Ersteller unverändert samt Bearbeitungsrechten
// erhalten (siehe docs/planning/CUSTOM_FORMATIONS_PLAN.md, Abschnitt "Promote-to-Library
// = Kopie, nicht Verschieben"). Library- und Ursprungs-Eintrag laufen ab hier unabhängig
// voneinander weiter.
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
