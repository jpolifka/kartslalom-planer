// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { Map, Trash2, Satellite } from "lucide-react";
import { getFormation } from "../../../lib/formationRegistry";
import type { AreaSelection } from "../../../lib/areaSelection";
import type { FormationKey } from "../../../types";
import { FORMATION_GROUPS } from "../editorConstants";
import { card, outlineBtn, numInput, mobileDrawerStyle } from "../editorStyles";
import DrawerHeader from "./DrawerHeader";
import SectionLabel from "./SectionLabel";
import PaletteCard from "./PaletteCard";
import { ChevronDown, ChevronRight } from "lucide-react";

type Props = {
  isMobile: boolean;
  mobileOpen: boolean;
  onClose: () => void;
  // area selection
  areaSel: AreaSelection | null;
  onOpenMapSelector: () => void;
  onClearArea: () => void;
  // map controls (only when areaSel set)
  mapSatellite: boolean;
  onSetMapSatellite: (v: boolean) => void;
  satelliteLocked: boolean;
  mapOpacity: number;
  onSetMapOpacity: (v: number) => void;
  // manual dimensions (only when areaSel null)
  manualWidthInput: string;
  manualLengthInput: string;
  onManualWidthChange: (raw: string, parsed: number) => void;
  onManualLengthChange: (raw: string, parsed: number) => void;
  onManualWidthBlur: () => void;
  onManualLengthBlur: () => void;
  // formation palette
  openGroups: Set<string>;
  onToggleGroup: (key: string) => void;
  subMenuKey: string | null;
  onToggleSubMenu: (key: string) => void;
  onAddFormation: (key: FormationKey, rotDeg?: number) => void;
  // custom formations (Individuell-Palette)
  customFormations?: Array<{ id: string; name: string; pylon_count: number; isLibrary?: boolean; ownerUsername?: string | null }>;
  onAddCustomFormation?: (id: string) => void;
};

