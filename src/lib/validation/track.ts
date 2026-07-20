// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.
//
// Rekonstruiert anhand der Cone-Positionen einen groben, angenommenen Fahrfluss
// (welche Formation kommt in welcher Reihenfolge dran) und prüft Streckenregeln,
// die sich nicht rein geometrisch pro Formation entscheiden lassen — u. a. ob
// Vorstartbereich/Wechselzone (laut Regelwerk Pflicht) vorhanden sind, ob die
// Strecke in getrennte Bereiche zerfällt oder ob Aufgaben zu weit/zu nah
// aufeinanderfolgen (siehe docs/validierung.md). Ergänzt geometry.ts, das nur
// einzelne Formationen isoliert betrachtet.

import { resolveFormation } from "../formationRegistry";
import type { ValidationContext, ValidationIssue } from "./types";

// Geometrischer Mittelpunkt einer Formation (Durchschnitt aller Cone-Positionen,
// relativ zur platzierten Position) — dient als vereinfachter "Aufenthaltsort"
// der Formation für Abstands- und Reihenfolge-Berechnungen weiter unten.
function centerOfItem(item: ValidationContext["items"][number]) {
  const formation = resolveFormation(item);

  if (formation.cones.length === 0) {
    return { x: item.x, y: item.y };
  }

  const avgX = formation.cones.reduce((sum, cone) => sum + cone.x, 0) / formation.cones.length;
  const avgY = formation.cones.reduce((sum, cone) => sum + cone.y, 0) / formation.cones.length;

  return {
    x: item.x + avgX,
    y: item.y + avgY,
  };
}

function distance(ax: number, ay: number, bx: number, by: number) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

// Gruppiert Aufgaben-Mittelpunkte per einfacher Flood-Fill-artiger Suche in
// zusammenhängende Cluster: zwei Knoten gehören zur selben Komponente, wenn
// eine Kette von Nachbarn mit Abstand <= threshold zwischen ihnen existiert.
// Mehr als eine Komponente bedeutet, die Strecke zerfällt in voneinander
// getrennte Aufgabenbereiche — vermutlich kein durchgängiger Fahrfluss möglich.
function buildConnectedComponents(
  nodes: Array<{ id: string; x: number; y: number }>,
  threshold: number
) {
  const visited = new Set<string>();
  const components: string[][] = [];

  for (const node of nodes) {
    if (visited.has(node.id)) continue;

    const stack = [node];
    const component: string[] = [];
    visited.add(node.id);

    while (stack.length > 0) {
      const current = stack.pop()!;
      component.push(current.id);

      for (const candidate of nodes) {
        if (visited.has(candidate.id)) continue;
        if (distance(current.x, current.y, candidate.x, candidate.y) <= threshold) {
          visited.add(candidate.id);
          stack.push(candidate);
        }
      }
    }

    components.push(component);
  }

  return components;
}

// Schätzt eine plausible Fahrreihenfolge der Aufgaben per "nearest neighbour"
// Greedy-Heuristik (startend links-oben, dann immer zur jeweils nächsten
// unbesuchten Aufgabe) — keine exakte Streckenplanung, sondern nur eine grobe
// Annäherung, um ungewöhnlich große Sprünge zwischen aufeinanderfolgenden
// Aufgaben zu erkennen (track-long-jump unten).
function orderTrackGreedy(nodes: Array<{ id: string; x: number; y: number }>) {
  if (nodes.length <= 1) return nodes;

  const sorted = [...nodes].sort((a, b) => {
    if (a.x !== b.x) return a.x - b.x;
    return a.y - b.y;
  });

  const ordered = [sorted[0]];
  const remaining = sorted.slice(1);

  while (remaining.length > 0) {
    const last = ordered[ordered.length - 1];
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      const d = distance(last.x, last.y, candidate.x, candidate.y);
      if (d < bestDistance) {
        bestDistance = d;
        bestIndex = i;
      }
    }

    ordered.push(remaining.splice(bestIndex, 1)[0]);
  }

  return ordered;
}

