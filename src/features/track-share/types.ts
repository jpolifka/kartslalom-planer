// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import type { PlacedArrow, PlacedFormation } from "../../types";

// Öffentlich lesbarer Feldsatz von get_track_by_share_token() — bewusst ohne
// owner_id/E-Mail (analog zu get_library_formations, siehe Migration) und
// ohne centerLat/centerLng/rotationDeg/map_provider_id/map_opacity: der
// öffentliche Viewer zeigt keinen Kartenhintergrund (Kartenanbieter-
// Nutzungsbedingungen, siehe docs/track-share-links.md), daher würde die
// genaue Geoposition der Strecke hier nur ungenutzt öffentlich preisgegeben.
//
// manual_width/manual_length sind trotz des Namens die EFFEKTIVE Feldgröße
// (bei aktivem Kartenausschnitt: dessen Breite/Höhe, sonst der reine
// Manual-Wert) — siehe 20260713000001_fix_share_field_dimensions.sql. Nur
// die Größe, nicht die Position, wird also öffentlich sichtbar.
export type SharedTrackDetail = {
  id: string;
  name: string;
  state_json: { items: PlacedFormation[]; arrows: PlacedArrow[] };
  manual_width: number;
  manual_length: number;
  updated_at: string;
};
