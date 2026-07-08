// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

export type GeoBounds = {
  lat1: number; lng1: number; // NW corner (top-left, higher lat)
  lat2: number; lng2: number; // SE corner (bottom-right, lower lat)
};

export function lngToGlobalX(lng: number, zoom: number): number {
  return ((lng + 180) / 360) * 256 * Math.pow(2, zoom);
}

export function latToGlobalY(lat: number, zoom: number): number {
  const latRad = (lat * Math.PI) / 180;
  const y = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2;
  return y * 256 * Math.pow(2, zoom);
}

export function globalXToLng(x: number, zoom: number): number {
  return (x / (256 * Math.pow(2, zoom))) * 360 - 180;
}

export function globalYToLat(y: number, zoom: number): number {
  const n = Math.PI - (2 * Math.PI * y) / (256 * Math.pow(2, zoom));
  return (Math.atan(Math.sinh(n)) * 180) / Math.PI;
}

// EPSG:3857 (Web Mercator, Meter) — für WMS-GetMap-BBOX-Parameter (RLP-DOP20).
// Standardformeln, R = WGS84-Ellipsoid-Radius wie von Web-Mercator angenommen.
const WEB_MERCATOR_R = 6378137;

export function lngToMercatorX(lng: number): number {
  return (lng * Math.PI * WEB_MERCATOR_R) / 180;
}

export function latToMercatorY(lat: number): number {
  return Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * WEB_MERCATOR_R;
}

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function boundsWidthM(b: GeoBounds): number {
  return haversineMeters(b.lat1, b.lng1, b.lat1, b.lng2);
}

export function boundsHeightM(b: GeoBounds): number {
  return haversineMeters(b.lat1, b.lng1, b.lat2, b.lng1);
}
