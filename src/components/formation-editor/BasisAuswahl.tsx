// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { useState } from "react";
import { FORMATIONS } from "../../lib/formationRegistry";
import { normalizeCones } from "../../lib/geometry";
import type { EditorSnap, EditableCone } from "../../hooks/useFormationEditor";
import type { FormationKey } from "../../types";
import { useCustomFormationList } from "../../hooks/useCustomFormations";
import { useAuthStore } from "../../store/authStore";

type Props = {
  onConfirm: (snap: EditorSnap, sourceKey?: FormationKey) => void;
};

const NON_CONE_KEYS: FormationKey[] = ["arrowStraight", "arrow90", "arrow180"];
const SELECTABLE = FORMATIONS.filter((f) => !f.arrow && !NON_CONE_KEYS.includes(f.key));

const s: Record<string, React.CSSProperties> = {
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  dialog: { background: "white", borderRadius: 12, padding: 28, width: 480, maxHeight: "85vh", display: "flex", flexDirection: "column", gap: 16, overflow: "hidden" },
  title: { fontSize: 18, fontWeight: 700, color: "#111827" },
  subtitle: { fontSize: 14, color: "#6b7280" },
  optionRow: { display: "flex", gap: 8 },
  optBtn: { flex: 1, padding: "12px 10px", border: "2px solid #e5e7eb", borderRadius: 10, cursor: "pointer", background: "white", textAlign: "left" as const, fontSize: 13 },
  optBtnActive: { flex: 1, padding: "12px 10px", border: "2px solid #2563eb", borderRadius: 10, cursor: "pointer", background: "#eff6ff", textAlign: "left" as const, fontSize: 13 },
  list: { overflowY: "auto", maxHeight: 200, border: "1px solid #e5e7eb", borderRadius: 8 },
  listItem: { padding: "8px 12px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid #f3f4f6" },
  listItemSel: { padding: "8px 12px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid #f3f4f6", background: "#eff6ff", fontWeight: 600, color: "#2563eb" },
  confirmBtn: { padding: "10px 0", background: "#2563eb", color: "white", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: "pointer" },
  confirmBtnDisabled: { padding: "10px 0", background: "#93c5fd", color: "white", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: "not-allowed" },
};

export default function BasisAuswahl({ onConfirm }: Props) {
  const { session } = useAuthStore();
  const { data: ownFormations } = useCustomFormationList();
  const [mode, setMode] = useState<"empty" | "standard" | "own">("empty");
  const [selectedKey, setSelectedKey] = useState<FormationKey | null>(null);
  const [selectedOwnId, setSelectedOwnId] = useState<string | null>(null);

  function handleConfirm() {
    if (mode === "empty") {
      onConfirm({ cones: [], arrows: [] });
      return;
    }
    if (mode === "standard" && selectedKey) {
      const formation = FORMATIONS.find((f) => f.key === selectedKey)!;
      const normalized = normalizeCones(formation.cones);
      const cones: EditableCone[] = normalized.map((c) => ({ ...c, id: crypto.randomUUID() }));
      onConfirm({ cones, arrows: [] }, selectedKey);
      return;
    }
    if (mode === "own" && selectedOwnId && ownFormations) {
      const f = ownFormations.find((x) => x.id === selectedOwnId)!;
      const cones: EditableCone[] = (f.cones_json as EditableCone[]).map((c) => ({ ...c, id: crypto.randomUUID() }));
      onConfirm({ cones, arrows: f.arrows_json as never });
    }
  }

  const canConfirm =
    mode === "empty" ||
    (mode === "standard" && !!selectedKey) ||
    (mode === "own" && !!selectedOwnId);

  return (
    <div style={s.overlay}>
      <div style={s.dialog}>
        <div>
          <div style={s.title}>Neues Hindernis</div>
          <div style={s.subtitle}>Womit möchtest du starten?</div>
        </div>

        <div style={s.optionRow}>
          <button style={mode === "empty" ? s.optBtnActive : s.optBtn} onClick={() => setMode("empty")}>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>Leer starten</div>
            <div style={{ fontSize: 11, color: "#6b7280" }}>Leere Arbeitsfläche</div>
          </button>
          <button style={mode === "standard" ? s.optBtnActive : s.optBtn} onClick={() => setMode("standard")}>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>Standard-Formation</div>
            <div style={{ fontSize: 11, color: "#6b7280" }}>Aus der Bibliothek duplizieren</div>
          </button>
          {session && (
            <button style={mode === "own" ? s.optBtnActive : s.optBtn} onClick={() => setMode("own")}>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>Eigenes Hindernis</div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>Bestehendes duplizieren</div>
            </button>
          )}
        </div>

        {mode === "standard" && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 6 }}>Formation auswählen</div>
            <div style={s.list}>
              {SELECTABLE.map((f) => (
                <div key={f.key} style={selectedKey === f.key ? s.listItemSel : s.listItem} onClick={() => setSelectedKey(f.key)}>
                  {f.label}
                  <span style={{ marginLeft: 6, fontSize: 11, color: "#9ca3af" }}>({f.cones.length} Cones)</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {mode === "own" && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 6 }}>Hindernis auswählen</div>
            {!ownFormations || ownFormations.length === 0 ? (
              <div style={{ fontSize: 13, color: "#94a3b8", padding: "12px 0" }}>
                Noch keine eigenen Hindernisse vorhanden.
              </div>
            ) : (
              <div style={s.list}>
                {ownFormations.map((f) => (
                  <div key={f.id} style={selectedOwnId === f.id ? s.listItemSel : s.listItem} onClick={() => setSelectedOwnId(f.id)}>
                    {f.name}
                    <span style={{ marginLeft: 6, fontSize: 11, color: "#9ca3af" }}>({f.pylon_count} Pylone)</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <button style={canConfirm ? s.confirmBtn : s.confirmBtnDisabled} disabled={!canConfirm} onClick={handleConfirm}>
          Starten
        </button>
      </div>
    </div>
  );
}
