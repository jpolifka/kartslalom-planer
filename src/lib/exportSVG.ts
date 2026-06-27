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
const SVG_WIDTH = 900;
const TILE_SIZE = 256;

// A4 landscape, 10mm margins → printable area
const MM_TO_PX = 3.779527559;
const PAGE_W_PX = 277 * MM_TO_PX;  // ~1047px
const PAGE_H_PX = 190 * MM_TO_PX;  // ~718px
const HEADER_H_PX = 26;

type PdfMapConfig = { selection: AreaSelection; satellite: boolean; opacity: number };

function buildTileHtml(mapConfig: PdfMapConfig, canvasW: number, canvasH: number): string {
  const { selection, satellite, opacity } = mapConfig;
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

  const imgs: string[] = [];
  for (let ty = Math.floor(gy1 / TILE_SIZE); ty <= Math.ceil(gy2 / TILE_SIZE); ty++) {
    for (let tx = Math.floor(gx1 / TILE_SIZE); tx <= Math.ceil(gx2 / TILE_SIZE); tx++) {
      const wrappedTx = ((tx % n) + n) % n;
      const url = satellite
        ? `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${ty}/${wrappedTx}`
        : `https://tile.openstreetmap.org/${zoom}/${wrappedTx}/${ty}.png`;
      const left = (tx * TILE_SIZE - gx1) * scaleX;
      const top = (ty * TILE_SIZE - gy1) * scaleY;
      const w = TILE_SIZE * scaleX;
      const h = TILE_SIZE * scaleY;
      imgs.push(`<img src="${url}" alt="" style="position:absolute;left:${left.toFixed(1)}px;top:${top.toFixed(1)}px;width:${w.toFixed(1)}px;height:${h.toFixed(1)}px">`);
    }
  }

  const left = ((canvasW - bgW) / 2).toFixed(1);
  const top = ((canvasH - bgH) / 2).toFixed(1);

  return (
    `<div style="position:absolute;inset:0;opacity:${opacity};pointer-events:none;overflow:hidden;">` +
    `<div style="position:absolute;left:${left}px;top:${top}px;width:${bgW.toFixed(1)}px;height:${bgH.toFixed(1)}px;transform:rotate(${-selection.rotationDeg}deg);transform-origin:50% 50%;overflow:hidden;">` +
    imgs.join("") +
    `</div></div>`
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
  arrows: PlacedArrow[]
): string {
  const scale = SVG_WIDTH / fieldWidth;
  const svgH = fieldLength * scale;
  const pylonPx = Math.max(PYLON_MIN_PX, PYLON_SIZE_M * scale);
  const arrowHeadSize = Math.max(10, pylonPx * 0.9);

  const out: string[] = [];

  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg"` +
    ` width="${SVG_WIDTH}" height="${fmt(svgH)}"` +
    ` viewBox="0 0 ${SVG_WIDTH} ${fmt(svgH)}">`
  );

  // White background
  out.push(`<rect width="${SVG_WIDTH}" height="${fmt(svgH)}" fill="white"/>`);

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

export function printAsPDF(
  svg: string,
  fieldWidth: number,
  fieldLength: number,
  mapConfig?: PdfMapConfig | null
) {
  const svgH = fieldLength * (SVG_WIDTH / fieldWidth);
  const trackAreaH = PAGE_H_PX - HEADER_H_PX;
  const scale = Math.min(PAGE_W_PX / SVG_WIDTH, trackAreaH / svgH);

  const dim = `${fieldWidth.toFixed(1)} m × ${fieldLength.toFixed(1)} m`;

  // Remove white background from SVG so satellite tiles show through
  const printSvg = mapConfig
    ? svg.replace('fill="white"', 'fill="none"')
    : svg;

  const tileHtml = mapConfig ? buildTileHtml(mapConfig, SVG_WIDTH, svgH) : "";
  const attribution = mapConfig?.satellite
    ? "Esri, Maxar, Earthstar Geographics"
    : mapConfig
    ? "© OpenStreetMap contributors"
    : "";

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <title>Kartslalom Streckenplan</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; background: white; overflow: hidden; }
    .page { width: ${PAGE_W_PX.toFixed(0)}px; height: ${PAGE_H_PX.toFixed(0)}px; position: relative; overflow: hidden; }
    .hdr { height: ${HEADER_H_PX}px; display: flex; align-items: flex-end; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; }
    h1 { font-size: 12pt; color: #0f172a; }
    .meta { font-size: 9pt; color: #64748b; }
    .track { position: absolute; top: ${HEADER_H_PX}px; left: 0; overflow: hidden; }
    .wrapper { position: relative; width: ${SVG_WIDTH}px; height: ${svgH.toFixed(0)}px; transform-origin: top left; transform: scale(${scale.toFixed(6)}); }
    .wrapper svg { position: absolute; top: 0; left: 0; }
  </style>
</head>
<body>
  <div class="page">
    <div class="hdr">
      <h1>Kartslalom Streckenplan</h1>
      <span class="meta">${dim}</span>
    </div>
    <div class="track">
      <div class="wrapper">
        ${tileHtml}
        ${printSvg}
        ${attribution ? `<div style="position:absolute;bottom:4px;right:6px;font-size:8px;color:rgba(0,0,0,0.55);background:rgba(255,255,255,0.7);padding:1px 5px;border-radius:3px;">${attribution}</div>` : ""}
      </div>
    </div>
  </div>
  <script>
    var imgs = document.querySelectorAll('img');
    if (!imgs.length) {
      setTimeout(function() { window.print(); }, 200);
    } else {
      var n = 0;
      function done() { if (++n >= imgs.length) setTimeout(function() { window.print(); }, 200); }
      imgs.forEach(function(img) { img.complete ? done() : (img.onload = done, img.onerror = done); });
    }
  </script>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}
