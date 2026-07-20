// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.
//
// Supabase-Zugriffsschicht für Cloud-Strecken (nur bei aktiver Session relevant —
// im Gast-Modus läuft Persistenz stattdessen über lib/storage.ts/localStorage,
// siehe docs/persistenz.md). Schreibende Operationen mit Tarif- oder Limit-Prüfung
// laufen über SECURITY DEFINER RPCs statt direktem .insert()/.update(), damit
// Free/Pro/Team-Gates serverseitig durchgesetzt werden und nicht im Client umgehbar sind.

import { supabase } from "../supabase";
import type { SavedState } from "../storage";
import type { PlacedFormation, PlacedArrow } from "../../types";

export type TrackRow = {
  id: string;
  name: string;
  updated_at: string;
  manual_width: number;
  manual_length: number;
};

export type TrackDetail = TrackRow & {
  state_json: { items: PlacedFormation[]; arrows: PlacedArrow[] };
  area_sel_json: unknown;
  // "osm" | "rlp_dop20" — siehe src/lib/mapProviders.ts.
  map_provider_id: string;
  map_opacity: number;
  is_public: boolean;
};

export type AdminTrackRow = {
  id: string;
  owner_id: string;
  owner_email: string | null;
  name: string;
  is_public: boolean;
  manual_width: number;
  manual_length: number;
  created_at: string;
  updated_at: string;
};

export async function fetchTracks(): Promise<TrackRow[]> {
  const { data, error } = await supabase
    .from("tracks")
    .select("id, name, updated_at, manual_width, manual_length")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data;
}

const TRACK_DETAIL_COLUMNS =
  "id, name, state_json, area_sel_json, manual_width, manual_length, map_provider_id, map_opacity, is_public, created_at, updated_at" as const;

export async function fetchTrack(id: string): Promise<TrackDetail | null> {
  const { data, error } = await supabase
    .from("tracks")
    .select(TRACK_DETAIL_COLUMNS)
    .eq("id", id)
    .maybeSingle(); // null statt 406 wenn RLS keine Zeile liefert (Admin fremde Strecke)
  if (error) throw error;
  return data as TrackDetail | null;
}

// Erstellen via RPC — serverseitiges Limit-Check.
// TRACK_LIMIT_REACHED: Free-Tarif erlaubt nur eine begrenzte Anzahl eigener
// Strecken; wird die RPC-Fehlermeldung geworfen, muss die UI zum Dashboard
// zurück (kein Fallback, kein Client-seitiges Umgehen möglich).
export async function createTrack(name = "Neue Strecke"): Promise<string> {
  const { data, error } = await supabase.rpc("create_track", { track_name: name });
  if (error) {
    if (error.message.includes("track_limit_reached")) throw new Error("TRACK_LIMIT_REACHED");
    if (error.message.includes("invalid_name"))         throw new Error("INVALID_NAME");
    throw error;
  }
  return data as string;
}

// Speichern via RPC — Ownership + Tier-Validierung serverseitig.
// Kein direktes .from("tracks").update() — das wäre am Server vorbei.
// MAP_PROVIDER_REQUIRES_PRO: Free-Nutzer dürfen einen Premium-Kartenanbieter
// (z. B. "rlp_dop20"-Luftbild) zwar lokal auswählen, aber der Server lehnt das
// Speichern ab — die UI setzt mapProviderId danach automatisch auf "osm" zurück.
export async function saveTrack(
  id: string,
  state: Omit<SavedState, "version">
): Promise<void> {
  const { error } = await supabase.rpc("save_track", {
    p_track_id:        id,
    p_state_json:      { items: state.items, arrows: state.arrows },
    p_area_sel:        state.areaSel,
    p_width:           state.manualWidth,
    p_length:          state.manualLength,
    p_map_provider_id: state.mapProviderId,
    p_opacity:         state.mapOpacity,
  });
  if (error) {
    if (error.message.includes("map_provider_requires_pro")) throw new Error("MAP_PROVIDER_REQUIRES_PRO");
    if (error.message.includes("not_owner"))                 throw new Error("NOT_OWNER");
    throw error;
  }
  // last_active_at wird in save_track() serverseitig gesetzt — kein separater touch_last_active() nötig
}

export async function renameTrack(id: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  const { error } = await supabase.rpc("rename_track", { p_track_id: id, p_name: trimmed });
  if (error) {
    if (error.message.includes("not_owner"))    throw new Error("NOT_OWNER");
    if (error.message.includes("invalid_name")) throw new Error("INVALID_NAME");
    throw error;
  }
}

// Löschen: RLS reicht (kein Feature-Bypass möglich)
export async function deleteTrack(id: string): Promise<void> {
  const { error } = await supabase.from("tracks").delete().eq("id", id);
  if (error) throw error;
}

// --- Share-Links ---
// Öffentliche, widerrufbare Nur-Lese-Links auf eine Strecke, ohne Anmeldung für
// Betrachter (Pro/Team-Feature, siehe docs/track-share-links.md). Es existiert
// immer nur EIN aktiver Token pro Strecke — ein neu erzeugter Link ersetzt den
// alten sofort, es gibt keinen Verlauf mehrerer gleichzeitig gültiger Links.
// Der Plaintext-Token wird nur bei der Erzeugung einmalig zurückgegeben —
// gespeichert wird serverseitig ausschließlich dessen SHA-256-Hash.

