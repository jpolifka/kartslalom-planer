// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { useNavigate } from "react-router-dom";
import { Plus, Trash2, Pencil, Layers, Share2, Eye } from "lucide-react";
import { useCustomFormationList, useDeleteCustomFormation, useSharedFormations } from "../hooks/useCustomFormations";
import { useFeatureGate } from "../hooks/useFeatureGate";

// Eigenständige Vollansicht "Meine Hindernisse" (eigene + mit mir geteilte
// Formationen). Hinweis: DashboardPage.tsx zeigt denselben Datensatz
// (useCustomFormationList) zusätzlich in einer eigenen, separat gepflegten
// Kartenansicht inkl. eigener CATEGORY_LABELS-Kopie — bei Änderungen an
// Kategorien/Labels/Kartenlayout hier immer auch dort prüfen.
const CATEGORY_LABELS: Record<string, string> = {
  individuell: "Individuell",
  basis: "Basis",
  kurven: "Kurven",
  komplex: "Komplex",
  start_ziel: "Start / Ziel",
};

function FormationCard({
  id, name, category, pylon_count, duration_seconds, updated_at,
  actions,
}: {
  id: string; name: string; category: string; pylon_count: number;
  duration_seconds: number | null; updated_at: string;
  actions: React.ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <div
      style={{
        background: "white", borderRadius: 14, padding: "14px 16px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", gap: 8,
        cursor: "pointer",
      }}
      onClick={() => navigate(`/formations/${id}`)}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#111827", flex: 1, minWidth: 0 }}>{name}</div>
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>{actions}</div>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, background: "#f1f5f9", borderRadius: 4, padding: "2px 7px", color: "#475569", fontWeight: 500 }}>
          {CATEGORY_LABELS[category] ?? category}
        </span>
        <span style={{ fontSize: 11, background: "#f1f5f9", borderRadius: 4, padding: "2px 7px", color: "#475569" }}>
          {pylon_count} Pylone
        </span>
        {duration_seconds && (
          <span style={{ fontSize: 11, background: "#f1f5f9", borderRadius: 4, padding: "2px 7px", color: "#475569" }}>
            {duration_seconds} s
          </span>
        )}
      </div>
      <div style={{ fontSize: 11, color: "#94a3b8" }}>
        Geändert: {new Date(updated_at).toLocaleString("de-DE")}
      </div>
    </div>
  );
}

const iconBtn = (extra?: React.CSSProperties): React.CSSProperties => ({
  border: "1px solid var(--c-primary-border)", background: "var(--c-primary-bg)",
  borderRadius: 6, padding: 5, cursor: "pointer", color: "var(--c-primary)",
  display: "flex", ...extra,
});

export default function FormationsPage() {
  const navigate = useNavigate();
  const { data: formations, isLoading } = useCustomFormationList();
  const { data: sharedWithMe, isLoading: sharedLoading } = useSharedFormations();
  const deleteMutation = useDeleteCustomFormation();
  // Eigene Formationen sind ein Tarif-Feature (mind. Pro) — ohne Berechtigung
  // bleibt "Neues Hindernis" ausgeblendet und ein Hinweis mit Kontakt-Link
  // wird angezeigt statt eines Checkout-Flows (siehe Zahlungsmodell: Upgrades
  // laufen manuell, es gibt keinen Self-Service-Checkout in der App).
  const { allowed, requiredTier } = useFeatureGate("custom_formations");

  async function handleDelete(e: React.MouseEvent, id: string, name: string) {
    e.stopPropagation();
    if (!confirm(`Hindernis „${name}" wirklich löschen?`)) return;
    await deleteMutation.mutateAsync(id);
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Meine Hindernisse</h2>
        {allowed && (
          <button
            onClick={() => navigate("/formations/new")}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              border: "none", borderRadius: 10, background: "var(--c-primary)",
              color: "white", padding: "9px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}
          >
            <Plus size={15} /> Neues Hindernis
          </button>
        )}
      </div>

      {!allowed && (
        <div style={{
          background: "#fffbeb", border: "1px solid #fde68a",
          borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#92400e", marginBottom: 16,
        }}>
          Eigene Hindernisse erfordern mindestens den <strong>{requiredTier ?? "Pro"}-Tarif</strong>.
          Schreib uns: jens(at)polifka.info
        </div>
      )}

      {isLoading && <div style={{ color: "#94a3b8", fontSize: 13 }}>Lädt…</div>}

      {!isLoading && (!formations || formations.length === 0) && (
        <div style={{
          background: "white", borderRadius: 16, padding: 32,
          textAlign: "center", color: "#64748b", fontSize: 13,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}>
          <Layers size={32} color="#cbd5e1" style={{ marginBottom: 12 }} />
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Noch keine Hindernisse</div>
          <div>Erstelle dein erstes eigenes Hindernis und nutze es in deinen Strecken.</div>
          {allowed && (
            <button
              onClick={() => navigate("/formations/new")}
              style={{
                marginTop: 14, display: "inline-flex", alignItems: "center", gap: 6,
                border: "none", borderRadius: 8, background: "var(--c-primary)",
                color: "white", padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >
              <Plus size={14} /> Hindernis erstellen
            </button>
          )}
        </div>
      )}

      {!!formations?.length && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12, marginBottom: 32 }}>
          {formations.map((f) => (
            <FormationCard key={f.id} {...f}
              actions={<>
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/formations/${f.id}/share`); }}
                  style={iconBtn()}
                  title="Teilen"
                >
                  <Share2 size={12} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/formations/${f.id}`); }}
                  style={iconBtn()}
                  title="Bearbeiten"
                >
                  <Pencil size={12} />
                </button>
                <button
                  onClick={(e) => handleDelete(e, f.id, f.name)}
                  style={iconBtn({ border: "1px solid #fecaca", background: "white", color: "#b91c1c" })}
                  title="Löschen"
                >
                  <Trash2 size={12} />
                </button>
              </>}
            />
          ))}
        </div>
      )}

      {/* Geteilt mit mir: Formationen, die andere Nutzer per
          FormationSharePage(useShareFormation) freigegeben haben — je nach
          vergebenem Recht nur ansehen (Eye) oder auch bearbeiten (Pencil). */}
      {!sharedLoading && !!sharedWithMe?.length && (
        <>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#374151", margin: "0 0 12px" }}>Geteilt mit mir</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
            {sharedWithMe.map((f) => (
              <FormationCard key={f.id} {...f}
                actions={
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/formations/${f.id}`); }}
                    style={iconBtn()}
                    title={f.permission === "edit" ? "Bearbeiten" : "Ansehen"}
                  >
                    {f.permission === "edit" ? <Pencil size={12} /> : <Eye size={12} />}
                  </button>
                }
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
