// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import FormationHelpContent from "./FormationHelpContent";

describe("FormationHelpContent", () => {
  it("rendert alle acht Abschnitte aus den docs/user/formation-editor/*.md-Dateien", () => {
    render(<FormationHelpContent />);

    expect(screen.getByText("1. Neues Hindernis starten")).toBeInTheDocument();
    expect(screen.getByText("2. Pylone platzieren")).toBeInTheDocument();
    expect(screen.getByText("3. Pfeile zeichnen")).toBeInTheDocument();
    expect(screen.getByText("4. Breite messen")).toBeInTheDocument();
    expect(screen.getByText("5. Hilfslinien")).toBeInTheDocument();
    expect(screen.getByText("6. Mehrfachauswahl und Drehen")).toBeInTheDocument();
    expect(screen.getByText("7. Speichern und Metadaten")).toBeInTheDocument();
    expect(screen.getByText("8. Tastaturkürzel")).toBeInTheDocument();
  });

  it("rendert Tastaturkürzel als kbd-artige Inline-Elemente", () => {
    render(<FormationHelpContent />);

    expect(screen.getByText("⌘ A")).toBeInTheDocument();
  });
});
