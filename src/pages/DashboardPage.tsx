// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { useNavigate } from "react-router-dom";
import { Plus, Trash2, MapPin } from "lucide-react";
import { useTrackList, useCreateTrack, useDeleteTrack } from "../hooks/useTracks";
import { useTier } from "../hooks/useTier";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data: tracks, isLoading } = useTrackList();
  const createTrackMutation = useCreateTrack();
  const deleteTrackMutation = useDeleteTrack();
  const { trackLimit } = useTier();

  const limitReached = !!tracks && tracks.length >= trackLimit;

  async function handleCreate() {
    try {
      const id = await createTrackMutation.mutateAsync(undefined);
      navigate(`/editor/${id}`);
    } catch (err) {
      if (err instanceof Error && err.message === "TRACK_LIMIT_REACHED") {
        alert("Du hast die maximale Anzahl an Strecken für deinen Tarif erreicht.");
        return;
      }
      alert("Strecke konnte nicht erstellt werden.");
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Strecke „${name}“ wirklich löschen?`)) return;
    await deleteTrackMutation.mutateAsync(id);
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Meine Strecken</h2>
        <button
          onClick={handleCreate}
          disabled={createTrackMutation.isPending || limitReached}
          title={limitReached ? "Limit für deinen Tarif erreicht" : undefined}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            border: "none", borderRadius: 10, background: limitReached ? "#cbd5e1" : "#0284c7",
            color: "white", padding: "9px 14px", fontSize: 13, fontWeight: 700,
            cursor: limitReached ? "not-allowed" : "pointer",
          }}
        >
          <Plus size={15} /> Neue Strecke
        </button>
      </div>

      {limitReached && (
        <div style={{
          background: "#fffbeb", border: "1px solid #fde68a",
          borderRadius: 10, padding: "10px 12px", fontSize: 13, color: "#92400e",
          marginBottom: 14,
        }}>
          Du hast die maximale Anzahl an Strecken für deinen Tarif erreicht.
        </div>
      )}

      {isLoading && <div style={{ color: "#94a3b8", fontSize: 13 }}>Lädt…</div>}

      {!isLoading && tracks?.length === 0 && (
        <div style={{
          background: "white", borderRadius: 16, padding: 24,
          textAlign: "center", color: "#64748b", fontSize: 13,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}>
          Noch keine Strecken vorhanden. Lege deine erste Strecke an.
        </div>
      )}

      {!!tracks?.length && (
        <div style={{ display: "grid", gap: 10 }}>
          {tracks.map((track) => (
            <div
              key={track.id}
              style={{
                background: "white", borderRadius: 14, padding: "14px 16px",
                display: "flex", alignItems: "center", gap: 12,
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              }}
            >
              <MapPin size={18} color="#0284c7" />
              <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => navigate(`/editor/${track.id}`)}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{track.name}</div>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>
                  {track.manual_width} × {track.manual_length} m · zuletzt geändert{" "}
                  {new Date(track.updated_at).toLocaleString("de-DE")}
                </div>
              </div>
              <button
                onClick={() => handleDelete(track.id, track.name)}
                style={{
                  border: "1px solid #fecaca", background: "white", borderRadius: 8,
                  padding: 7, cursor: "pointer", color: "#b91c1c", display: "flex",
                }}
                title="Strecke löschen"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
