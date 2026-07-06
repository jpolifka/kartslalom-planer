// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { resolveFormation } from "./formationRegistry";
import { boundsFromCones, rotateConesAroundOwnCenter } from "./geometry";
import { lngToGlobalX, latToGlobalY } from "./geo";
import { areaSelectionToBounds } from "./areaSelection";
import type { AreaSelection } from "./areaSelection";
import type { PlacedFormation, PlacedArrow } from "../types";

const PYLON_SIZE_M = 0.30;
const PYLON_MIN_PX = 6;
export const SVG_WIDTH = 900;
const TILE_SIZE = 256;

export type PdfMapConfig = { selection: AreaSelection; satellite: boolean; opacity: number };

const TILE_ATTRIBUTION = {
  satellite: "Esri, Maxar, Earthstar Geographics",
  street: "© OpenStreetMap contributors",
};

// Shared tile-grid math: which tiles cover the field, and how to place them
// in a canvasW x canvasH box (used by both the SVG and the live MapBackground).
function computeTileLayout(mapConfig: PdfMapConfig, canvasW: number, canvasH: number) {
  const { selection, satellite } = mapConfig;
  const θ = (selection.rotationDeg * Math.PI) / 180;
  const cosT = Math.abs(Math.cos(θ));
  const sinT = Math.abs(Math.sin(θ));
  const bgW = canvasW * cosT + canvasH * sinT;
  const bgH = canvasW * sinT + canvasH * cosT;

  const bounds = areaSelectionToBounds(selection);
  const lngSpan = Math.abs(bounds.lng2 - bounds.lng1);
  const zoom = Math.min(19, Math.max(1, Math.round(Math.log2((bgW * 360) / (TILE_SIZE * lngSpan)))));

  const gx1 = lngToGlobalX(bounds.lng1, zoom);
  const gy1 = latToGlobalY(bounds.lat1, zoom);
  const gx2 = lngToGlobalX(bounds.lng2, zoom);
  const gy2 = latToGlobalY(bounds.lat2, zoom);

  const scaleX = bgW / (gx2 - gx1);
  const scaleY = bgH / (gy2 - gy1);
  const n = Math.pow(2, zoom);

  const tiles: { url: string; x: number; y: number; w: number; h: number }[] = [];
  for (let ty = Math.floor(gy1 / TILE_SIZE); ty <= Math.ceil(gy2 / TILE_SIZE); ty++) {
    for (let tx = Math.floor(gx1 / TILE_SIZE); tx <= Math.ceil(gx2 / TILE_SIZE); tx++) {
      const wrappedTx = ((tx % n) + n) % n;
      const url = satellite
        ? `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${ty}/${wrappedTx}`
        : `https://tile.openstreetmap.org/${zoom}/${wrappedTx}/${ty}.png`;
      tiles.push({
        url,
        x: (tx * TILE_SIZE - gx1) * scaleX,
        y: (ty * TILE_SIZE - gy1) * scaleY,
        w: TILE_SIZE * scaleX,
        h: TILE_SIZE * scaleY,
      });
    }
  }

  return {
    tiles,
    bgW,
    bgH,
    left: (canvasW - bgW) / 2,
    top: (canvasH - bgH) / 2,
    attribution: satellite ? TILE_ATTRIBUTION.satellite : TILE_ATTRIBUTION.street,
  };
}

// Renders the satellite/street tiles as SVG <image> elements, clipped to the
// field box and rotated to match the selected area. Used both for the
// standalone SVG export and as the base layer for the vector PDF export.
function buildTileSvg(mapConfig: PdfMapConfig, canvasW: number, canvasH: number): string {
  const { tiles, bgW, bgH, left, top } = computeTileLayout(mapConfig, canvasW, canvasH);

  const imgs = tiles.map(
    (t) =>
      `<image href="${t.url}" crossorigin="anonymous" x="${t.x.toFixed(1)}" y="${t.y.toFixed(1)}"` +
      ` width="${t.w.toFixed(1)}" height="${t.h.toFixed(1)}" preserveAspectRatio="none"/>`
  );

  return (
    `<g opacity="${mapConfig.opacity}" clip-path="url(#mapClip)">` +
    `<g transform="translate(${left.toFixed(1)},${top.toFixed(1)}) rotate(${-mapConfig.selection.rotationDeg},${(bgW / 2).toFixed(1)},${(bgH / 2).toFixed(1)})">` +
    imgs.join("") +
    `</g></g>`
  );
}

function fmt(n: number) {
  return n.toFixed(2);
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
    // Satellite/street tiles as the base layer; grid, border and formations are drawn on top.
    out.push(`<defs><clipPath id="mapClip"><rect width="${SVG_WIDTH}" height="${fmt(svgH)}"/></clipPath></defs>`);
    out.push(buildTileSvg(mapConfig, SVG_WIDTH, svgH));
  } else if (background !== "transparent") {
    out.push(`<rect width="${SVG_WIDTH}" height="${fmt(svgH)}" fill="white"/>`);
  }

  // Grid (1 m cells)
  out.push(`<g stroke="#e2e8f0" stroke-width="1">`);
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
  out.push(`<g stroke="#cbd5e1" stroke-width="1.5">`);
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
      ` fill="#475569">${formation.label}</text>`
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
    const attribution = mapConfig.satellite ? TILE_ATTRIBUTION.satellite : TILE_ATTRIBUTION.street;
    const fontSize = 7;
    const boxW = attribution.length * 4.2 + 8;
    out.push(
      `<rect x="${fmt(SVG_WIDTH - boxW - 4)}" y="${fmt(svgH - 14)}" width="${fmt(boxW)}" height="11" fill="white" fill-opacity="0.75" rx="2"/>` +
      `<text x="${SVG_WIDTH - 8}" y="${fmt(svgH - 6)}" font-family="Arial,sans-serif" font-size="${fontSize}" fill="#1f2937" text-anchor="end">${attribution}</text>`
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

// Renders the track (and, if given, the satellite/street background) as a
// vector PDF and triggers a direct file download via jsPDF — no browser
// print dialog involved.
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
