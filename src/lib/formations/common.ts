// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import type { ConePoint } from "../../types";

export const PYLON_HEIGHT = 0.5;
// Pylonenfuß: 30 x 30 cm. Alle Streckenmaße (Pylonenabstand, lichte Torbreite) werden laut
// DMSB-Reglement Kante-zu-Kante bzw. an der Innenkante des Fußes gemessen, nicht Mittelpunkt-zu-Mittelpunkt.
// Da die Cone-Koordinaten den Mittelpunkt des Pylonen darstellen, muss der Pylon-Durchmesser
// auf den offiziellen Kantenabstand aufaddiert werden, um den Mittelpunktabstand zu erhalten.
export const PYLON_FOOT_SIZE = 0.30;
export const PYLON_GAP = 0.5; // offizieller Pylonenabstand, Kante zu Kante
export const PYLON_SPACING = PYLON_GAP + PYLON_FOOT_SIZE; // Mittelpunktabstand = 0,80 m
// Breite der Fahrspur eines Karts mit Slick-Reifen (Rennreifen ohne Profil) — das ist die
// schmalste zulaessige Bereifung und damit die engste Spur, fuer die eine Gasse noch befahrbar
// sein muss. Regelbreiten fuer Tore/Gassen bauen auf diesem Mindestmass auf.
export const SLICK_TRACK_WIDTH = 1.25;
// 40 cm Sicherheitszuschlag (20 cm je Seite) auf die Slick-Spurbreite, damit trotz Lenk-
// ungenauigkeit noch genug Luft zu den Pylonen bleibt -> ergibt die vorgeschriebene lichte
// Breite von 1,65 m (Innenkante zu Innenkante) fuer Standard-Tore/Gassen.
export const TASK_LANE_WIDTH = SLICK_TRACK_WIDTH + 0.4; // 1,65 m lichte Breite (Innenkante zu Innenkante)
export const LANE_SPACING = TASK_LANE_WIDTH + PYLON_FOOT_SIZE; // Mittelpunktabstand der Torpylonen = 1,95 m
// Hilfsgroessen fuer Formationen, die nur einen halben bzw. anderthalbfachen Torabstand
// benoetigen (z. B. versetzte Ecken oder Y-Kreuzungen mit asymmetrischen Armen).
export const HALF_LANE_WIDTH = LANE_SPACING / 2;
export const ONE_AND_HALF_LANE_WIDTH = LANE_SPACING * 1.5;

/** Stehender Pylon (Standardfall) an Position (x, y), optional mit Rolle/Ausrichtung. */
export function standing(
  x: number,
  y: number,
  role: ConePoint["role"] = "normal",
  angleDeg = 0
): ConePoint {
  return { x, y, kind: "standing", role, angleDeg };
}

/** Liegender Pylon (z. B. Richtungsdreieck/Fahrtrichtungsanzeige), Standardrolle "direction". */
export function lying(
  x: number,
  y: number,
  role: ConePoint["role"] = "direction",
  angleDeg = 0
): ConePoint {
  return { x, y, kind: "lying", role, angleDeg };
}

/** Lichtschranken-Sensorpunkt (Start/Ziel), rein virtuell — kein physischer Pylon. */
export function sensor(x: number, y: number): ConePoint {
  return { x, y, kind: "sensor" };
}

// Die folgenden Hilfsfunktionen uebersetzen fachliche Streckenmasse (ein Pylonenabstand,
// eine Gassenbreite, ...) in Meter-Koordinaten. Formationen rechnen damit in Regel-Einheiten
// statt mit rohen Meterwerten, sodass sich z. B. ein geaenderter PYLON_SPACING automatisch
// auf alle Formationen auswirkt.
export function meter(value: number) {
  return value;
}

export function pylon(value = 1) {
  return value * PYLON_SPACING;
}

export function pylon_height(value = 1) {
  return value * PYLON_HEIGHT;
}

export function lane(value = 1) {
  return value * LANE_SPACING;
}

export function half_lane(value = 1) {
  return value * HALF_LANE_WIDTH;
}

export function lane_and_half(value = 1) {
  return value * ONE_AND_HALF_LANE_WIDTH;
}

// Turtle-Grafik-artiger Builder: haelt eine "aktuelle Position" (x, y) und haengt bei jedem
// .standing()/.lying()/.sensor()-Aufruf einen Pylon an dieser Stelle an. Die move_*-Methoden
// verschieben die Position relativ um ein Vielfaches einer Regel-Einheit (Meter, Pylonenabstand,
// Gassenbreite, ...), sodass Formationen als Folge von "gehe X weiter, setze Pylon" beschrieben
// werden koennen, statt jede Koordinate von Hand auszurechnen.
export class FormationBuilder {
  private x = 0;
  private y = 0;
  private cones: ConePoint[] = [];

  at(x: number, y: number) {
    this.x = x;
    this.y = y;
    return this;
  }

  move_meter(dx = 0, dy = 0) {
    this.x += meter(dx);
    this.y += meter(dy);
    return this;
  }

  move_pylon(dx = 0, dy = 0) {
    this.x += pylon(dx);
    this.y += pylon(dy);
    return this;
  }

  move_lane(dx = 0, dy = 0) {
    this.x += lane(dx);
    this.y += lane(dy);
    return this;
  }

  move_half_lane(dx = 0, dy = 0) {
    this.x += half_lane(dx);
    this.y += half_lane(dy);
    return this;
  }

  move_pylon_height(dx = 0, dy = 0) {
    this.x += pylon_height(dx);
    this.y += pylon_height(dy);
    return this;
  }

  standing(role: ConePoint["role"] = "normal", angleDeg = 0) {
    this.cones.push(standing(this.x, this.y, role, angleDeg));
    return this;
  }

  lying(angleDeg = 0, role: ConePoint["role"] = "direction") {
    this.cones.push(lying(this.x, this.y, role, angleDeg));
    return this;
  }

  sensor() {
    this.cones.push(sensor(this.x, this.y));
    return this;
  }

  points() {
    return this.cones;
  }
}

/** Startet einen neuen FormationBuilder bei Position (0, 0). */
export function builder() {
  return new FormationBuilder();
}
