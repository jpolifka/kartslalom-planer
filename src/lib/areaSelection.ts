// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import type { GeoBounds } from "./geo";

export type AreaSelection = {
  centerLat: number;
  centerLng: number;
  widthM: number;
  heightM: number;
  rotationDeg: number; // clockwise from north
};

// Project polygon points onto rotated axes and compute bounding rectangle
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

  const widthM = Math.max(1, maxR - minR);
  const heightM = Math.max(1, maxU - minU);
  const rCenter = (minR + maxR) / 2;
  const uCenter = (minU + maxU) / 2;

  // Inverse rotation to get adjusted centroid
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

// Axis-aligned envelope of the rotated rectangle — used for tile fetching
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

// Four corners of the selection rectangle in geo-coords (for SVG overlay)
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
