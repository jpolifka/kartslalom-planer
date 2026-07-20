// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import React from "react";

// Kleine Überschrift innerhalb einer Karte (card-Style aus editorStyles.ts) —
// einheitliches Sub-Heading für die Abschnitte in LeftSidebar/RightPanel
// ("Streckenbereich", "Formationen", "Eigenschaften", "Kursdauer", "Prüfung").
export default function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, textTransform: "uppercase",
      letterSpacing: "0.06em", color: "#94a3b8", marginBottom: 10,
    }}>
      {children}
    </div>
  );
}
