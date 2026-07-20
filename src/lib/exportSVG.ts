// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { resolveFormation } from "./formationRegistry";
import { boundsFromCones, rotateConesAroundOwnCenter } from "./geometry";
import { computeMapRenderLayout } from "./mapRender";
import { MAP_PROVIDERS } from "./mapProviders";
import { supabase, functionsUrl } from "./supabase";
import type { AreaSelection } from "./areaSelection";
import type { MapProviderId } from "./mapProviders";
import type { PlacedFormation, PlacedArrow } from "../types";

const PYLON_SIZE_M = 0.30;
const PYLON_MIN_PX = 6;
export const SVG_WIDTH = 900;
const GUEST_FETCH_TIMEOUT_MS = 10_000;
const GUEST_MAX_IMAGE_BYTES = 15 * 1024 * 1024;

export type PdfMapConfig = {
  selection: AreaSelection;
  providerId: MapProviderId;
  opacity: number;
  // Vorab (async, siehe resolveWmsExportImage) aufgelöste Bilddaten für
  // WMS-Provider — als data:-URI, damit der Export nicht von der
  // Live-Erreichbarkeit des WMS-Diensts abhängt. Wenn nicht gesetzt, wird
  // (Gast-Modus ohne Session) direkt auf die WMS-URL zurückgefallen.
  wmsImageDataUri?: string;
};

// Löst für einen WMS-Provider (z. B. RLP-DOP20) das Bild vorab auf und
// liefert es als data:-URI zurück — der Export bettet dann kein von der
// Live-Erreichbarkeit des WMS-Diensts abhängiges <image href> mehr ein. Für
// "xyz"-Provider (OSM) wird null zurückgegeben; buildTileSvg fällt dann auf
// die direkte Tile-URL zurück (identisch zum bisherigen Verhalten).
//
// Mit aktiver Session läuft die Auflösung über den map-background-image-
// Edge-Function-Proxy (JWT/Tier/BBOX-geprüft, siehe
// supabase/functions/map-background-image). Ohne Session (Gast-Modus, kein
// Proxy-Aufruf möglich, da der Proxy Auth verlangt) holt der Browser das Bild
// direkt vom RLP-WMS-Dienst — der Dienst sendet
// `Access-Control-Allow-Origin: *`, ein direkter Fetch ist also möglich (per
// curl gegen den echten Dienst verifiziert, 2026-07-08).
//
// Best-Effort, kein Garant: Schlägt der direkte Fetch fehl (Timeout,
// Netzwerkfehler, ungültiger Content-Type, zu große Antwort, CORS-Änderung
// beim Anbieter), fällt der Export auf die rohe Bild-URL zurück statt ganz zu
// scheitern. Das eingebettete SVG ist dann NICHT garantiert self-contained
// und kann eine externe WMS-Referenz enthalten, die von der Live-
// Erreichbarkeit des Diensts abhängt — bewusste Produktentscheidung
// (Best-Effort-Einbettung statt Export-Abbruch für Gäste).
export async function resolveWmsExportImage(
  mapConfig: PdfMapConfig,
  fieldWidth: number,
  fieldLength: number
): Promise<string | null> {
  const provider = MAP_PROVIDERS[mapConfig.providerId];
  if (provider.kind !== "wms") return null;

  const svgH = fieldLength * (SVG_WIDTH / fieldWidth);
  const layout = computeMapRenderLayout(
    { selection: mapConfig.selection, providerId: mapConfig.providerId, opacity: mapConfig.opacity },
    SVG_WIDTH,
    svgH
  );
  if (layout.kind !== "wms") return null;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GUEST_FETCH_TIMEOUT_MS);
    try {
      const directRes = await fetch(layout.imageUrl, { signal: controller.signal });
      if (!directRes.ok) return layout.imageUrl;
      const contentType = directRes.headers.get("content-type") ?? "";
      if (!contentType.startsWith("image/")) return layout.imageUrl;
      const blob = await directRes.blob();
      if (blob.size > GUEST_MAX_IMAGE_BYTES) return layout.imageUrl;
      return await blobToDataUri(blob);
    } catch {
      return layout.imageUrl;
    } finally {
      clearTimeout(timeout);
    }
  }

  const res = await fetch(functionsUrl("map-background-image"), {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ providerId: layout.providerId, bbox: layout.bbox, width: layout.bgW, height: layout.bgH }),
  });
  if (!res.ok) throw new Error(`Kartenhintergrund-Export fehlgeschlagen (${res.status})`);
  const blob = await res.blob();
  return await blobToDataUri(blob);
}

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Kartenhintergrund konnte nicht gelesen werden."));
    reader.readAsDataURL(blob);
  });
}

