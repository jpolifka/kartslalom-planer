// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import type { GeoBounds } from "./geo";

// Alle drei Funktionen unten rechnen intern in einem lokalen, ebenen
// Metern-Koordinatensystem um den jeweiligen Mittelpunkt (r = Ost-Achse,
// u = Nord-Achse), NICHT in echten Lat/Lng-Winkelgraden — auf Kartslalom-
// Feldgrößen (Meter- bis niedriger Zweistelliger-Meter-Bereich) ist die
// Erdkrümmung vernachlässigbar, daher genügt die einfache äquirechteckige
// Näherung "1° Breite = 111320 m, 1° Länge = 111320 m * cos(lat)" statt einer
// echten Kartenprojektion. rotationDeg ist "im Uhrzeigersinn ab Nord" (wie im
// Feld-Editor gedreht wird); die Rotationsmatrix (cosT/sinT) unten ist deshalb
// im Uhrzeigersinn, nicht die mathematisch übliche Gegenuhrzeigersinn-Matrix.
export type AreaSelection = {
  centerLat: number;
  centerLng: number;
  widthM: number;
  heightM: number;
  rotationDeg: number; // clockwise from north
};

// Bildet die (ggf. schräg gezeichneten) Polygonpunkte auf die um rotationDeg
// gedrehten Achsen ab (r = Breiten-Achse, u = Höhen-Achse der gewünschten
// Auswahl) und nimmt dort die achsenparallele Bounding-Box — das liefert die
// kleinste Rotated-Rectangle-Umhüllende mit genau dieser Rotation, nicht nur
// die achsenparallele Umhüllende des Originalpolygons. Der Schwerpunkt der
// rotierten Box (rCenter/uCenter) wird anschließend zurückrotiert, weil er im
// Allgemeinen nicht mit dem ursprünglichen Punkt-Schwerpunkt (centLat/centLng)
// übereinstimmt.
export function polygonToAreaSelection(
  points: Array<{ lat: number; lng: number }>,
  rotationDeg: number
): AreaSelection {
  const centLat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const centLng = points.reduce((s, p) => s + p.lng, 0) / points.length;

  const θ = (rotationDeg * Math.PI) / 180;
  const cosT = Math.cos(θ);
  const sinT = Math.sin(θ);
  const cosLat = Math.cos((centLat * Math.PI) / 180);

  const projs = points.map((p) => {
    const dE = (p.lng - centLng) * 111320 * cosLat;
    const dN = (p.lat - centLat) * 111320;
    return { r: dE * cosT - dN * sinT, u: dE * sinT + dN * cosT };
  });

  const minR = Math.min(...projs.map((p) => p.r));
  const maxR = Math.max(...projs.map((p) => p.r));
  const minU = Math.min(...projs.map((p) => p.u));
  const maxU = Math.max(...projs.map((p) => p.u));

  // Math.max(1, ...): entartete Eingaben (z. B. nur 1-2 Punkte oder alle
  // Punkte kollinear) sollen eine minimale, aber gültige (>0) Feldgröße
  // ergeben statt einer 0×0-Auswahl, mit der der Editor nichts anfangen kann.
  const widthM = Math.max(1, maxR - minR);
  const heightM = Math.max(1, maxU - minU);
  const rCenter = (minR + maxR) / 2;
  const uCenter = (minU + maxU) / 2;

  // Inverse Rotation (gleicher Winkel, aber r/u vertauscht angewendet), um den
  // Box-Mittelpunkt aus dem rotierten (r,u)-Raum zurück in den ursprünglichen
  // (Ost,Nord)-Raum zu übersetzen.
  const dE = rCenter * cosT + uCenter * sinT;
  const dN = uCenter * cosT - rCenter * sinT;

  return {
    centerLat: centLat + dN / 111320,
    centerLng: centLng + dE / (111320 * cosLat),
    widthM,
    heightM,
    rotationDeg,
  };
}

// Achsenparallele Umhüllende (Envelope) des rotierten Auswahl-Rechtecks —
// wird gebraucht, weil sowohl XYZ-Kachel-Dienste (OSM) als auch WMS-GetMap
// (RLP-DOP20) nur achsenparallele BBoxen abfragen können; die eigentliche
// Rotation wird erst beim Rendern per CSS-/SVG-rotate() auf das so geladene
// (größere) Rechteck angewendet, siehe computeBackgroundBox() in mapRender.ts.
// Klassische Rotated-Rect-AABB-Formel: envW/envH sind die Projektionen der
// beiden Rechteckseiten auf die Welt-Achsen, aufsummiert per |cos|/|sin|.
export function areaSelectionToBounds(a: AreaSelection): GeoBounds {
  const θ = (a.rotationDeg * Math.PI) / 180;
  const envW = a.widthM * Math.abs(Math.cos(θ)) + a.heightM * Math.abs(Math.sin(θ));
  const envH = a.widthM * Math.abs(Math.sin(θ)) + a.heightM * Math.abs(Math.cos(θ));
  const cosLat = Math.cos((a.centerLat * Math.PI) / 180);
  return {
    lat1: a.centerLat + envH / 2 / 111320,
    lng1: a.centerLng - envW / 2 / (111320 * cosLat),
    lat2: a.centerLat - envH / 2 / 111320,
    lng2: a.centerLng + envW / 2 / (111320 * cosLat),
  };
}

// Die vier Ecken des Auswahl-Rechtecks in Lat/Lng (für die SVG-Vorschau der
// Auswahl auf der Karte). Reihenfolge: oben-links, oben-rechts, unten-rechts,
// unten-links im lokalen (r,u)-Rahmen vor der Rotation — nach Anwendung von
// rotationDeg ergibt das ein geschlossenes Viereck in der tatsächlich
// gewünschten Ausrichtung.
export function selectionCorners(sel: AreaSelection): Array<{ lat: number; lng: number }> {
  const θ = (sel.rotationDeg * Math.PI) / 180;
  const cosT = Math.cos(θ);
  const sinT = Math.sin(θ);
  const halfW = sel.widthM / 2;
  const halfH = sel.heightM / 2;
  const cosLat = Math.cos((sel.centerLat * Math.PI) / 180);

  return (
    [
      [-halfW, halfH],
      [halfW, halfH],
      [halfW, -halfH],
      [-halfW, -halfH],
    ] as [number, number][]
  ).map(([r, u]) => ({
    lat: sel.centerLat + (u * cosT - r * sinT) / 111320,
    lng: sel.centerLng + (r * cosT + u * sinT) / (111320 * cosLat),
  }));
}
