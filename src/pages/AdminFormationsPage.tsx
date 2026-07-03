// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trash2, Library, ExternalLink } from "lucide-react";
import {
  useAdminFormationList,
  useAdminDeleteFormation,
  useAdminPromoteToLibrary,
} from "../hooks/useCustomFormations";
import type { CustomFormationRow } from "../lib/api/customFormations";

const STATUS_LABELS: Record<string, string> = {
  private: "Privat",
  shared: "Geteilt",
  submitted: "Eingereicht",
  library: "Bibliothek",
  rejected: "Abgelehnt",
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  private:   { bg: "#f1f5f9", color: "#64748b" },
  shared:    { bg: "#dbeafe", color: "#2563eb" },
  submitted: { bg: "#ffedd5", color: "#c2410c" },
  library:   { bg: "#d1fae5", color: "#065f46" },
  rejected:  { bg: "#fee2e2", color: "#b91c1c" },
};

const CATEGORY_LABELS: Record<string, string> = {
  start_ziel:  "Start/Ziel",
  basis:       "Basis",
  kurven:      "Kurven",
  komplex:     "Komplex",
  individuell: "Individuell",
};

const STATUS_OPTIONS = ["", "private", "shared", "submitted", "library", "rejected"];
const CATEGORY_OPTIONS = ["", "start_ziel", "basis", "kurven", "komplex", "individuell"];

type PromoteTarget = { id: string; name: string; category: string };
type DeleteTarget  = { id: string; name: string };

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_COLORS[status] ?? { bg: "#f1f5f9", color: "#64748b" };
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99,
      background: c.bg, color: c.color, whiteSpace: "nowrap",
    }}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

const PAGE_SIZE = 100;

