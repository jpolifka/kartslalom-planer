// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { useState } from "react";
import { RotateCw } from "lucide-react";
import FormationThumbnail from "../../../components/FormationThumbnail";
import { getFormation } from "../../../lib/formationRegistry";

const ROTATIONS = [0, 90, 180, 270];

type Props = {
  formation: ReturnType<typeof getFormation>;
  onClick: (rotDeg: number) => void;
  showRotationSubMenu?: boolean;
  subMenuOpen?: boolean;
  onToggleSubMenu?: () => void;
};

export default function PaletteCard({ formation, onClick, showRotationSubMenu, subMenuOpen, onToggleSubMenu }: Props) {
  const [hovered, setHovered] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{ position: "relative", display: "flex" }}>
        <button
          onClick={() => onClick(0)}
          title={formation.description}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            flex: 1,
            borderRadius: showRotationSubMenu ? "10px 0 0 10px" : 10,
            border: hovered ? "1px solid #94a3b8" : "1px solid #e2e8f0",
            borderRight: showRotationSubMenu ? "none" : undefined,
            background: hovered ? "#f8fafc" : "#fff",
            padding: "8px 6px",
            cursor: "pointer",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 5,
            transition: "border-color 0.12s, background 0.12s",
          }}
        >
          <FormationThumbnail formation={formation} size={48} />
          <span style={{ fontSize: 11, fontWeight: 600, color: "#334155", lineHeight: 1.2 }}>
            {formation.label}
          </span>
        </button>
        {showRotationSubMenu && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleSubMenu?.(); }}
            title="Rotationsvarianten anzeigen"
            style={{
              borderRadius: "0 10px 10px 0",
              border: "1px solid #e2e8f0",
              borderLeft: "1px solid #e2e8f0",
              background: subMenuOpen ? "var(--c-primary-bg)" : "#f8fafc",
              padding: "0 5px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              color: subMenuOpen ? "var(--c-primary)" : "#94a3b8",
              fontSize: 10,
              transition: "background 0.12s",
            }}
          >
            <RotateCw size={11} />
          </button>
        )}
      </div>
      {subMenuOpen && showRotationSubMenu && (
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr",
          gap: 3,
          background: "#f2f8ea",
          border: "1px solid #b8d98a",
          borderRadius: 8,
          padding: 5,
        }}>
          {ROTATIONS.map((deg) => (
            <button
              key={deg}
              onClick={() => onClick(deg)}
              title={`${deg}° gedreht einfügen`}
              style={{
                borderRadius: 7,
                border: "1px solid #b8d98a",
                background: "white",
                padding: "4px 3px",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
              }}
            >
              <FormationThumbnail formation={formation} size={36} rotationDeg={deg} />
              <span style={{ fontSize: 10, color: "var(--c-primary)", fontWeight: 600 }}>{deg}°</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
