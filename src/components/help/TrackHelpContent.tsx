// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import MarkdownSections from "./MarkdownSections";
import s01 from "../../../docs/user/01-erste-schritte.md?raw";
import s02 from "../../../docs/user/02-strecke-bauen.md?raw";
import s03 from "../../../docs/user/03-pruefen.md?raw";
import s04 from "../../../docs/user/04-speichern.md?raw";
import s05 from "../../../docs/user/05-versionen.md?raw";
import s06 from "../../../docs/user/06-exportieren.md?raw";
import s07 from "../../../docs/user/07-teilen.md?raw";
import s08 from "../../../docs/user/08-eigene-formationen.md?raw";
import s09 from "../../../docs/user/09-konto.md?raw";

const SECTIONS = [s01, s02, s03, s04, s05, s06, s07, s08, s09];

export default function TrackHelpContent() {
  return (
    <div>
      <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.6, marginTop: 4 }}>
        Mit dem Kartslalom Streckenplaner entwirfst du Pylonen-Strecken, prüfst sie
        gegen grundlegende Regeln und exportierst sie als Plan zum Aufbau auf der
        Strecke.
      </p>
      <MarkdownSections sections={SECTIONS} />
    </div>
  );
}
