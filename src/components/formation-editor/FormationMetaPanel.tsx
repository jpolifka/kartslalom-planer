// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import type { EditableCone } from "../../hooks/useFormationEditor";
import type { FormationCategory } from "../../types";
import type { GuideLine } from "./FormationEditorCanvas";
import { TASK_LANE_WIDTH } from "../../lib/formations/common";

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
  onRotateSelection: (deltaDeg: number) => void;
  onDeleteSelected: () => void;
  guides?: GuideLine[];
  onMoveGuide?: (id: string, pos: number) => void;
  onRemoveGuide?: (id: string) => void;
  onClearGuides?: () => void;
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

// Sensoren (kind === "sensor") zählen bewusst nicht als Pylon — sie markieren
// nur eine virtuelle Lichtschranken-/Zeitmess-Position, keinen physischen
// Hütchen, der beim Streckenaufbau real hingestellt wird.
const pylonCount = (cones: EditableCone[]) =>
  cones.filter((c) => c.kind === "standing" || c.kind === "lying").length;

export default function FormationMetaPanel({
  name, description, category, durationSeconds, lichteBreite,
  cones, selectedConeIds,
  onChangeName, onChangeDescription,
  onChangeDuration, onChangeLichteBreite,
  onRotateSelectedCone, onRotateSelection, onDeleteSelected,
  guides = [], onMoveGuide, onRemoveGuide, onClearGuides,
}: Props) {
  const selectedCone = selectedConeIds.length === 1
    ? cones.find((c) => c.id === selectedConeIds[0])
    : null;
  const isMultiSelect = selectedConeIds.length > 1;

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
        {/* Kategorie ist festgelegt auf "individuell" — Admin-Funktion folgt später.
            Nur eine Admin-Promotion in die geteilte Bibliothek (adminPromoteToLibrary,
            siehe useCustomFormations) ordnet eine Formation aktuell einer der anderen
            Kategorien zu; der Eigentümer selbst kann sie hier (noch) nicht ändern. */}
        <div style={{ ...s.input, color: "#6b7280", background: "#f9fafb", cursor: "default" }}>
          {CATEGORIES.find((c) => c.value === category)?.label ?? category}
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <div>
          <label style={s.label}>Pylone</label>
          <span style={s.badge}>{pylonCount(cones)}</span>
        </div>
        {cones.length !== pylonCount(cones) && (
          <div>
            <label style={s.label}>Sensoren</label>
            <span style={s.badge}>{cones.length - pylonCount(cones)}</span>
          </div>
        )}
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

      {lichteBreite !== null && (
        <div>
          <label style={s.label}>Lichte Breite (m)</label>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: lichteBreite < TASK_LANE_WIDTH ? "#dc2626" : "#16a34a" }}>
              {lichteBreite.toFixed(2)} m {lichteBreite < TASK_LANE_WIDTH ? "⚠ zu schmal" : "✓"}
            </span>
            <button
              style={{ fontSize: 11, padding: "2px 6px", border: "1px solid #d1d5db", borderRadius: 4, cursor: "pointer", background: "white", color: "#6b7280" }}
              onClick={() => onChangeLichteBreite(null)}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {selectedCone && (
        <div style={s.section}>
          <label style={s.label}>Ausgewählte Pylone</label>
          <div style={{ fontSize: 13, color: "#374151", marginBottom: 8 }}>
            {selectedCone.kind === "standing" ? "Stehend" : selectedCone.kind === "lying" ? "Liegend" : "Sensor"}
            {" "}({selectedCone.x.toFixed(2)} m / {selectedCone.y.toFixed(2)} m)
          </div>
          {(selectedCone.kind === "lying" || selectedCone.kind === "standing") && (
            <div>
              <label style={s.label}>Winkel (°) — oder gelben Griff ziehen</label>
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
                <input
                  type="number"
                  min={0} max={359} step={1}
                  value={selectedCone.angleDeg ?? 0}
                  onChange={(e) => onRotateSelectedCone(((Number(e.target.value) % 360) + 360) % 360)}
                  style={{ ...s.input, width: 70, boxSizing: "border-box" }}
                />
                <span style={{ fontSize: 12, color: "#6b7280" }}>°</span>
              </div>
              <div style={{ display: "flex", gap: 3 }}>
                {[0, 45, 90, 135].map((deg) => (
                  <button key={deg}
                    style={{ flex: 1, padding: "3px 0", fontSize: 11, border: "1px solid #d1d5db", borderRadius: 5, cursor: "pointer", background: selectedCone.angleDeg === deg ? "#eff6ff" : "white" }}
                    onClick={() => onRotateSelectedCone(deg)}>
                    {deg}°
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mehrfachauswahl dreht sich nur relativ (Delta-Winkel um den
          gemeinsamen Auswahl-Mittelpunkt, siehe ROTATE_SELECTION im
          Formation-Editor-State) — anders als bei einer Einzelauswahl gibt es
          hier keinen absoluten Zielwinkel, da jeder Cone einen anderen
          Ausgangswinkel/eine andere Position relativ zum Zentrum hat. */}
      {isMultiSelect && (
        <div style={s.section}>
          <label style={s.label}>Auswahl drehen ({selectedConeIds.length} Pylone)</label>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" as const }}>
            {[-90, -45, -15, 15, 45, 90].map((deg) => (
              <button key={deg}
                style={{ flex: 1, minWidth: 40, padding: "4px 2px", fontSize: 11, border: "1px solid #d1d5db", borderRadius: 5, cursor: "pointer", background: "white" }}
                onClick={() => onRotateSelection(deg)}
              >
                {deg > 0 ? "+" : ""}{deg}°
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
            {[-180, 180].map((deg) => (
              <button key={deg}
                style={{ flex: 1, padding: "4px 0", fontSize: 11, border: "1px solid #d1d5db", borderRadius: 5, cursor: "pointer", background: "white" }}
                onClick={() => onRotateSelection(deg)}
              >
                {deg > 0 ? "+" : ""}{deg}°
              </button>
            ))}
          </div>
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

      {/* Hilfslinien */}
      {guides.length > 0 && (
        <div style={s.section}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <label style={s.label}>Hilfslinien</label>
            <button onClick={onClearGuides} style={{ fontSize: 11, color: "#94a3b8", background: "none", border: "none", cursor: "pointer" }}>
              Alle löschen
            </button>
          </div>
          <div style={{ display: "grid", gap: 4 }}>
            {guides.map((g) => (
              <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 11, color: "#3b82f6", fontWeight: 700, width: 14, flexShrink: 0 }}>
                  {g.axis === "h" ? "─" : "│"}
                </span>
                <input
                  type="number" step={0.1} value={g.pos.toFixed(2)}
                  onChange={(e) => onMoveGuide?.(g.id, Number(e.target.value))}
                  style={{ ...s.input, flex: 1, padding: "3px 6px", fontSize: 12 }}
                />
                <span style={{ fontSize: 10, color: "#94a3b8" }}>m</span>
                <button onClick={() => onRemoveGuide?.(g.id)} style={{ fontSize: 11, color: "#94a3b8", background: "none", border: "none", cursor: "pointer" }}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
