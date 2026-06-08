import { getFormation } from "./formationRegistry";
import { boundsFromCones, rotateConesAroundOwnCenter } from "./geometry";
import type { PlacedFormation, PlacedArrow } from "../types";

const PYLON_SIZE_M = 0.30;
const PYLON_MIN_PX = 6;
const SVG_WIDTH = 900;

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
    const formation = getFormation(item.key);

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
  fieldLength: number
) {
  const dim = `${fieldWidth.toFixed(1)} m × ${fieldLength.toFixed(1)} m`;
  const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <title>Kartslalom Streckenplan</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; font-family: Arial, sans-serif; background: white; }
    header { width: 100%; display: flex; justify-content: space-between; align-items: baseline; padding-bottom: 6px; border-bottom: 1px solid #e2e8f0; margin-bottom: 10px; }
    h1 { font-size: 14pt; color: #0f172a; }
    .meta { font-size: 10pt; color: #64748b; }
    svg { max-width: 100%; max-height: calc(100vh - 60px); display: block; }
    @media print { header { display: flex !important; } }
  </style>
</head>
<body>
  <header>
    <h1>Kartslalom Streckenplan</h1>
    <span class="meta">${dim}</span>
  </header>
  ${svg}
  <script>window.addEventListener("load", () => setTimeout(() => window.print(), 300));</script>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}
