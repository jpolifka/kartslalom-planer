// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { generateTrackSVG, SVG_WIDTH } from "../../../lib/exportSVG";
import type { PlacedArrow, PlacedFormation } from "../../../types";
import type { PngBackground } from "../types";

// PNG statt direktem SVG-Export: SVG ist ein Vektorformat, das nicht jede
// Zielanwendung (E-Mail-Anhang, Druck-Dialog, Präsentationsfolie) ohne
// Weiteres als Bild einbetten kann. Der einzige Weg im Browser, ein SVG in
// echtes Rasterbildmaterial (PNG) umzuwandeln, führt über ein <canvas>-
// Element: Das SVG wird dazu erst als <img> geladen (loadSvgAsImage) und
// dann mit drawImage() auf das Canvas gezeichnet, aus dem toBlob() den
// finalen PNG-Blob erzeugt.

// 3x der SVG-Basisbreite (900px) ergibt eine für Ausdruck/Archiv taugliche
// Auflösung, ohne dass Cones/Beschriftung im rasterisierten Bild unscharf wirken.
const PNG_SCALE = 3;

// Data-URI statt Object-URL: Das SVG liegt bereits als String vor, ein
// data:-URI kann synchron ohne Blob/URL.createObjectURL()-Revoke-Handling
// erzeugt werden und braucht keinen zusätzlichen Cleanup-Schritt.
function loadSvgAsImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("SVG konnte nicht als Bild geladen werden."));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

// Rendert die Strecke zunächst als SVG (generateTrackSVG, siehe lib/exportSVG)
// und rasterisiert dieses anschließend über ein Canvas zu einem PNG-Blob.
// Wirft, statt still ein leeres/kaputtes Bild zu liefern, aussagekräftige
// Fehler für die beiden bekannten Ausfallstellen: fehlender 2D-Kontext
// (z.B. sehr alte/eingeschränkte Browser) und nicht ladbares SVG-Bild.
export async function buildTrackPngBlob(
  fieldWidth: number,
  fieldLength: number,
  items: PlacedFormation[],
  arrows: PlacedArrow[],
  background: PngBackground
): Promise<Blob> {
  const svg = generateTrackSVG(fieldWidth, fieldLength, items, arrows, null, background);
  const svgHeight = fieldLength * (SVG_WIDTH / fieldWidth);

  const image = await loadSvgAsImage(svg);

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(SVG_WIDTH * PNG_SCALE);
  canvas.height = Math.round(svgHeight * PNG_SCALE);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas-2D-Kontext wird von diesem Browser nicht unterstützt.");

  // Kein fillRect nötig: "weiß" vs. "transparent" wird bereits von
  // generateTrackSVG() über den background-Parameter entschieden (weißes
  // Hintergrundrechteck im SVG bzw. dessen Weglassen).
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("PNG-Erzeugung fehlgeschlagen."));
    }, "image/png");
  });
}

// Whitelist statt Blacklist: entfernt alles außer alphanumerischen Zeichen,
// deutschen Umlauten/ß und Leerzeichen, damit der Streckenname als Dateiname
// auf jedem gängigen Dateisystem (inkl. Windows, das z.B. "/", "<", ">", ":"
// verbietet) gefahrlos verwendbar ist.
export function pngFilenameFromTrackName(trackName: string): string {
  const safeName = trackName.trim().replace(/[^a-zA-Z0-9_\-äöüÄÖÜß ]/g, "").slice(0, 50);
  return safeName ? `kartslalom_${safeName}.png` : "kartslalom.png";
}
