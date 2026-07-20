// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { buildTrackPngBlob, pngFilenameFromTrackName } from "../api/renderTrackPng";
import type { PngBackground } from "../types";
import type { PlacedArrow, PlacedFormation } from "../../../types";

// Browser bieten keine direkte "Blob speichern"-API — der etablierte Weg ist
// ein unsichtbarer <a download>-Link, der programmatisch geklickt wird. Das
// Element muss kurz im DOM hängen (manche Browser ignorieren click() auf
// nicht angehängten Elementen), wird danach aber sofort wieder entfernt.
// Die Object-URL wird ebenfalls direkt widerrufen, da der Download durch den
// synchronen click() bereits angestoßen ist und die URL nicht mehr gebraucht wird.
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

// Bewusst kein eigener Lade-/Fehlerzustand: der Hook ist ein dünner Wrapper
// um buildTrackPngBlob()/downloadBlob(), Fehler werden an die aufrufende
// Stelle durchgereicht (await/try-catch dort). Das Pro-Tarif-Gating für den
// PNG-Export ("free" darf nicht exportieren) sitzt bewusst NICHT hier,
// sondern rein clientseitig in der aufrufenden Seite (EditorPage/Toolbar via
// useTier().canExportPng) — es gibt keinen serverseitigen Schutz, da PNG-
// Export anders als Share-Links keine RPC/Backend-Ressource beansprucht.
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
