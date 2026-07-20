// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

export type GeoBounds = {
  lat1: number; lng1: number; // NW corner (top-left, higher lat)
  lat2: number; lng2: number; // SE corner (bottom-right, lower lat)
};

// Standard-"Slippy-Map"-Formeln (Web-Mercator-Kachelpyramide, wie von OSM/
// Leaflet/Google Maps genutzt): 256 ist die Standard-Kachelgröße in Pixeln,
// 2^zoom die Anzahl Kacheln pro Achse auf diesem Zoomlevel. Das Ergebnis ist
// eine globale Pixelkoordinate (nicht Meter!) auf dem jeweiligen Zoomlevel —
// mapRender.ts bildet daraus per Skalierung die Position/Größe einzelner
// Kacheln innerhalb des Export-Canvas.
export function lngToGlobalX(lng: number, zoom: number): number {
  return ((lng + 180) / 360) * 256 * Math.pow(2, zoom);
}

// y invertiert die Mercator-Breite (latRad), weil Bildkoordinaten von oben
// (Nordpol) nach unten (Südpol) zählen, während Breitengrade von unten nach
// oben zunehmen.
export function latToGlobalY(lat: number, zoom: number): number {
  const latRad = (lat * Math.PI) / 180;
  const y = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2;
  return y * 256 * Math.pow(2, zoom);
}

// Umkehrfunktionen zu lngToGlobalX/latToGlobalY — genutzt von MapSelector.tsx,
// um Maus-/Touch-Pixelpositionen auf der interaktiven Karte zurück in
// Lat/Lng umzurechnen (z. B. beim Ziehen der Flächenauswahl).
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

// Großkreisabstand (Haversine) zwischen zwei Lat/Lng-Punkten in Metern —
// exakter als die äquirechteckige Näherung in areaSelection.ts, aber dafür
// nicht in geschlossener Form nach Ost/Nord-Komponenten zerlegbar. Wird daher
// nur für einfache Distanzmessungen (boundsWidthM/Height) genutzt, nicht für
// die Rotationsrechnungen der Flächenauswahl.
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

// Breite entlang der Nordkante (lat1 konstant), Höhe entlang der Westkante
// (lng1 konstant) der Bounds — bei den kleinen, achsenparallelen Boxen dieser
// App (Kartslalom-Feldgröße) sind Nord- und Südkante praktisch gleich lang,
// die Wahl einer bestimmten Kante ist daher unkritisch.
export function boundsWidthM(b: GeoBounds): number {
  return haversineMeters(b.lat1, b.lng1, b.lat1, b.lng2);
}

export function boundsHeightM(b: GeoBounds): number {
  return haversineMeters(b.lat1, b.lng1, b.lat2, b.lng1);
}
