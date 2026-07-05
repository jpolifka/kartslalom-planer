// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

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
  map_satellite: boolean;
  map_opacity: number;
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
  "id, name, state_json, area_sel_json, manual_width, manual_length, map_satellite, map_opacity, created_at, updated_at" as const;

export async function fetchTrack(id: string): Promise<TrackDetail | null> {
  const { data, error } = await supabase
    .from("tracks")
    .select(TRACK_DETAIL_COLUMNS)
    .eq("id", id)
    .maybeSingle(); // null statt 406 wenn RLS keine Zeile liefert (Admin fremde Strecke)
  if (error) throw error;
  return data as TrackDetail | null;
}

// Erstellen via RPC — serverseitiges Limit-Check
export async function createTrack(name = "Neue Strecke"): Promise<string> {
  const { data, error } = await supabase.rpc("create_track", { track_name: name });
  if (error) {
    if (error.message.includes("track_limit_reached")) throw new Error("TRACK_LIMIT_REACHED");
    if (error.message.includes("invalid_name"))         throw new Error("INVALID_NAME");
    throw error;
  }
  return data as string;
}

// Speichern via RPC — Ownership + Tier-Validierung serverseitig
// Kein direktes .from("tracks").update() — das wäre am Server vorbei
export async function saveTrack(
  id: string,
  state: Omit<SavedState, "version">
): Promise<void> {
  const { error } = await supabase.rpc("save_track", {
    p_track_id:   id,
    p_state_json: { items: state.items, arrows: state.arrows },
    p_area_sel:   state.areaSel,
    p_width:      state.manualWidth,
    p_length:     state.manualLength,
    p_satellite:  state.mapSatellite,
    p_opacity:    state.mapOpacity,
  });
  if (error) {
    if (error.message.includes("satellite_requires_pro")) throw new Error("SATELLITE_REQUIRES_PRO");
    if (error.message.includes("not_owner"))              throw new Error("NOT_OWNER");
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

// --- Versionshistorie ---

export type TrackVersion = {
  id: string;
  version_number: number;
  created_at: string;
};

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

export async function restoreTrackVersion(versionId: string): Promise<void> {
  const { error } = await supabase.rpc("restore_track_version", { p_version_id: versionId });
  if (error) {
    if (error.message.includes("satellite_requires_pro")) throw new Error("SATELLITE_REQUIRES_PRO");
    if (error.message.includes("not_owner"))              throw new Error("NOT_OWNER");
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
    if (error.message.includes("track_limit_reached"))    throw new Error("TRACK_LIMIT_REACHED");
    if (error.message.includes("satellite_requires_pro")) throw new Error("SATELLITE_REQUIRES_PRO");
    if (error.message.includes("not_owner"))               throw new Error("NOT_OWNER");
    if (error.message.includes("invalid_name"))            throw new Error("INVALID_NAME");
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
  map_satellite: boolean | null;
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