export default function LeftSidebar({
  isMobile, mobileOpen, onClose,
  areaSel, onOpenMapSelector, onClearArea,
  mapSatellite, onSetMapSatellite, satelliteLocked,
  mapOpacity, onSetMapOpacity,
  manualWidthInput, manualLengthInput,
  onManualWidthChange, onManualLengthChange,
  onManualWidthBlur, onManualLengthBlur,
  openGroups, onToggleGroup, subMenuKey, onToggleSubMenu,
  onAddFormation,
  customFormations,
  onAddCustomFormation,
}: Props) {
  const style = isMobile
    ? mobileDrawerStyle("left", mobileOpen)
    : { display: "grid", gap: 12, alignContent: "start", overflowY: "auto" as const, minHeight: 0 };

  const ownFormations = customFormations?.filter((f) => !f.isLibrary) ?? [];
  const libFormations = customFormations?.filter((f) => f.isLibrary) ?? [];

  return (
    <aside style={style}>
      {isMobile && <DrawerHeader title="Formationen" onClose={onClose} />}

      {/* Area section */}
      <section style={card}>
        <SectionLabel>Streckenbereich</SectionLabel>
        {areaSel ? (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{
              background: "#f0fdf4", border: "1px solid #bbf7d0",
              borderRadius: 10, padding: "9px 12px", fontSize: 13,
            }}>
              <div style={{ fontWeight: 700, color: "#15803d", marginBottom: 2 }}>Bereich ausgewaehlt</div>
              <div style={{ color: "#166534" }}>
                {areaSel.widthM.toFixed(1)} m × {areaSel.heightM.toFixed(1)} m
                {areaSel.rotationDeg !== 0 && ` · ${areaSel.rotationDeg}°`}
              </div>
            </div>
            <button onClick={onOpenMapSelector} style={outlineBtn}>
              <Map size={13} /> Neu waehlen
            </button>
            <button onClick={onClearArea} style={{ ...outlineBtn, color: "#b91c1c", borderColor: "#fecaca" }}>
              <Trash2 size={13} /> Entfernen
            </button>
            <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 10, display: "grid", gap: 8 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: satelliteLocked ? "default" : "pointer", opacity: satelliteLocked ? 0.55 : 1 }}>
                <input type="checkbox" checked={mapSatellite} onChange={(e) => onSetMapSatellite(e.target.checked)} disabled={satelliteLocked} />
                <Satellite size={13} /> Satellitenbild
                {satelliteLocked && <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 2 }}>Pro</span>}
              </label>
              <label style={{ fontSize: 13 }}>
                Transparenz: {Math.round(mapOpacity * 100)} %
                <input type="range" min="0.1" max="1" step="0.05" value={mapOpacity}
                  onChange={(e) => onSetMapOpacity(Number(e.target.value))}
                  style={{ width: "100%", boxSizing: "border-box", marginTop: 4 }} />
              </label>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            <button onClick={onOpenMapSelector} style={{ ...outlineBtn, borderColor: "var(--c-primary)", color: "var(--c-primary)", fontWeight: 700 }}>
              <Map size={13} /> Bereich auf Karte waehlen
            </button>
            <div style={{ fontSize: 11, color: "#64748b" }}>Oder manuell eingeben:</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <label style={{ fontSize: 12 }}>
                Breite (m)
                <input style={numInput} type="number" value={manualWidthInput}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    onManualWidthChange(e.target.value, Number.isNaN(v) ? 0 : v);
                  }}
                  onBlur={onManualWidthBlur}
                />
              </label>
              <label style={{ fontSize: 12 }}>
                Laenge (m)
                <input style={numInput} type="number" value={manualLengthInput}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    onManualLengthChange(e.target.value, Number.isNaN(v) ? 0 : v);
                  }}
                  onBlur={onManualLengthBlur}
                />
              </label>
            </div>
          </div>
        )}
      </section>

      {/* Formation palette */}
      <section style={card}>
        <SectionLabel>Formationen</SectionLabel>
        <div style={{ display: "grid", gap: 4 }}>
          {FORMATION_GROUPS.map((group) => {
            const open = openGroups.has(group.key);
            const defs = group.formations.map((k) => getFormation(k));
            return (
              <div key={group.key}>
                <button
                  onClick={() => onToggleGroup(group.key)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center",
                    justifyContent: "space-between",
                    background: "#f8fafc", border: "none", borderRadius: 8,
                    padding: "6px 10px", cursor: "pointer",
                    fontWeight: 600, fontSize: 12, color: "#475569",
                    marginBottom: open ? 4 : 0,
                  }}
                >
                  <span>{group.label}</span>
                  {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </button>
                {open && (
                  group.isCustom ? (
                      <div style={{ display: "grid", gap: 4, paddingLeft: 2 }}>
                        {ownFormations.map((f) => (
                          <button
                            key={f.id}
                            onClick={() => onAddCustomFormation?.(f.id)}
                            style={{
                              width: "100%", textAlign: "left", padding: "7px 10px",
                              border: "1px solid #e2e8f0", borderRadius: 8, cursor: "pointer",
                              background: "white", fontSize: 12,
                              display: "flex", justifyContent: "space-between", alignItems: "center",
                            }}
                          >
                            <span style={{ fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                            <span style={{ fontSize: 11, color: "#94a3b8", flexShrink: 0, marginLeft: 6 }}>{f.pylon_count} P</span>
                          </button>
                        ))}
                        {ownFormations.length === 0 && (
                          <div style={{ padding: "6px 2px 2px", fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>
                            Noch keine eigenen Hindernisse.{" "}
                            <a href="/formations/new" style={{ color: "var(--c-primary)", fontWeight: 600, textDecoration: "none" }}>
                              Jetzt erstellen →
                            </a>
                          </div>
                        )}
                        {ownFormations.length > 0 && (
                          <a href="/formations" style={{ fontSize: 11, color: "#94a3b8", textDecoration: "none", padding: "2px 2px", display: "block" }}>
                            Verwalten →
                          </a>
                        )}
                        {libFormations.length > 0 && (
                          <>
                            <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.05em", paddingTop: ownFormations.length > 0 ? 8 : 2, paddingLeft: 2 }}>
                              BIBLIOTHEK
                            </div>
                            {libFormations.map((f) => (
                              <button
                                key={f.id}
                                onClick={() => onAddCustomFormation?.(f.id)}
                                style={{
                                  width: "100%", textAlign: "left", padding: "7px 10px",
                                  border: "1px solid #e0f2fe", borderRadius: 8, cursor: "pointer",
                                  background: "#f0f9ff", fontSize: 12,
                                  display: "grid", gap: 1,
                                }}
                              >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                  <span style={{ fontWeight: 600, color: "#0369a1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                                  <span style={{ fontSize: 11, color: "#94a3b8", flexShrink: 0, marginLeft: 6 }}>{f.pylon_count} P</span>
                                </div>
                                <div style={{ fontSize: 10, color: "#64748b" }}>
                                  {f.ownerUsername ? `von ${f.ownerUsername}` : "[gelöschter Nutzer]"}
                                </div>
                              </button>
                            ))}
                          </>
                        )}
                      </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, paddingLeft: 2 }}>
                      {defs.map((formation) => (
                        <PaletteCard
                          key={formation.key}
                          formation={formation}
                          onClick={(rotDeg) => onAddFormation(formation.key, rotDeg)}
                          showRotationSubMenu={group.rotationSubMenu}
                          subMenuOpen={subMenuKey === formation.key}
                          onToggleSubMenu={() => onToggleSubMenu(formation.key)}
                        />
                      ))}
                    </div>
                  )
                )}
              </div>
            );
          })}
        </div>
      </section>
    </aside>
  );
}
