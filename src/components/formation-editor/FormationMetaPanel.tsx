// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import type { EditableCone } from "../../hooks/useFormationEditor";
import type { FormationCategory } from "../../types";

const CATEGORIES: { value: FormationCategory; label: string }[] = [
  { value: "individuell", label: "Individuell" },
  { value: "basis", label: "Basis" },
  { value: "kurven", label: "Kurven" },
  { value: "komplex", label: "Komplex" },
  { value: "start_ziel", label: "Start / Ziel" },
];

type Props = {
  name: string;
  description: string;
  category: FormationCategory;
  durationSeconds: number | null;
  lichteBreite: number | null;
  cones: EditableCone[];
  selectedConeIds: string[];
  onChangeName: (v: string) => void;
  onChangeDescription: (v: string) => void;
  onChangeCategory: (v: FormationCategory) => void;
  onChangeDuration: (v: number | null) => void;
  onChangeLichteBreite: (v: number | null) => void;
  onRotateSelectedCone: (angleDeg: number) => void;
  onDeleteSelected: () => void;
};

const s: Record<string, React.CSSProperties> = {
  panel: { display: "flex", flexDirection: "column", gap: 16, padding: 16, width: 240, background: "white", borderLeft: "1px solid #e5e7eb", overflowY: "auto" },
  label: { display: "block", fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 4 },
  input: { width: "100%", padding: "6px 8px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, boxSizing: "border-box" as const },
  row: { display: "flex", gap: 8, alignItems: "center" },
  badge: { fontSize: 12, fontWeight: 600, color: "#374151", background: "#f3f4f6", borderRadius: 4, padding: "2px 8px" },
  section: { borderTop: "1px solid #f3f4f6", paddingTop: 12 },
  btn: { flex: 1, padding: "6px 0", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer", background: "white" },
  btnDanger: { flex: 1, padding: "6px 0", fontSize: 13, border: "1px solid #fca5a5", borderRadius: 6, cursor: "pointer", background: "#fef2f2", color: "#dc2626" },
};

const pylonCount = (cones: EditableCone[]) =>
  cones.filter((c) => c.kind === "standing" || c.kind === "lying").length;

export default function FormationMetaPanel({
  name, description, category, durationSeconds, lichteBreite,
  cones, selectedConeIds,
  onChangeName, onChangeDescription, onChangeCategory,
  onChangeDuration, onChangeLichteBreite,
  onRotateSelectedCone, onDeleteSelected,
}: Props) {
  const selectedCone = selectedConeIds.length === 1
    ? cones.find((c) => c.id === selectedConeIds[0])
    : null;

  return (
    <div style={s.panel}>
      <div>
        <label style={s.label}>Name *</label>
        <input
          style={{ ...s.input, borderColor: name.trim() ? "#d1d5db" : "#ef4444" }}
          value={name}
          onChange={(e) => onChangeName(e.target.value)}
          placeholder="Name der Formation"
          maxLength={80}
        />
        {!name.trim() && <span style={{ fontSize: 11, color: "#ef4444" }}>Pflichtfeld</span>}
      </div>

      <div>
        <label style={s.label}>Beschreibung</label>
        <textarea
          style={{ ...s.input, resize: "vertical", minHeight: 56 }}
          value={description}
          onChange={(e) => onChangeDescription(e.target.value)}
          rows={2}
        />
      </div>

      <div>
        <label style={s.label}>Kategorie</label>
        <select
          style={s.input}
          value={category}
          onChange={(e) => onChangeCategory(e.target.value as FormationCategory)}
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      <div style={s.row}>
        <div>
          <label style={s.label}>Pylone</label>
          <span style={s.badge}>{pylonCount(cones)}</span>
        </div>
        <div>
          <label style={s.label}>Cones gesamt</label>
          <span style={s.badge}>{cones.length}</span>
        </div>
      </div>

      <div>
        <label style={s.label}>Dauer (Sek.)</label>
        <input
          style={s.input}
          type="number"
          min={0}
          step={0.5}
          value={durationSeconds ?? ""}
          onChange={(e) => onChangeDuration(e.target.value === "" ? null : Number(e.target.value))}
          placeholder="—"
        />
      </div>

      <div>
        <label style={s.label}>Lichte Breite (m)</label>
        <input
          style={s.input}
          type="number"
          min={0}
          step={0.05}
          value={lichteBreite ?? ""}
          onChange={(e) => onChangeLichteBreite(e.target.value === "" ? null : Number(e.target.value))}
          placeholder="aus Tor-Paar"
        />
      </div>

      {selectedCone && (
        <div style={s.section}>
          <label style={s.label}>Ausgewählte Pylone</label>
          <div style={{ fontSize: 13, color: "#374151", marginBottom: 8 }}>
            {selectedCone.kind === "standing" ? "Stehend" : selectedCone.kind === "lying" ? "Liegend" : "Sensor"}
            {" "}({selectedCone.x.toFixed(2)} m / {selectedCone.y.toFixed(2)} m)
          </div>
          {selectedCone.kind === "lying" && (
            <div>
              <label style={s.label}>Winkel (°)</label>
              <div style={{ display: "flex", gap: 4 }}>
                {[0, 45, 90, 135, 180].map((deg) => (
                  <button key={deg} style={{ ...s.btn, padding: "4px 0", fontSize: 11, background: selectedCone.angleDeg === deg ? "#eff6ff" : "white" }}
                    onClick={() => onRotateSelectedCone(deg)}>
                    {deg}°
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {selectedConeIds.length > 0 && (
        <div style={s.section}>
          <div style={s.row}>
            <button style={s.btnDanger} onClick={onDeleteSelected}>
              Löschen ({selectedConeIds.length})
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
