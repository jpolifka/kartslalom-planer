// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import BasisAuswahl from "./BasisAuswahl";

// Mock hooks mit Supabase-Abhängigkeit — isoliert BasisAuswahl vollständig.
// Da `session` hier immer null ist, wird der Modus "own" (eigenes Hindernis
// duplizieren) nie angezeigt/getestet — der Button dafür erscheint in der
// Komponente nur bei vorhandener Session. Diese Suite deckt also gezielt nur
// "empty" und "standard" ab.
vi.mock("../../hooks/useCustomFormations", () => ({
  useCustomFormationList: () => ({ data: undefined }),
}));
vi.mock("../../store/authStore", () => ({
  useAuthStore: () => ({ session: null }),
}));

const onConfirm = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BasisAuswahl", () => {
  it("renders the dialog with both mode options", () => {
    render(<BasisAuswahl onConfirm={onConfirm} />);
    expect(screen.getByText("Leer starten")).toBeInTheDocument();
    expect(screen.getByText("Standard-Formation")).toBeInTheDocument();
  });

  it("defaults to 'Leer starten' mode with Starten enabled", () => {
    render(<BasisAuswahl onConfirm={onConfirm} />);
    expect(screen.getByRole("button", { name: "Starten" })).not.toBeDisabled();
  });

  it("calls onConfirm with empty snap when confirming in empty mode", () => {
    render(<BasisAuswahl onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole("button", { name: "Starten" }));
    expect(onConfirm).toHaveBeenCalledWith({ cones: [], arrows: [] });
  });

  it("shows formation list after switching to 'Standard-Formation' mode", () => {
    render(<BasisAuswahl onConfirm={onConfirm} />);
    fireEvent.click(screen.getByText("Standard-Formation"));
    expect(screen.getByText("Formation auswählen")).toBeInTheDocument();
  });

  it("disables Starten when no formation selected in standard mode", () => {
    render(<BasisAuswahl onConfirm={onConfirm} />);
    fireEvent.click(screen.getByText("Standard-Formation"));
    expect(screen.getByRole("button", { name: "Starten" })).toBeDisabled();
  });

  it("enables Starten after selecting a formation", () => {
    render(<BasisAuswahl onConfirm={onConfirm} />);
    fireEvent.click(screen.getByText("Standard-Formation"));
    const firstFormation = screen.getAllByText(/Cones/)[0].parentElement!;
    fireEvent.click(firstFormation);
    expect(screen.getByRole("button", { name: "Starten" })).not.toBeDisabled();
  });

  it("calls onConfirm with cones and sourceKey when confirming with standard formation", () => {
    render(<BasisAuswahl onConfirm={onConfirm} />);
    fireEvent.click(screen.getByText("Standard-Formation"));
    const firstFormation = screen.getAllByText(/Cones/)[0].parentElement!;
    fireEvent.click(firstFormation);
    fireEvent.click(screen.getByRole("button", { name: "Starten" }));
    expect(onConfirm).toHaveBeenCalledOnce();
    const [snap, sourceKey] = onConfirm.mock.calls[0];
    expect(snap.cones.length).toBeGreaterThan(0);
    expect(snap.arrows).toEqual([]);
    expect(typeof sourceKey).toBe("string");
  });

  it("switching back to empty mode re-enables Starten without selection", () => {
    render(<BasisAuswahl onConfirm={onConfirm} />);
    fireEvent.click(screen.getByText("Standard-Formation"));
    fireEvent.click(screen.getByText("Leer starten"));
    expect(screen.getByRole("button", { name: "Starten" })).not.toBeDisabled();
  });
});
