// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import React from "react";
import { HelpSection } from "../../../components/ImprintContent";

export default function HelpContent() {
  const kbd: React.CSSProperties = {
    display: "inline-block", border: "1px solid #cbd5e1", borderBottom: "2px solid #cbd5e1",
    borderRadius: 5, padding: "1px 6px", fontSize: 12, fontFamily: "monospace",
    background: "#f8fafc", color: "#334155",
  };
  return (
    <div>
      <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.6, marginTop: 4 }}>
        Mit dem Kartslalom Streckenplaner entwirfst du Pylonen-Strecken, prüfst sie
        gegen grundlegende Regeln und exportierst sie als Plan zum Aufbau auf der
        Strecke. Alle Eingaben bleiben lokal in diesem Browser gespeichert — es wird
        nichts an einen Server übertragen.
      </p>

      <HelpSection title="1. Streckenbereich festlegen">
        Wähle entweder über <strong>„Bereich auf Karte wählen"</strong> einen
        rechteckigen Ausschnitt auf der Karte aus — du kannst ihn dort
        verschieben, in der Größe anpassen und drehen — oder gib links unter
        „Streckenbereich" Breite und Länge in Metern manuell ein (Mindestgröße 8 m).
        Über das Kartensymbol in der Werkzeugleiste kannst du den Ausschnitt jederzeit
        neu wählen. Links unter „Kartenhintergrund" wechselst du zwischen
        Straßenkarte und Luftbild (Rheinland-Pfalz, Pro-Tarif) und passt die
        Transparenz an.
      </HelpSection>

      <HelpSection title="2. Formationen platzieren">
        Klicke links in der Palette auf eine Formation, um sie auf der Fläche
        einzufügen. Formationen mit Drehrichtung (z. B. Kurven) besitzen ein kleines
        Drehsymbol — darüber lässt sich eine Rotationsvariante (0°/90°/180°/270°)
        direkt beim Einfügen wählen. Formationen sind nach Kategorien gruppiert
        (Start/Ziel, Basis, Kurven, Komplex) und lassen sich per Klick auf den
        Gruppentitel ein- und ausklappen.
      </HelpSection>

      <HelpSection title="3. Formationen bearbeiten">
        Ziehe eine Formation mit der Maus, um sie zu verschieben. Mit{" "}
        <strong>Shift+Klick</strong> wählst du mehrere Formationen gleichzeitig aus
        und kannst sie gemeinsam verschieben oder löschen. Bei einer einzelnen
        Auswahl zeigt das Feld „Eigenschaften" rechts Position (X/Y), Drehwinkel und
        die <strong>Durchfahrzeit</strong> der Formation — Letztere lässt sich pro
        Formation überschreiben und mit dem Rückgängig-Symbol wieder auf den
        Standardwert zurücksetzen.
      </HelpSection>

      <HelpSection title="4. Pfeile zeichnen">
        Wechsle über das Stift-Symbol in den Pfeil-Modus und ziehe einen Pfeil auf
        die Fläche, um die Fahrtrichtung zu markieren. Ein ausgewählter Pfeil zeigt
        drei Punkte: den <strong>orangen Punkt</strong> zum Krümmen sowie zwei{" "}
        <strong>weiße Punkte</strong> zum Verschieben von Start und Ende.
      </HelpSection>

      <HelpSection title="5. Prüfung & Hinweise">
        Der Bereich „Prüfung" zeigt automatisch Fehler (rot) und Hinweise (gelb) an —
        z. B. wenn Formationen über den Rand hinausragen, zu nah aneinander oder zu
        weit auseinander stehen, die Strecke in getrennte Bereiche zerfällt oder ein
        Vorstartbereich bzw. eine Wechselzone fehlt. Ein Klick auf eine Meldung
        markiert die betroffene Formation auf der Fläche.
      </HelpSection>

      <HelpSection title="6. Kursdauer">
        Unter „Kursdauer" siehst du die geschätzte Gesamt-Durchfahrzeit deiner
        Strecke (Summe der Durchfahrzeiten aller platzierten Formationen) als
        Richtwert in Sekunden und Minuten.
      </HelpSection>

      <HelpSection title="7. Speichern, Zurücksetzen, Importieren/Exportieren">
        Deine Strecke wird automatisch im Browser gespeichert (Anzeige
        „Gespeichert" in der Werkzeugleiste) und beim nächsten Besuch
        wiederhergestellt. Über die Symbole in der Werkzeugleiste kannst du die
        Strecke zusätzlich als <strong>SVG</strong> herunterladen, als{" "}
        <strong>PDF</strong> drucken (öffnet den Druckdialog des Browsers) oder als{" "}
        <strong>JSON-Datei</strong> sichern bzw. wieder <strong>laden</strong> — z. B.
        um sie auf einem anderen Gerät weiterzubearbeiten oder mit anderen zu teilen.
        Über „Neu" setzt du die Strecke zurück und löschst den gespeicherten Stand
        (mit Sicherheitsabfrage).
      </HelpSection>

      <HelpSection title="8. Tastaturkürzel">
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 14px", alignItems: "center", marginTop: 4 }}>
          <span><span style={kbd}>⌘ Z</span> / <span style={kbd}>Strg Z</span></span>
          <span>Rückgängig</span>
          <span><span style={kbd}>⌘ ⇧ Z</span> / <span style={kbd}>Strg Y</span></span>
          <span>Wiederherstellen</span>
          <span><span style={kbd}>Esc</span></span>
          <span>Zurück in den Auswahl-Modus</span>
          <span><span style={kbd}>Entf</span> / <span style={kbd}>⌫</span></span>
          <span>Auswahl löschen (Formation oder Pfeil)</span>
          <span><span style={kbd}>⇧</span> + Klick</span>
          <span>Mehrfachauswahl von Formationen</span>
        </div>
      </HelpSection>

      <HelpSection title="9. Mobile Bedienung">
        Auf schmalen Bildschirmen wird die Ansicht einspaltig dargestellt. Über die
        Schaltflächen <strong>„Formationen"</strong> und <strong>„Eigenschaften"</strong>{" "}
        in der Werkzeugleiste blendest du die jeweiligen Bereiche als seitliche
        Schublade ein und aus.
      </HelpSection>
    </div>
  );
}
