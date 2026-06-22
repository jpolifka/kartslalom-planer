// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import type { EditableCone } from "../../hooks/useFormationEditor";
import { PYLON_FOOT_SIZE, TASK_LANE_WIDTH } from "../../lib/formations/common";

type Props = {
  cones: EditableCone[];
  gatePairIds: [string, string] | null;
  active: boolean;
  onActivate: () => void;
  onClear: () => void;
  onApplyLichteBreite: (value: number) => void;
};

function dist(a: EditableCone, b: EditableCone) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

const s: Record<string, React.CSSProperties> = {
  wrap: { padding: "12px 16px", borderBottom: "1px solid #f3f4f6" },
  title: { fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 8 },
  btn: { padding: "5px 10px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer", background: "white" },
  btnActive: { padding: "5px 10px", fontSize: 12, border: "1px solid #2563eb", borderRadius: 6, cursor: "pointer", background: "#eff6ff", color: "#2563eb" },
  result: { marginTop: 8, fontSize: 13 },
  warn: { color: "#dc2626", fontWeight: 600 },
  ok: { color: "#16a34a", fontWeight: 600 },
  hint: { fontSize: 11, color: "#9ca3af", marginTop: 4 },
};

export default function GatePairTool({ cones, gatePairIds, active, onActivate, onClear, onApplyLichteBreite }: Props) {
  const cone0 = gatePairIds ? cones.find((c) => c.id === gatePairIds[0]) : null;
  const cone1 = gatePairIds ? cones.find((c) => c.id === gatePairIds[1]) : null;
  const lichteBreite = cone0 && cone1 ? dist(cone0, cone1) - PYLON_FOOT_SIZE : null;
  const warn = lichteBreite !== null && lichteBreite < TASK_LANE_WIDTH;

  const waitingForCone = active && gatePairIds && gatePairIds.length < 2;
  const waitingForFirst = active && !gatePairIds;

  return (
    <div style={s.wrap}>
      <div style={s.title}>Tor-Paar (lichte Breite)</div>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          style={active ? s.btnActive : s.btn}
          onClick={active ? onClear : onActivate}
        >
          {active ? "Abbrechen" : "Tor markieren"}
        </button>
        {gatePairIds && (
          <button style={s.btn} onClick={onClear}>Zurücksetzen</button>
        )}
      </div>

      {active && (
        <p style={s.hint}>
          {waitingForFirst
            ? "Erste Tor-Pylone klicken …"
            : waitingForCone
            ? "Zweite Tor-Pylone klicken …"
            : null}
        </p>
      )}

      {lichteBreite !== null && (
        <div style={s.result}>
          <span style={warn ? s.warn : s.ok}>
            {lichteBreite.toFixed(2)} m{warn ? " — zu schmal (< 1,65 m)" : " ✓"}
          </span>
          <div style={{ marginTop: 6 }}>
            <button
              style={s.btn}
              onClick={() => onApplyLichteBreite(Math.round(lichteBreite * 100) / 100)}
            >
              → In Meta übernehmen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