// SHARE_REQUIRES_PRO: Free-Tarif darf keine Share-Links erzeugen.
export async function createTrackShareLink(id: string): Promise<string> {
  const { data, error } = await supabase.rpc("create_track_share_link", { p_track_id: id });
  if (error) {
    if (error.message.includes("share_requires_pro")) throw new Error("SHARE_REQUIRES_PRO");
    if (error.message.includes("account_deleted"))     throw new Error("ACCOUNT_DELETED");
    if (error.message.includes("not_owner"))           throw new Error("NOT_OWNER");
    throw error;
  }
  return data as string;
}

export async function revokeTrackShareLink(id: string): Promise<void> {
  const { error } = await supabase.rpc("revoke_track_share_link", { p_track_id: id });
  if (error) {
    if (error.message.includes("not_owner")) throw new Error("NOT_OWNER");
    throw error;
  }
}

// --- Versionshistorie ---
// Anders als Autosave (überschreibt laufend den aktuellen Stand) sind Versionen
// bewusst gesetzte, manuelle Snapshots des aktuellen state_json — z. B. um vor
// einer größeren Änderung einen Wiederherstellungspunkt zu haben. Pro/Team-Feature
// (siehe docs/planning/IMPLEMENTATION_PLAN.md: "letzte 10 für Pro, unbegrenzt für Team").

export type TrackVersion = {
  id: string;
  version_number: number;
  created_at: string;
};

// VERSION_HISTORY_REQUIRES_PRO: Free-Tarif kann keine Snapshots anlegen.
export async function createTrackVersion(trackId: string): Promise<string> {
  const { data, error } = await supabase.rpc("create_track_version", { p_track_id: trackId });
  if (error) {
    if (error.message.includes("version_history_requires_pro")) throw new Error("VERSION_HISTORY_REQUIRES_PRO");
    if (error.message.includes("not_owner"))                   throw new Error("NOT_OWNER");
    throw error;
  }
  return data as string;
}

export async function getTrackVersions(trackId: string): Promise<TrackVersion[]> {
  const { data, error } = await supabase.rpc("get_track_versions", { p_track_id: trackId });
  if (error) {
    if (error.message.includes("not_owner")) throw new Error("NOT_OWNER");
    throw error;
  }
  return (data ?? []) as TrackVersion[];
}

// Überschreibt den AKTUELLEN Stand des zugehörigen Tracks mit diesem Snapshot
// (destruktiv, im Unterschied zu createTrackFromVersion weiter unten). Kann wie
// saveTrack() an MAP_PROVIDER_REQUIRES_PRO scheitern, falls der Snapshot einen
// Premium-Kartenanbieter referenziert, der Nutzer aber inzwischen auf Free ist.
export async function restoreTrackVersion(versionId: string): Promise<void> {
  const { error } = await supabase.rpc("restore_track_version", { p_version_id: versionId });
  if (error) {
    if (error.message.includes("map_provider_requires_pro")) throw new Error("MAP_PROVIDER_REQUIRES_PRO");
    if (error.message.includes("not_owner"))                 throw new Error("NOT_OWNER");
    throw error;
  }
}

export async function deleteTrackVersion(versionId: string): Promise<void> {
  const { error } = await supabase.rpc("delete_track_version", { p_version_id: versionId });
  if (error) {
    if (error.message.includes("not_owner")) throw new Error("NOT_OWNER");
    throw error;
  }
}

// "Speichern unter" — legt den Snapshot als NEUEN, eigenständigen Track an.
// Der Ursprungstrack bleibt dabei unverändert (im Unterschied zu restoreTrackVersion).
export async function createTrackFromVersion(versionId: string, name: string): Promise<string> {
  const { data, error } = await supabase.rpc("create_track_from_version", {
    p_version_id: versionId,
    p_name: name,
  });
  if (error) {
    if (error.message.includes("track_limit_reached"))       throw new Error("TRACK_LIMIT_REACHED");
    if (error.message.includes("map_provider_requires_pro"))  throw new Error("MAP_PROVIDER_REQUIRES_PRO");
    if (error.message.includes("not_owner"))                  throw new Error("NOT_OWNER");
    if (error.message.includes("invalid_name"))               throw new Error("INVALID_NAME");
    throw error;
  }
  return data as string;
}

export type TrackVersionDetail = {
  version_number: number;
  state_json: { items: PlacedFormation[]; arrows: PlacedArrow[] };
  area_sel_json: unknown;
  manual_width: number | null;   // numeric → JS number
  manual_length: number | null;
  map_provider_id: string | null;
  map_opacity: number | null;
  created_at: string;
};

export async function getTrackVersionDetail(versionId: string): Promise<TrackVersionDetail | null> {
  const { data, error } = await supabase.rpc("get_track_version_detail", { p_version_id: versionId });
  if (error) {
    if (error.message.includes("not_owner")) throw new Error("NOT_OWNER");
    throw error;
  }
  const rows = data as TrackVersionDetail[] | null;
  return rows?.[0] ?? null;
}

// --- Admin ---
// Admin-RPCs umgehen RLS bewusst (fremde Tracks lesen/löschen, inkl. owner_email
// zur Zuordnung) — nur für die interne Admin-Oberfläche, nicht für normale Nutzer.

export async function adminListTracks(ownerId?: string): Promise<AdminTrackRow[]> {
  const { data, error } = await supabase.rpc("admin_list_tracks", {
    p_owner_id: ownerId ?? null,
  });
  if (error) throw error;
  return data as AdminTrackRow[];
}

export async function adminGetTrack(id: string): Promise<TrackDetail> {
  const { data, error } = await supabase.rpc("admin_get_track", { p_id: id });
  if (error) throw error;
  return data as TrackDetail;
}

export async function adminDeleteTrack(id: string): Promise<void> {
  const { error } = await supabase.rpc("admin_delete_track", { p_id: id });
  if (error) throw error;
}