// Rendert den Kartenhintergrund als SVG <image>-Element(e), geclippt auf die
// Feldbox und passend zum ausgewählten Bereich rotiert. Genutzt sowohl für
// den eigenständigen SVG-Export als auch als Basis-Layer für den PDF-Export.
// Layout-Geometrie (Kachel-Grid vs. WMS-Einzelbild) kommt aus mapRender.ts,
// das sich der Editor (MapBackground.tsx) genauso bedient.
function buildTileSvg(mapConfig: PdfMapConfig, canvasW: number, canvasH: number): string {
  const layout = computeMapRenderLayout(
    { selection: mapConfig.selection, providerId: mapConfig.providerId, opacity: mapConfig.opacity },
    canvasW,
    canvasH
  );

  const imgs =
    layout.kind === "xyz"
      ? layout.tiles.map(
          (t) =>
            `<image href="${t.url}" crossorigin="anonymous" x="${t.x.toFixed(1)}" y="${t.y.toFixed(1)}"` +
            ` width="${t.w.toFixed(1)}" height="${t.h.toFixed(1)}" preserveAspectRatio="none"/>`
        )
      : [
          `<image href="${mapConfig.wmsImageDataUri ?? layout.imageUrl}" crossorigin="anonymous" x="0" y="0"` +
            ` width="${layout.bgW.toFixed(1)}" height="${layout.bgH.toFixed(1)}" preserveAspectRatio="none"/>`,
        ];

  // Die Kacheln/das WMS-Bild werden für eine unrotierte, überdimensionierte
  // Box (layout.bgW/bgH, siehe computeBackgroundBox in mapRender.ts) geladen,
  // die groß genug ist, um nach dem Zurückdrehen die tatsächliche
  // (schmalere) Feldbox vollständig abzudecken. rotate(-rotationDeg, ...) um
  // den Mittelpunkt dieser Box macht genau diese Drehung rückgängig: das
  // SVG-rotate() dreht mathematisch gegen den Uhrzeigersinn bei positivem
  // Winkel, während selection.rotationDeg "im Uhrzeigersinn" definiert ist
  // (siehe areaSelection.ts) — das negative Vorzeichen gleicht das aus, damit
  // Kartenausschnitt und Feld/Formationen (die dieselbe Rotation über ihre
  // eigene Geometrie abbilden) übereinstimmend ausgerichtet erscheinen. Die
  // äußere clipPath-Rect (id="mapClip", Feldgröße) schneidet anschließend den
  // überstehenden Rand der Box wieder ab.
  return (
    `<g opacity="${mapConfig.opacity}" clip-path="url(#mapClip)">` +
    `<g transform="translate(${layout.left.toFixed(1)},${layout.top.toFixed(1)}) rotate(${-mapConfig.selection.rotationDeg},${(layout.bgW / 2).toFixed(1)},${(layout.bgH / 2).toFixed(1)})">` +
    imgs.join("") +
    `</g></g>`
  );
}

function fmt(n: number) {
  return n.toFixed(2);
}

