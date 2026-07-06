// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import type { PlacedArrow, PlacedFormation } from "../../types";

// Öffentlich lesbarer Feldsatz von get_track_by_share_token() — bewusst ohne
// owner_id/E-Mail (analog zu get_library_formations, siehe Migration).
export type SharedTrackDetail = {
  id: string;
  name: string;
  state_json: { items: PlacedFormation[]; arrows: PlacedArrow[] };
  area_sel_json: unknown;
  manual_width: number;
  manual_length: number;
  map_satellite: boolean;
  map_opacity: number;
  updated_at: string;
};
