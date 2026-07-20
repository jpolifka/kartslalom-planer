// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import TrackHelpContent from "./TrackHelpContent";

describe("TrackHelpContent", () => {
  it("rendert alle neun Abschnitte aus den docs/user/*.md-Dateien", () => {
    render(<TrackHelpContent />);

    expect(screen.getByText("1. Erste Schritte")).toBeInTheDocument();
    expect(screen.getByText("2. Strecke bauen")).toBeInTheDocument();
    expect(screen.getByText("3. Prüfen")).toBeInTheDocument();
    expect(screen.getByText("4. Speichern")).toBeInTheDocument();
    expect(screen.getByText("5. Versionen")).toBeInTheDocument();
    expect(screen.getByText("6. Exportieren")).toBeInTheDocument();
    expect(screen.getByText("7. Teilen")).toBeInTheDocument();
    expect(screen.getByText("8. Eigene Formationen")).toBeInTheDocument();
    expect(screen.getByText("9. Konto")).toBeInTheDocument();
  });

  it("rendert Tastaturkürzel als kbd-artige Inline-Elemente", () => {
    render(<TrackHelpContent />);

    expect(screen.getByText("⌘ Z")).toBeInTheDocument();
  });
});