// Formation-Labels (customSnapshot.label) stammen aus freier Nutzereingabe im
// Editor und landen unescaped als SVG-Text — ohne dies bricht ein Label wie
// `</text><image href=x onerror=...>` aus dem <text>-Element aus (Stored-
// Injection ins heruntergeladene SVG bzw. den innerHTML-PDF-Container).
function escapeXml(value: string): string {
  // .replace(regex, ...) statt .replaceAll(string, ...): Projekt-Target ist
  // ES2020, String.replaceAll() ist erst ab ES2021 typisiert (tsc-Fehler
  // TS2550). Reihenfolge bleibt wichtig: "&" zuerst, sonst würden die "&" aus
  // den nachfolgenden Ersetzungen (z. B. "&lt;") selbst nochmal escaped.
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function arrowHeadPoints(
  ex: number, ey: number,
  cpx: number, cpy: number,
  size: number
): string {
  const a = Math.atan2(ey - cpy, ex - cpx);
  const spread = 0.55;
  return [
    `${fmt(ex)},${fmt(ey)}`,
    `${fmt(ex - size * Math.cos(a - spread))},${fmt(ey - size * Math.sin(a - spread))}`,
    `${fmt(ex - size * Math.cos(a + spread))},${fmt(ey - size * Math.sin(a + spread))}`,
  ].join(" ");
}

export function generateTrackSVG(
  fieldWidth: number,
  fieldLength: number,
  items: PlacedFormation[],
  arrows: PlacedArrow[],
  mapConfig?: PdfMapConfig | null,
  background: "white" | "transparent" = "white"
): string {
  const scale = SVG_WIDTH / fieldWidth;
  const svgH = fieldLength * scale;
  const pylonPx = Math.max(PYLON_MIN_PX, PYLON_SIZE_M * scale);
  const arrowHeadSize = Math.max(10, pylonPx * 0.9);

  const out: string[] = [];

  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"` +
    ` width="${SVG_WIDTH}" height="${fmt(svgH)}"` +
    ` viewBox="0 0 ${SVG_WIDTH} ${fmt(svgH)}">`
  );

  if (mapConfig) {
    // Kartenhintergrund als Basis-Layer; Gitter, Rand und Formationen liegen darüber.
    out.push(`<defs><clipPath id="mapClip"><rect width="${SVG_WIDTH}" height="${fmt(svgH)}"/></clipPath></defs>`);
    out.push(buildTileSvg(mapConfig, SVG_WIDTH, svgH));
  } else if (background !== "transparent") {
    out.push(`<rect width="${SVG_WIDTH}" height="${fmt(svgH)}" fill="white"/>`);
  }

  // Gitter/Rand/Beschriftung nur bei "weißem" Export (SVG/PDF): bei
  // background="transparent" (PNG) erwartet der Nutzer ein sauberes Overlay
  // aus nur Strecke/Pylonen, kein Referenzraster (siehe PNG-Export-Doku).
  if (background !== "transparent") {
    // Opacity analog zur interaktiven Ansicht (TrackCanvas.tsx-Gitterlayer:
    // 0.35 ohne Kartenhintergrund, 0.15 mit) — vorher fest bei voller
    // Deckkraft gezeichnet, dadurch im Export deutlich dominanter als am
    // Bildschirm ("Raster zu stark").
    const gridOpacity = mapConfig ? 0.15 : 0.35;

    // Grid (1 m cells)
    out.push(`<g stroke="#e2e8f0" stroke-width="1" opacity="${gridOpacity}">`);
    for (let x = 1; x < Math.ceil(fieldWidth); x++) {
      const px = fmt(x * scale);
      out.push(`<line x1="${px}" y1="0" x2="${px}" y2="${fmt(svgH)}"/>`);
    }
    for (let y = 1; y < Math.ceil(fieldLength); y++) {
      const py = fmt(y * scale);
      out.push(`<line x1="0" y1="${py}" x2="${SVG_WIDTH}" y2="${py}"/>`);
    }
    out.push(`</g>`);

    // 5 m accent lines
    out.push(`<g stroke="#cbd5e1" stroke-width="1.5" opacity="${gridOpacity}">`);
    for (let x = 5; x < fieldWidth; x += 5) {
      const px = fmt(x * scale);
      out.push(`<line x1="${px}" y1="0" x2="${px}" y2="${fmt(svgH)}"/>`);
    }
    for (let y = 5; y < fieldLength; y += 5) {
      const py = fmt(y * scale);
      out.push(`<line x1="0" y1="${py}" x2="${SVG_WIDTH}" y2="${py}"/>`);
    }
    out.push(`</g>`);

    // Outer border
    out.push(`<rect width="${SVG_WIDTH}" height="${fmt(svgH)}" fill="none" stroke="#0f172a" stroke-width="3"/>`);

    // Ruler labels along top and left edges
    out.push(`<g font-family="Arial,sans-serif" font-size="${Math.max(9, scale * 0.28)}" fill="#64748b">`);
    for (let x = 0; x <= Math.floor(fieldWidth); x += (fieldWidth > 30 ? 5 : 2)) {
      if (x === 0) continue;
      out.push(`<text x="${fmt(x * scale + 2)}" y="${Math.max(9, scale * 0.28)}">${x}m</text>`);
    }
    for (let y = 0; y <= Math.floor(fieldLength); y += (fieldLength > 30 ? 5 : 2)) {
      if (y === 0) continue;
      out.push(`<text x="3" y="${fmt(y * scale - 2)}">${y}m</text>`);
    }
    out.push(`</g>`);
  }

  // Formations
  for (const item of items) {
    const formation = resolveFormation(item);

    // Pre-rotate cones mathematically (same approach as TrackCanvas) to avoid rotation bbox bugs
    const src = formation.cones;
    const cones = item.rotationDeg !== 0 && src.length > 0
      ? rotateConesAroundOwnCenter(src, item.rotationDeg)
      : src;
    const fallbackCones = cones.length > 0 ? cones : [{ x: 0, y: 0, kind: "standing" as const }];
    const bounds = boundsFromCones(fallbackCones);
    // Verschiebt die (bereits rotierten) Cones so, dass die Bounding-Box bei
    // (0.4, 0.4) statt (0, 0) beginnt — der kleine Versatz reserviert Platz
    // für das Formations-Label (siehe unten, "text x=3 y=-3" relativ zu
    // diesem <g>), das sonst über den Rand der Pylonen hinaus in
    // Nachbarformationen ragen könnte. item.x/item.y (gx/gy) verschieben die
    // so normalisierte Formation anschließend an ihre eigentliche
    // Platzierungsposition auf dem Feld.
    const normalized = cones.map((c) => ({
      ...c,
      x: c.x - bounds.minX + 0.4,
      y: c.y - bounds.minY + 0.4,
    }));

    const gx = fmt(item.x * scale);
    const gy = fmt(item.y * scale);

    out.push(`<g transform="translate(${gx},${gy})">`);

    // Start / Finish lines
    const visibleForLines = normalized.filter((c) => c.kind !== "sensor");
    if (visibleForLines.length > 0) {
      const minCY = Math.min(...visibleForLines.map((c) => c.y)) * scale;
      const maxCY = Math.max(...visibleForLines.map((c) => c.y)) * scale;
      const minCX = Math.min(...visibleForLines.map((c) => c.x)) * scale;
      const maxCX = Math.max(...visibleForLines.map((c) => c.x)) * scale;
      if (formation.hasStartLine) {
        out.push(
          `<line x1="${fmt(minCX - pylonPx)}" y1="${fmt(minCY)}"` +
          ` x2="${fmt(maxCX + pylonPx)}" y2="${fmt(minCY)}"` +
          ` stroke="#0f172a" stroke-width="3"/>`
        );
      }
      if (formation.hasFinishLine) {
        out.push(
          `<line x1="${fmt(minCX - pylonPx)}" y1="${fmt(maxCY)}"` +
          ` x2="${fmt(maxCX + pylonPx)}" y2="${fmt(maxCY)}"` +
          ` stroke="#0f172a" stroke-width="3"/>`
        );
      }
    }

    // Cones
    for (const cone of normalized) {
      const cpx = cone.x * scale;
      const cpy = cone.y * scale;

      if (cone.kind === "sensor") {
        out.push(`<circle cx="${fmt(cpx)}" cy="${fmt(cpy)}" r="${fmt(pylonPx * 0.7)}" fill="#0f172a"/>`);
      } else if (cone.kind === "lying") {
        const r = pylonPx;
        const angleDeg = (cone.angleDeg ?? 0);
        out.push(
          `<polygon` +
          ` points="${fmt(cpx)},${fmt(cpy - r)} ${fmt(cpx - r * 0.6)},${fmt(cpy + r * 0.5)} ${fmt(cpx + r * 0.6)},${fmt(cpy + r * 0.5)}"` +
          ` fill="#334155"` +
          ` transform="rotate(${angleDeg},${fmt(cpx)},${fmt(cpy)})"/>`
        );
      } else {
        // Standing pylon: correct size (pylonPx, not pylonPx*2)
        const angleDeg = (cone.angleDeg ?? 0);
        out.push(
          `<rect` +
          ` x="${fmt(cpx - pylonPx / 2)}" y="${fmt(cpy - pylonPx / 2)}"` +
          ` width="${fmt(pylonPx)}" height="${fmt(pylonPx)}"` +
          ` rx="2" fill="#f97316" stroke="#9a3412" stroke-width="1"` +
          (angleDeg ? ` transform="rotate(${angleDeg},${fmt(cpx)},${fmt(cpy)})"` : "") +
          `/>`
        );
      }
    }

    // Label
    const labelSize = Math.max(9, scale * 0.26);
    out.push(
      `<text x="3" y="-3"` +
      ` font-family="Arial,sans-serif" font-size="${labelSize}"` +
      ` fill="#475569">${escapeXml(formation.label)}</text>`
    );

    out.push(`</g>`);
  }

  // Arrows (bezier)
  for (const a of arrows) {
    const sx = a.startX * scale, sy = a.startY * scale;
    const ex = a.endX * scale, ey = a.endY * scale;
    const cpx = a.cpX * scale, cpy = a.cpY * scale;
    const d = `M ${fmt(sx)} ${fmt(sy)} Q ${fmt(cpx)} ${fmt(cpy)} ${fmt(ex)} ${fmt(ey)}`;
    out.push(`<path d="${d}" fill="none" stroke="#334155" stroke-width="3"/>`);
    out.push(`<polygon points="${arrowHeadPoints(ex, ey, cpx, cpy, arrowHeadSize)}" fill="#334155"/>`);
  }

  if (mapConfig) {
    const attribution = MAP_PROVIDERS[mapConfig.providerId].attribution;
    const fontSize = 7;
    const boxW = attribution.length * 4.2 + 8;
    out.push(
      `<rect x="${fmt(SVG_WIDTH - boxW - 4)}" y="${fmt(svgH - 14)}" width="${fmt(boxW)}" height="11" fill="white" fill-opacity="0.75" rx="2"/>` +
      `<text x="${SVG_WIDTH - 8}" y="${fmt(svgH - 6)}" font-family="Arial,sans-serif" font-size="${fontSize}" fill="#1f2937" text-anchor="end">${escapeXml(attribution)}</text>`
    );
  }

  out.push(`</svg>`);
  return out.join("\n");
}

