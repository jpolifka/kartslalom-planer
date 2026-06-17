// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { RotateCw, Trash2, AlertTriangle, Info } from "lucide-react";
import { getFormation } from "../../../lib/formationRegistry";
import type { ValidationIssue } from "../../../lib/validation/types";
import type { PlacedFormation, PlacedArrow } from "../../../types";
import { card, outlineBtn, dangerBtn, numInput, mobileDrawerStyle } from "../editorStyles";
import DrawerHeader from "./DrawerHeader";
import SectionLabel from "./SectionLabel";

type Props = {
  isMobile: boolean;
  mobileOpen: boolean;
  onClose: () => void;
  selectedIds: Set<string>;
  selected: PlacedFormation | null;
  selectedArrow: PlacedArrow | null;
  selectedArrowId: string | null;
  onUpdateFormation: (id: string, patch: Partial<PlacedFormation>) => void;
  onDeleteFormation: (id: string) => void;
  onDeleteSelectedFormations: () => void;
  onDeleteArrow: (id: string) => void;
  onSelectFormation: (id: string, addToSelection?: boolean) => void;
  totalDurationSeconds: number;
  hasItems: boolean;
  issues: ValidationIssue[];
};

export default function RightPanel({
  isMobile, mobileOpen, onClose,
  selectedIds, selected, selectedArrow, selectedArrowId,
  onUpdateFormation, onDeleteFormation, onDeleteSelectedFormations, onDeleteArrow,
  onSelectFormation,
  totalDurationSeconds, hasItems,
  issues,
}: Props) {
  const style = isMobile
    ? mobileDrawerStyle("right", mobileOpen)
    : { display: "grid", gap: 12, alignContent: "start", overflowY: "auto" as const, minHeight: 0 };

  return (
    <aside style={style}>
      {isMobile && <DrawerHeader title="Eigenschaften" onClose={onClose} />}

      {/* Properties */}
      <section style={card}>
        <SectionLabel>Eigenschaften</SectionLabel>

        {selectedIds.size === 0 && !selectedArrow && (
          <div style={{ color: "#94a3b8", fontSize: 13 }}>
            Formation oder Pfeil auswählen.<br />
            <span style={{ fontSize: 11, color: "#cbd5e1" }}>Shift+Klick für Mehrfachauswahl</span>
          </div>
        )}

        {selectedIds.size > 1 && !selectedArrow && (
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{selectedIds.size} Formationen ausgewählt</div>
            <div style={{ fontSize: 12, color: "#475569", background: "#f8fafc", borderRadius: 8, padding: 10 }}>
              Ziehe eine der markierten Formationen, um alle gemeinsam zu verschieben.
            </div>
            <button onClick={onDeleteSelectedFormations} style={dangerBtn}>
              <Trash2 size={13} /> Alle löschen
            </button>
          </div>
        )}

        {selectedArrow && (
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ fontWeight: 700 }}>Pfeil</div>
            <div style={{
              fontSize: 12, color: "#475569",
              background: "#f8fafc", borderRadius: 8, padding: 10, lineHeight: 1.7,
            }}>
              <strong>Oranger Punkt:</strong> krümmen<br />
              <strong>Weiße Punkte:</strong> Start/Ende verschieben
            </div>
            <button onClick={() => onDeleteArrow(selectedArrowId!)} style={dangerBtn}>
              <Trash2 size={13} /> Pfeil löschen
            </button>
          </div>
        )}

        {selected && (
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{getFormation(selected.key).label}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <label style={{ fontSize: 12 }}>
                X (m)
                <input style={numInput} type="number" step="0.1" value={selected.x}
                  onChange={(e) => onUpdateFormation(selected.id, { x: Number(e.target.value) || 0 })} />
              </label>
              <label style={{ fontSize: 12 }}>
                Y (m)
                <input style={numInput} type="number" step="0.1" value={selected.y}
                  onChange={(e) => onUpdateFormation(selected.id, { y: Number(e.target.value) || 0 })} />
              </label>
            </div>
            <label style={{ fontSize: 12 }}>
              Winkel (°)
              <input style={numInput} type="number" step="1" value={selected.rotationDeg}
                onChange={(e) => onUpdateFormation(selected.id, { rotationDeg: Number(e.target.value) || 0 })} />
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button
                onClick={() => onUpdateFormation(selected.id, { rotationDeg: selected.rotationDeg - 15 })}
                style={outlineBtn}
              >
                ↺ −15°
              </button>
              <button
                onClick={() => onUpdateFormation(selected.id, { rotationDeg: selected.rotationDeg + 15 })}
                style={outlineBtn}
              >
                <RotateCw size={12} /> +15°
              </button>
            </div>
            <label style={{ fontSize: 12 }}>
              Durchfahrzeit (s)
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                <input
                  style={{ ...numInput, flex: 1 }}
                  type="number"
                  min="0"
                  step="1"
                  value={selected.durationSeconds ?? getFormation(selected.key).defaultDurationSeconds ?? 0}
                  onChange={(e) => onUpdateFormation(selected.id, { durationSeconds: Math.max(0, Number(e.target.value) || 0) })}
                />
                {selected.durationSeconds !== undefined && (
                  <button
                    onClick={() => onUpdateFormation(selected.id, { durationSeconds: undefined })}
                    title="Auf Standard zurücksetzen"
                    style={{
                      border: "1px solid #cbd5e1", background: "white", borderRadius: 7,
                      padding: "5px 7px", cursor: "pointer", fontSize: 11, color: "#64748b",
                      flexShrink: 0,
                    }}
                  >
                    ↺
                  </button>
                )}
              </div>
              {selected.durationSeconds !== undefined && (
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
                  Standard: {getFormation(selected.key).defaultDurationSeconds ?? 0} s
                </div>
              )}
            </label>
            <button onClick={() => onDeleteFormation(selected.id)} style={dangerBtn}>
              <Trash2 size={13} /> Löschen
            </button>
          </div>
        )}
      </section>

      {/* Course duration */}
      <section style={card}>
        <SectionLabel>Kursdauer</SectionLabel>
        {!hasItems ? (
          <div style={{ fontSize: 13, color: "#94a3b8" }}>Noch keine Formationen platziert.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{
              background: "#f0f9ff", border: "1px solid #bae6fd",
              borderRadius: 10, padding: "10px 12px",
              display: "flex", alignItems: "baseline", gap: 6,
            }}>
              <span style={{ fontSize: 26, fontWeight: 800, color: "#0284c7", lineHeight: 1 }}>
                {totalDurationSeconds}
              </span>
              <span style={{ fontSize: 13, color: "#0369a1", fontWeight: 600 }}>Sekunden</span>
              <span style={{ fontSize: 11, color: "#7dd3fc", marginLeft: "auto" }}>
                ≈ {Math.floor(totalDurationSeconds / 60)}:{String(totalDurationSeconds % 60).padStart(2, "0")} min
              </span>
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
              Richtwert basierend auf den Durchfahrzeiten der Formationen. Pro Formation anpassbar.
            </div>
          </div>
        )}
      </section>

      {/* Validation */}
      <section style={card}>
        <SectionLabel>Prüfung</SectionLabel>
        {issues.length === 0 ? (
          <div style={{ fontSize: 13, color: "#64748b" }}>
            {!hasItems ? "Noch keine Formationen platziert." : "Keine Auffälligkeiten."}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 7 }}>
            {issues.map((issue) => {
              const isErr = issue.severity === "error";
              const clickable = !!issue.formationId;
              return (
                <div
                  key={issue.id}
                  onClick={() => { if (issue.formationId) onSelectFormation(issue.formationId, false); }}
                  style={{
                    borderRadius: 10,
                    border: isErr ? "1px solid #fecaca" : "1px solid #fde68a",
                    background: isErr ? "#fff1f2" : "#fffbeb",
                    padding: "8px 10px",
                    cursor: clickable ? "pointer" : "default",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 600, fontSize: 12 }}>
                    {isErr
                      ? <AlertTriangle size={13} color="#ef4444" />
                      : <Info size={13} color="#f59e0b" />
                    }
                    <span style={{ flex: 1 }}>{issue.message}</span>
                    {clickable && <span style={{ fontSize: 10, color: "#94a3b8" }}>→</span>}
                  </div>
                  {issue.details && (
                    <div style={{ fontSize: 11, color: "#475569", marginTop: 4, paddingLeft: 20 }}>
                      {issue.details}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </aside>
  );
}