export default function AdminFormationsPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter]     = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [page, setPage]                     = useState(0);
  const [promoteTarget, setPromoteTarget]   = useState<PromoteTarget | null>(null);
  const [deleteTarget, setDeleteTarget]     = useState<DeleteTarget | null>(null);

  const { data: formations, isLoading, error } = useAdminFormationList(
    statusFilter || undefined,
    categoryFilter || undefined,
    PAGE_SIZE,
    page * PAGE_SIZE,
  );
  const deleteMutation  = useAdminDeleteFormation();
  const promoteMutation = useAdminPromoteToLibrary();

  function handleFilterChange(setter: (v: string) => void, value: string) {
    setter(value);
    setPage(0); // Filter wechsel → zurück zu Seite 1
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteMutation.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  }

  async function handlePromote() {
    if (!promoteTarget) return;
    await promoteMutation.mutateAsync({ id: promoteTarget.id, category: promoteTarget.category });
    setPromoteTarget(null);
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <Library size={22} color="#6366f1" />
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#111827" }}>
          Admin — Hindernisse
        </h1>
      </div>

      {/* Filter */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <select
          value={statusFilter}
          onChange={(e) => handleFilterChange(setStatusFilter, e.target.value)}
          style={selectStyle}
        >
          <option value="">Alle Status</option>
          {STATUS_OPTIONS.slice(1).map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => handleFilterChange(setCategoryFilter, e.target.value)}
          style={selectStyle}
        >
          <option value="">Alle Kategorien</option>
          {CATEGORY_OPTIONS.slice(1).map((c) => (
            <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
          ))}
        </select>

        <span style={{ fontSize: 13, color: "#94a3b8", alignSelf: "center" }}>
          {formations ? `${formations.length} Einträge (Seite ${page + 1})` : ""}
        </span>
      </div>

      {/* Table */}
      {isLoading && <div style={{ color: "#94a3b8", padding: "20px 0" }}>Laden…</div>}
      {error && (
        <div style={{ color: "#b91c1c", padding: "12px 16px", background: "#fee2e2", borderRadius: 8 }}>
          Fehler: {(error as Error).message}
        </div>
      )}

      {formations && formations.length === 0 && (
        <div style={{ color: "#94a3b8", padding: "20px 0" }}>Keine Hindernisse gefunden.</div>
      )}

      {formations && formations.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                {["Name", "Eigentümer", "Status", "Kategorie", "Pylone", "Geändert", "Audit", ""].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {formations.map((f: CustomFormationRow) => (
                <tr
                  key={f.id}
                  style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ ...tdStyle, fontWeight: 600, color: "#111827" }}>
                    <span
                      title={f.id}
                      onClick={() => navigate(`/formations/${f.id}`)}
                      style={{ cursor: "pointer", textDecoration: "underline dotted", textUnderlineOffset: 3 }}
                    >
                      {f.name}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, color: "#64748b", fontSize: 12 }}>
                    {f.owner_email ?? "–"}
                  </td>
                  <td style={tdStyle}><StatusBadge status={f.status} /></td>
                  <td style={{ ...tdStyle, color: "#475569" }}>{CATEGORY_LABELS[f.category] ?? f.category}</td>
                  <td style={{ ...tdStyle, color: "#475569", textAlign: "center" }}>{f.pylon_count}</td>
                  <td style={{ ...tdStyle, color: "#94a3b8", whiteSpace: "nowrap" }}>
                    {new Date(f.updated_at).toLocaleDateString("de-DE")}
                  </td>
                  <td style={{ ...tdStyle, color: "#94a3b8", fontSize: 11, whiteSpace: "nowrap" }}>
                    {f.edited_by_admin_at ? (
                      <span title={`Admin: ${f.edited_by_admin_email ?? f.edited_by_admin_id ?? "–"}`}>
                        ✎ {new Date(f.edited_by_admin_at).toLocaleDateString("de-DE")}
                      </span>
                    ) : "–"}
                  </td>
                  <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      {/* Öffnen im Editor */}
                      <button
                        title="Im Editor öffnen"
                        onClick={() => navigate(`/formations/${f.id}`)}
                        style={iconBtnStyle}
                      >
                        <ExternalLink size={13} />
                      </button>

                      {/* In Bibliothek aufnehmen */}
                      {!f.is_library && (
                        <button
                          title="In Bibliothek aufnehmen"
                          onClick={() => setPromoteTarget({ id: f.id, name: f.name, category: f.category })}
                          style={{ ...iconBtnStyle, color: "#059669", borderColor: "#a7f3d0", background: "#ecfdf5" }}
                        >
                          <Library size={13} />
                        </button>
                      )}

                      {/* Löschen */}
                      <button
                        title="Löschen"
                        onClick={() => setDeleteTarget({ id: f.id, name: f.name })}
                        style={{ ...iconBtnStyle, color: "#b91c1c", borderColor: "#fecaca", background: "#fff1f2" }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginierung */}
      {formations && (
        <div style={{ display: "flex", gap: 8, marginTop: 16, alignItems: "center" }}>
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0 || isLoading}
            style={cancelBtnStyle}
          >
            ← Zurück
          </button>
          <span style={{ fontSize: 13, color: "#64748b" }}>Seite {page + 1}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={formations.length < PAGE_SIZE || isLoading}
            style={cancelBtnStyle}
          >
            Weiter →
          </button>
        </div>
      )}

      {/* Promote Dialog */}
      {promoteTarget && (
        <Dialog onClose={() => setPromoteTarget(null)}>
          <h2 style={dialogTitleStyle}>In Bibliothek aufnehmen</h2>
          <p style={{ fontSize: 14, color: "#374151", marginBottom: 16 }}>
            <strong>{promoteTarget.name}</strong> wird als Kopie in die öffentliche Bibliothek aufgenommen.
            Das Original bleibt beim Ersteller unverändert.
          </p>
          <label style={labelStyle}>Kategorie</label>
          <select
            value={promoteTarget.category}
            onChange={(e) => setPromoteTarget({ ...promoteTarget, category: e.target.value })}
            style={{ ...selectStyle, width: "100%", marginBottom: 20 }}
          >
            {CATEGORY_OPTIONS.slice(1).map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => setPromoteTarget(null)} style={cancelBtnStyle}>Abbrechen</button>
            <button
              onClick={handlePromote}
              disabled={promoteMutation.isPending}
              style={confirmBtnStyle("#059669")}
            >
              {promoteMutation.isPending ? "Wird aufgenommen…" : "Aufnehmen"}
            </button>
          </div>
          {promoteMutation.error && (
            <div style={errorStyle}>{(promoteMutation.error as Error).message}</div>
          )}
        </Dialog>
      )}

      {/* Delete Dialog */}
      {deleteTarget && (
        <Dialog onClose={() => setDeleteTarget(null)}>
          <h2 style={dialogTitleStyle}>Hindernis löschen</h2>
          <p style={{ fontSize: 14, color: "#374151", marginBottom: 20 }}>
            <strong>{deleteTarget.name}</strong> wirklich unwiderruflich löschen?
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => setDeleteTarget(null)} style={cancelBtnStyle}>Abbrechen</button>
            <button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              style={confirmBtnStyle("#b91c1c")}
            >
              {deleteMutation.isPending ? "Wird gelöscht…" : "Löschen"}
            </button>
          </div>
          {deleteMutation.error && (
            <div style={errorStyle}>{(deleteMutation.error as Error).message}</div>
          )}
        </Dialog>
      )}
    </div>
  );
}

// --- Dialog Wrapper ---

function Dialog({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "white", borderRadius: 12, padding: 24, minWidth: 340, maxWidth: 460,
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

// --- Styles ---

const thStyle: React.CSSProperties = {
  padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 700,
  color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 12px", verticalAlign: "middle",
};

const selectStyle: React.CSSProperties = {
  fontSize: 13, border: "1px solid #e2e8f0", borderRadius: 7, padding: "6px 10px",
  background: "white", color: "#374151", cursor: "pointer",
};

const iconBtnStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0", background: "white", borderRadius: 6, padding: "4px 7px",
  cursor: "pointer", color: "#374151", display: "flex", alignItems: "center",
};

const dialogTitleStyle: React.CSSProperties = {
  margin: "0 0 12px", fontSize: 16, fontWeight: 700, color: "#111827",
};

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6,
};

const cancelBtnStyle: React.CSSProperties = {
  padding: "8px 16px", borderRadius: 7, border: "1px solid #e2e8f0", background: "white",
  fontSize: 13, cursor: "pointer", color: "#374151",
};

function confirmBtnStyle(bg: string): React.CSSProperties {
  return {
    padding: "8px 16px", borderRadius: 7, border: "none", background: bg,
    fontSize: 13, fontWeight: 600, cursor: "pointer", color: "white",
  };
}

const errorStyle: React.CSSProperties = {
  marginTop: 12, fontSize: 12, color: "#b91c1c", background: "#fee2e2",
  borderRadius: 6, padding: "8px 12px",
};