// Kürzester Pylon-zu-Pylon-Abstand von einer Formation zu jeder anderen
// Formation auf der Fläche — Grundlage für die "zu nah"/"zu weit"-Prüfungen
// unten (im Unterschied zu centerOfItem/orderTrackGreedy, die mit
// Mittelpunkten statt einzelnen Pylonen rechnen).
function nearestFormationGap(
  formationId: string,
  worldCones: ValidationContext["worldCones"]
) {
  const ownCones = worldCones.filter((cone) => cone.formationId === formationId);
  const otherFormationIds = [...new Set(worldCones.map((cone) => cone.formationId).filter((id) => id !== formationId))];

  let nearest = Number.POSITIVE_INFINITY;
  let nearestFormationId: string | null = null;

  for (const otherFormationId of otherFormationIds) {
    const otherCones = worldCones.filter((cone) => cone.formationId === otherFormationId);
    let localNearest = Number.POSITIVE_INFINITY;

    for (const a of ownCones) {
      for (const b of otherCones) {
        const d = distance(a.x, a.y, b.x, b.y);
        if (d < localNearest) {
          localNearest = d;
        }
      }
    }

    if (localNearest < nearest) {
      nearest = localNearest;
      nearestFormationId = otherFormationId;
    }
  }

  return {
    nearest,
    nearestFormationId,
  };
}

