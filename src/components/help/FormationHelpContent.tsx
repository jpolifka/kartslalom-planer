// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import MarkdownSections from "./MarkdownSections";
import s01 from "../../../docs/user/formation-editor/01-start.md?raw";
import s02 from "../../../docs/user/formation-editor/02-pylone-platzieren.md?raw";
import s03 from "../../../docs/user/formation-editor/03-pfeile.md?raw";
import s04 from "../../../docs/user/formation-editor/04-breite-messen.md?raw";
import s05 from "../../../docs/user/formation-editor/05-hilfslinien.md?raw";
import s06 from "../../../docs/user/formation-editor/06-mehrfachauswahl-und-drehen.md?raw";
import s07 from "../../../docs/user/formation-editor/07-speichern-und-metadaten.md?raw";
import s08 from "../../../docs/user/formation-editor/08-tastaturkuerzel.md?raw";

const SECTIONS = [s01, s02, s03, s04, s05, s06, s07, s08];

export default function FormationHelpContent() {
  return (
    <div>
      <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.6, marginTop: 4 }}>
        Im Formation-Editor entwirfst du eigene Pylonen-Hindernisse, die du danach
        wie eingebaute Formationen in deinen Strecken verwenden kannst.
      </p>
      <MarkdownSections sections={SECTIONS} />
    </div>
  );
}
