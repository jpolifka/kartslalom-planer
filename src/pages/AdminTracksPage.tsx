// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trash2, ExternalLink, Map } from "lucide-react";
import { useAdminTrackList, useAdminDeleteTrack } from "../hooks/useTracks";
import type { AdminTrackRow } from "../lib/api/tracks";

type DeleteTarget = { id: string; name: string };

export default function AdminTracksPage() {
  const navigate = useNavigate();
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const { data: tracks, isLoading, error } = useAdminTrackList();
  const deleteMutation = useAdminDeleteTrack();

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteMutation.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <Map size={22} color="#6366f1" />
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#111827" }}>
          Admin — Strecken
        </h1>
        <span style={{ fontSize: 13, color: "#94a3b8", alignSelf: "center" }}>
          {tracks ? `${tracks.length} Einträge` : ""}
        </span>
      </div>

      {isLoading && <div style={{ color: "#94a3b8", padding: "20px 0" }}>Laden…</div>}
      {error && (
        <div style={{ color: "#b91c1c", padding: "12px 16px", background: "#fee2e2", borderRadius: 8 }}>
          Fehler: {(error as Error).message}
        </div>
      )}

      {tracks && tracks.length === 0 && (
        <div style={{ color: "#94a3b8", padding: "20px 0" }}>Keine Strecken gefunden.</div>
      )}

      {tracks && tracks.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                {["Name", "Eigentümer", "Größe", "Öffentlich", "Geändert", ""].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tracks.map((t: AdminTrackRow) => (
                <tr
                  key={t.id}
                  style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer" }}
                  onClick={() => navigate(`/editor/${t.id}`)}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ ...tdStyle, fontWeight: 600, color: "#111827" }}>
                    {t.name}
                  </td>
                  <td style={{ ...tdStyle, color: "#64748b", fontFamily: "monospace", fontSize: 11 }}>
                    {t.owner_id ? t.owner_id.slice(0, 8) + "…" : "–"}
                  </td>
                  <td style={{ ...tdStyle, color: "#475569", whiteSpace: "nowrap" }}>
                    {t.manual_width} × {t.manual_length} m
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    {t.is_public ? (
                      <span style={{ fontSize: 11, fontWeight: 600, background: "#d1fae5", color: "#065f46", padding: "2px 8px", borderRadius: 99 }}>
                        Ja
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>–</span>
                    )}
                  </td>
                  <td style={{ ...tdStyle, color: "#94a3b8", whiteSpace: "nowrap" }}>
                    {new Date(t.updated_at).toLocaleDateString("de-DE")}
                  </td>
                  <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        title="Im Editor öffnen (Lesezugriff)"
                        onClick={(e) => { e.stopPropagation(); navigate(`/editor/${t.id}`); }}
                        style={iconBtnStyle}
                      >
                        <ExternalLink size={13} />
                      </button>
                      <button
                        title="Löschen"
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: t.id, name: t.name }); }}
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

      {/* Delete Dialog */}
      {deleteTarget && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => setDeleteTarget(null)}
        >
          <div
            style={{ background: "white", borderRadius: 12, padding: 24, minWidth: 340, maxWidth: 460, boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700, color: "#111827" }}>Strecke löschen</h2>
            <p style={{ fontSize: 14, color: "#374151", marginBottom: 20 }}>
              <strong>{deleteTarget.name}</strong> wirklich unwiderruflich löschen?
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setDeleteTarget(null)}
                style={{ padding: "8px 16px", borderRadius: 7, border: "1px solid #e2e8f0", background: "white", fontSize: 13, cursor: "pointer", color: "#374151" }}
              >
                Abbrechen
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                style={{ padding: "8px 16px", borderRadius: 7, border: "none", background: "#b91c1c", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "white" }}
              >
                {deleteMutation.isPending ? "Wird gelöscht…" : "Löschen"}
              </button>
            </div>
            {deleteMutation.error && (
              <div style={{ marginTop: 12, fontSize: 12, color: "#b91c1c", background: "#fee2e2", borderRadius: 6, padding: "8px 12px" }}>
                {(deleteMutation.error as Error).message}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 700,
  color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 12px", verticalAlign: "middle",
};

const iconBtnStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0", background: "white", borderRadius: 6, padding: "4px 7px",
  cursor: "pointer", color: "#374151", display: "flex", alignItems: "center",
};
