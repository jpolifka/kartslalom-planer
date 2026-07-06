// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { buildTrackPngBlob, pngFilenameFromTrackName } from "../api/renderTrackPng";
import type { PngBackground } from "../types";
import type { PlacedArrow, PlacedFormation } from "../../../types";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function useExportPng() {
  async function exportPng(
    fieldWidth: number,
    fieldLength: number,
    items: PlacedFormation[],
    arrows: PlacedArrow[],
    trackName: string,
    background: PngBackground
  ): Promise<void> {
    const blob = await buildTrackPngBlob(fieldWidth, fieldLength, items, arrows, background);
    downloadBlob(blob, pngFilenameFromTrackName(trackName));
  }

  return { exportPng };
}
