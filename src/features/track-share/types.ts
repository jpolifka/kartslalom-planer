// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import type { PlacedArrow, PlacedFormation } from "../../types";

// Öffentlich lesbarer Feldsatz von get_track_by_share_token() — bewusst ohne
// owner_id/E-Mail (analog zu get_library_formations, siehe Migration) und
// ohne area_sel_json/map_satellite/map_opacity: der öffentliche Viewer zeigt
// keinen Kartenhintergrund (Kartenanbieter-Nutzungsbedingungen, siehe
// docs/track-share-links.md), daher würden die Geokoordinaten der Strecke
// hier nur ungenutzt öffentlich preisgegeben.
export type SharedTrackDetail = {
  id: string;
  name: string;
  state_json: { items: PlacedFormation[]; arrows: PlacedArrow[] };
  manual_width: number;
  manual_length: number;
  updated_at: string;
};
