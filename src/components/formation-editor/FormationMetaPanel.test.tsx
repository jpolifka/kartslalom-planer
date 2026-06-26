// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FormationMetaPanel from "./FormationMetaPanel";
import type { EditableCone } from "../../hooks/useFormationEditor";

function cone(id: string, kind: EditableCone["kind"] = "standing"): EditableCone {
  return { id, x: 0, y: 0, kind, angleDeg: 0 };
}

const baseProps = {
  name: "Test",
  description: "",
  category: "individuell" as const,
  durationSeconds: null,
  lichteBreite: null,
  cones: [],
  selectedConeIds: [],
  onChangeName: vi.fn(),
  onChangeDescription: vi.fn(),
  onChangeCategory: vi.fn(),
  onChangeDuration: vi.fn(),
  onChangeLichteBreite: vi.fn(),
  onRotateSelectedCone: vi.fn(),
  onDeleteSelected: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("FormationMetaPanel", () => {
  it("renders name input with current value", () => {
    render(<FormationMetaPanel {...baseProps} name="Mein Hindernis" />);
    expect(screen.getByDisplayValue("Mein Hindernis")).toBeInTheDocument();
  });

  it("shows Pflichtfeld error when name is empty", () => {
    render(<FormationMetaPanel {...baseProps} name="" />);
    expect(screen.getByText("Pflichtfeld")).toBeInTheDocument();
  });

  it("does not show Pflichtfeld error when name has content", () => {
    render(<FormationMetaPanel {...baseProps} name="Gut" />);
    expect(screen.queryByText("Pflichtfeld")).not.toBeInTheDocument();
  });

  it("calls onChangeName on input change", () => {
    render(<FormationMetaPanel {...baseProps} />);
    fireEvent.change(screen.getByDisplayValue("Test"), { target: { value: "Neu" } });
    expect(baseProps.onChangeName).toHaveBeenCalledWith("Neu");
  });

  it("shows pylonCount (standing + lying only, not sensor)", () => {
    const cones = [cone("a", "standing"), cone("b", "lying"), cone("c", "sensor")];
    render(<FormationMetaPanel {...baseProps} cones={cones} />);
    // Pylone badge = 2, Cones gesamt = 3
    const badges = screen.getAllByText(/^\d+$/);
    const values = badges.map((b) => b.textContent);
    expect(values).toContain("2");
    expect(values).toContain("3");
  });

  it("shows lichte Breite warning when below 1.65 m", () => {
    render(<FormationMetaPanel {...baseProps} lichteBreite={1.2} />);
    expect(screen.getByText(/zu schmal/i)).toBeInTheDocument();
  });

  it("does not show warning when lichte Breite is null", () => {
    render(<FormationMetaPanel {...baseProps} lichteBreite={null} />);
    expect(screen.queryByText(/zu schmal/i)).not.toBeInTheDocument();
  });

  it("does not show warning when lichte Breite >= 1.65 m", () => {
    render(<FormationMetaPanel {...baseProps} lichteBreite={1.65} />);
    expect(screen.queryByText(/zu schmal/i)).not.toBeInTheDocument();
  });

  it("hides selected cone section when nothing is selected", () => {
    const cones = [cone("a")];
    render(<FormationMetaPanel {...baseProps} cones={cones} selectedConeIds={[]} />);
    expect(screen.queryByText("Ausgewählte Pylone")).not.toBeInTheDocument();
  });

  it("shows selected cone section when exactly one cone is selected", () => {
    const cones = [cone("a")];
    render(<FormationMetaPanel {...baseProps} cones={cones} selectedConeIds={["a"]} />);
    expect(screen.getByText("Ausgewählte Pylone")).toBeInTheDocument();
  });

  it("shows delete button when cones are selected", () => {
    const cones = [cone("a"), cone("b")];
    render(<FormationMetaPanel {...baseProps} cones={cones} selectedConeIds={["a", "b"]} />);
    expect(screen.getByText(/Löschen \(2\)/)).toBeInTheDocument();
  });

  it("calls onDeleteSelected when delete button clicked", () => {
    const cones = [cone("a")];
    render(<FormationMetaPanel {...baseProps} cones={cones} selectedConeIds={["a"]} />);
    fireEvent.click(screen.getByText(/Löschen/));
    expect(baseProps.onDeleteSelected).toHaveBeenCalledOnce();
  });

  it("calls onRotateSelectedCone when angle preset clicked", () => {
    const cones = [cone("a", "standing")];
    render(<FormationMetaPanel {...baseProps} cones={cones} selectedConeIds={["a"]} />);
    fireEvent.click(screen.getByText("90°"));
    expect(baseProps.onRotateSelectedCone).toHaveBeenCalledWith(90);
  });

  it("calls onChangeCategory when select changes", () => {
    render(<FormationMetaPanel {...baseProps} />);
    fireEvent.change(screen.getByDisplayValue("Individuell"), { target: { value: "basis" } });
    expect(baseProps.onChangeCategory).toHaveBeenCalledWith("basis");
  });
});
