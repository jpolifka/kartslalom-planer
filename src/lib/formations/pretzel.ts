// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import type { FormationDefinition } from "../../types";
import { normalizeCones } from "../geometry";
import { builder } from "./common";

// "Brezel / Knoten / Schwammerl": komplexe Slalom-Figur, bei der sich die Fahrlinie
// mehrfach selbst kreuzt (daher die Namen "Brezel"/"Knoten"). Die Koordinaten stammen laut
// Beschreibung 1:1 aus einer textlichen Aufbauanweisung (keine geometrische Formel wie bei
// z. B. circle.ts) — Aenderungen an dieser Formation sollten daher gegen die urspruengliche
// Bauanleitung geprueft werden statt nur gegen den Code. Der 1,05-fache Pylonenabstand
// (statt 1,0) auf der langen ersten Reihe ergibt eine minimal aufgeweitete Basis-Gerade.
export const pretzel: FormationDefinition = {
  key: "pretzel",
  label: "Brezel / Knoten / Schwammerl",
  description: "Geometrie direkt aus deiner textlichen Aufbauanweisung modelliert.",
  defaultDirection: "none",
  cones: normalizeCones(
    builder()
      .at(0, 0).standing()
      .move_pylon(1.05,0).standing()
      .move_pylon(1.05,0).standing()
      .move_pylon(1.05,0).standing()
      .move_pylon(1.05,0).standing()
      .move_pylon(1.05,0).standing()
      .move_pylon(1.05,0).standing()
      .move_pylon(1.05,0).standing()
      .move_pylon(1.05,0).standing()
      .move_pylon(1.05,0).standing()
      .move_lane(0,1).standing()

      .at(0,0).move_lane(0,1).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,0).standing()
      .move_pylon(1,0.5).standing("normal",45)
      .move_pylon(0.5,1).standing()
      .move_pylon(0,1).standing()
      .move_pylon(0,1).standing()
      .move_lane(1,0).standing()
      .move_pylon(0,-1).standing()
      .move_pylon(0,-1).standing()
      .move_pylon(0.5,-1).standing("normal",45)
      .move_pylon(1,-0.5).standing()
      .move_pylon(1,0).standing()
      
      .points()
  ),
};