export function downloadSVG(svg: string, filename = "kartslalom.svg") {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Rendert die Strecke (und, falls angegeben, den Kartenhintergrund) als
// ECHTEN Vektor-PDF-Export via jsPDF + svg2pdf.js und stößt direkt einen
// Datei-Download an — kein Browser-Druckdialog, kein Rasterisieren zu PNG
// zwischendurch. Pylone, Linien und Text bleiben im PDF als Vektorobjekte
// (skalierbar, durchsuchbar/kopierbar bei Text) statt als Pixelraster.
//
// Technischer Ablauf:
// 1. generateTrackSVG() baut denselben SVG-String wie der reine SVG-Export.
// 2. Das SVG wird per innerHTML in einen <div> geschrieben und ins DOM
//    gehängt (position: fixed, weit außerhalb des sichtbaren Viewports statt
//    z. B. display:none) — svg2pdf.js braucht ein tatsächlich vom Browser
//    gelayoutetes/gestyltes Element, um computed styles (z. B. vererbte
//    font-family) korrekt auszulesen; ein nicht gerendertes (display:none
//    oder gar nicht angehängtes) Element liefert dafür keine verwertbaren
//    Werte. "position: fixed; left: -99999px" hält es dennoch layoutet, aber
//    für den Nutzer unsichtbar (kein sichtbares Aufblitzen).
// 3. jsPDF erzeugt ein A4-Querformat-Dokument, zeichnet Titel-/Maßangaben-
//    Header manuell (Text/Linie), und berechnet danach die verfügbare
//    Zeichenfläche (areaW × areaH) unterhalb des Headers, abzüglich Rand
//    (margin) auf allen Seiten.
// 4. fitScale = das kleinere der beiden Verhältnisse (areaW/SVG_WIDTH,
//    areaH/svgH) — das SVG wird proportional (kein Verzerren) so weit
//    skaliert, wie es in areaW × areaH hineinpasst ("contain"-Verhalten,
//    analog zu CSS object-fit: contain); offsetX zentriert das Ergebnis
//    horizontal in der verbleibenden Breite.
// 5. doc.svg() (aus svg2pdf.js) übersetzt das DOM-SVG-Element direkt in
//    PDF-Vektorbefehle an der berechneten Position/Größe.
// 6. Der Container wird im finally-Block wieder aus dem DOM entfernt —
//    unabhängig davon, ob die PDF-Erzeugung erfolgreich war oder warf.
export async function exportPDF(
  fieldWidth: number,
  fieldLength: number,
  items: PlacedFormation[],
  arrows: PlacedArrow[],
  mapConfig?: PdfMapConfig | null,
  filename = "kartslalom-streckenplan.pdf"
): Promise<void> {
  const svg = generateTrackSVG(fieldWidth, fieldLength, items, arrows, mapConfig);
  const svgH = fieldLength * (SVG_WIDTH / fieldWidth);

  // svg2pdf.js needs the source element attached to the document to resolve
  // computed styles; keep it off-screen so nothing flashes on screen.
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-99999px";
  container.style.top = "0";
  container.innerHTML = svg;
  document.body.appendChild(container);
  const svgEl = container.firstElementChild as unknown as SVGSVGElement;

  try {
    const { jsPDF } = await import("jspdf");
    await import("svg2pdf.js");

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const margin = 10;
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const headerH = 10;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text("Kartslalom Streckenplan", margin, margin + 5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`${fieldWidth.toFixed(1)} m × ${fieldLength.toFixed(1)} m`, pageW - margin, margin + 5, { align: "right" });

    doc.setDrawColor(226, 232, 240);
    doc.line(margin, margin + 7, pageW - margin, margin + 7);

    const areaTop = margin + headerH;
    const areaW = pageW - margin * 2;
    const areaH = pageH - areaTop - margin;
    const fitScale = Math.min(areaW / SVG_WIDTH, areaH / svgH);
    const renderW = SVG_WIDTH * fitScale;
    const renderH = svgH * fitScale;
    const offsetX = margin + (areaW - renderW) / 2;

    await doc.svg(svgEl, { x: offsetX, y: areaTop, width: renderW, height: renderH });

    doc.save(filename);
  } finally {
    document.body.removeChild(container);
  }
}