export function validateTrack(ctx: ValidationContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Pfeile sind reine Richtungsmarkierungen, keine fahrerisch zu bewältigenden
  // Aufgaben — für Fahrfluss-/Abstandsprüfungen zählen nur echte Formationen.
  const tasks = ctx.items.filter((item) => !resolveFormation(item).arrow);

  if (tasks.length === 0) {
    issues.push({
      id: "empty-track",
      severity: "warning",
      scope: "track",
      message: "Es sind noch keine Hindernisse auf der Flaeche platziert.",
    });
    return issues;
  }

  // Vorstartbereich/Wechselzone sind Warte-/Übergabezonen, keine fahrerisch zu
  // durchfahrenden Aufgaben mit Abstandsvorgaben zu Nachbar-Formationen — daher
  // von den Abstands-/Reihenfolge-Prüfungen unten ausgenommen (eigene Pflicht-
  // Prüfung weiter unten: track-missing-vorstartbereich/-wechselzone).
  const ZONE_KEYS = new Set(["vorstartbereich", "wechselzone"]);
  const distanceTasks = tasks.filter((item) => !ZONE_KEYS.has(item.key));

  const taskCenters = distanceTasks.map((item) => ({
    id: item.id,
    item,
    center: centerOfItem(item),
  }));

  // Abstand zur jeweils nächstgelegenen anderen Formation: < 0.5 m gilt als
  // "praktisch aufeinanderstehend" (Fahrer könnte die Aufgaben nicht sauber
  // trennen), > 10 m als "zu weit auseinander" für einen zusammenhängenden
  // Slalom-Fahrfluss auf typischer Feldgröße. Beides nur "warning": geometrisch
  // zulässig, aber fahrerisch/planerisch fragwürdig — kein hartes Regelmaß.
  for (const task of taskCenters) {
    const { nearest } = nearestFormationGap(task.id, ctx.worldCones);

    if (nearest !== Number.POSITIVE_INFINITY && nearest < 0.5) {
      issues.push({
        id: `track-too-close-${task.id}`,
        severity: "warning",
        scope: "track",
        formationId: task.item.id,
        formationKey: task.item.key,
        message: "Pylonen verschiedener Formationen stehen fast aufeinander.",
        details: `Naechste Pylone nur ${nearest.toFixed(2)} m entfernt.`,
      });
    }

    if (nearest !== Number.POSITIVE_INFINITY && nearest > 10) {
      issues.push({
        id: `track-too-far-${task.id}`,
        severity: "warning",
        scope: "track",
        formationId: task.item.id,
        formationKey: task.item.key,
        message: "Zwei Hindernisse liegen zu weit auseinander.",
        details: `Kuerzester geometrischer Abstand ${nearest.toFixed(2)} m, erlaubt sind hoechstens 10.00 m.`,
      });
    }
  }

  // Selber 10 m-Schwellwert wie oben, aber auf Formations-MITTELPUNKTE statt
  // einzelner Pylonen angewendet, um zusammenhängende Cluster zu bilden — bewusst
  // eine gröbere, globale Sicht auf die ganze Strecke statt paarweiser Abstände.
  const components = buildConnectedComponents(
    taskCenters.map((task) => ({ id: task.id, x: task.center.x, y: task.center.y })),
    10
  );

  if (components.length > 1) {
    issues.push({
      id: "track-components",
      severity: "warning",
      scope: "track",
      message: "Die Strecke zerfaellt in mehrere voneinander getrennte Aufgabenbereiche.",
      details: `${components.length} getrennte Bereiche erkannt.`,
    });
  }

  // Höherer Schwellwert (14 m statt 10 m) als bei track-too-far: hier geht es
  // nicht um den Abstand zur nächsten Formation generell, sondern speziell um
  // den Sprung zwischen zwei in der geschätzten Fahrreihenfolge AUFEINANDERFOLGENDEN
  // Aufgaben — bewusst toleranter, da orderTrackGreedy nur eine grobe Schätzung ist
  // und nicht jeder große Abstand zwischen Nachbarn in der Reihenfolge ein Problem sein muss.
  const ordered = orderTrackGreedy(taskCenters.map((task) => ({ id: task.id, x: task.center.x, y: task.center.y })));

  for (let i = 0; i < ordered.length - 1; i++) {
    const a = ordered[i];
    const b = ordered[i + 1];
    const d = distance(a.x, a.y, b.x, b.y);

    if (d > 14) {
      issues.push({
        id: `track-long-jump-${a.id}-${b.id}`,
        severity: "warning",
        scope: "track",
        message: "Im angenommenen Fahrfluss liegt ein sehr grosser Sprung zwischen zwei Aufgaben.",
        details: `Geschaetzter Sprung ${d.toFixed(2)} m.`,
      });
    }
  }

  // Ein klar erkennbarer Start-/Zielbereich liegt entweder an einer expliziten
  // startGate/finishLane-Formation, oder zumindest eine Aufgabe steht nahe am
  // Rand der Fläche (< 2 m). Fehlt beides, ist es nur ein unverbindlicher Hinweis
  // ("info"), kein Fehler — reine Plausibilitätsvermutung, keine belastbare Regel.
  const edgeMargin = 2;
  const edgeRelated = taskCenters.filter(({ center }) => {
    return (
      center.x <= edgeMargin ||
      center.y <= edgeMargin ||
      center.x >= ctx.fieldWidth - edgeMargin ||
      center.y >= ctx.fieldLength - edgeMargin
    );
  });

  const hasExplicitStartFinish = ctx.items.some(
    (item) => item.key === "startGate" || item.key === "finishLane"
  );

  if (!hasExplicitStartFinish && edgeRelated.length === 0) {
    issues.push({
      id: "track-no-edge-anchor",
      severity: "info",
      scope: "track",
      message: "Es ist kein klarer Start- oder Zielbereich am Rand der Flaeche erkennbar.",
    });
  }

  // Laut Regelwerk zwingend vorgeschriebene Zonen (jeweils 3×3 m) — Vorstartbereich
  // zum Warten vor dem Start, Wechselzone für den Fahrerwechsel. Trotz "zwingend
  // erforderlich" nur "warning" statt "error": eine unvollständig geplante Strecke
  // soll sich weiterhin speichern/exportieren lassen, die Meldung ist ein Hinweis
  // zur Nacharbeit, kein hartes Validierungs-Gate.
  const hasVorstart = ctx.items.some((item) => item.key === "vorstartbereich");
  if (!hasVorstart) {
    issues.push({
      id: "track-missing-vorstartbereich",
      severity: "warning",
      scope: "track",
      message: "Kein Vorstartbereich auf der Strecke vorhanden.",
      details: "Ein Vorstartbereich (3×3 m) ist zwingend erforderlich.",
    });
  }

  const hasWechselzone = ctx.items.some((item) => item.key === "wechselzone");
  if (!hasWechselzone) {
    issues.push({
      id: "track-missing-wechselzone",
      severity: "warning",
      scope: "track",
      message: "Keine Wechselzone auf der Strecke vorhanden.",
      details: "Eine Wechselzone (3×3 m) ist zwingend erforderlich.",
    });
  }

  return issues;
}
