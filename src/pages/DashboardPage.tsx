// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { useNavigate } from "react-router-dom";
import React, { useState } from "react";
import { Plus, Trash2, MapPin, Pencil, Check, X } from "lucide-react";
import { useTrackList, useCreateTrack, useDeleteTrack, useRenameTrack } from "../hooks/useTracks";
import { useTier } from "../hooks/useTier";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data: tracks, isLoading } = useTrackList();
  const createTrackMutation = useCreateTrack();
  const deleteTrackMutation = useDeleteTrack();
  const renameTrackMutation = useRenameTrack();
  const { trackLimit } = useTier();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

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
    if (!confirm(`Strecke „${name}” wirklich löschen?`)) return;
    await deleteTrackMutation.mutateAsync(id);
  }

  function startRename(id: string, currentName: string) {
    setRenamingId(id);
    setRenameValue(currentName);
  }

  async function commitRename() {
    if (!renamingId) return;
    const trimmed = renameValue.trim();
    if (trimmed) await renameTrackMutation.mutateAsync({ id: renamingId, name: trimmed });
    setRenamingId(null);
  }

  function cancelRename() {
    setRenamingId(null);
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
            border: "none", borderRadius: 10, background: limitReached ? "#cbd5e1" : "#2F6C40",
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
              <MapPin size={18} color="#2F6C40" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                {renamingId === track.id ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename();
                        if (e.key === "Escape") cancelRename();
                      }}
                      style={{
                        fontSize: 14, fontWeight: 700, border: "1px solid #0284c7",
                        borderRadius: 6, padding: "3px 7px", outline: "none", minWidth: 160,
                      }}
                    />
                    <button onClick={commitRename} style={iconActionBtn} title="Speichern">
                      <Check size={13} color="#16a34a" />
                    </button>
                    <button onClick={cancelRename} style={iconActionBtn} title="Abbrechen">
                      <X size={13} color="#64748b" />
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div
                      style={{ fontWeight: 700, fontSize: 14, cursor: "pointer" }}
                      onClick={() => navigate(`/editor/${track.id}`)}
                    >
                      {track.name}
                    </div>
                    <button
                      onClick={() => startRename(track.id, track.name)}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        border: "1px solid #bae6fd", background: "#edf4de",
                        borderRadius: 6, padding: "3px 8px", cursor: "pointer",
                        color: "#2F6C40", fontSize: 11, fontWeight: 600, flexShrink: 0,
                      }}
                      title="Umbenennen"
                    >
                      <Pencil size={11} /> Umbenennen
                    </button>
                  </div>
                )}
                <div
                  style={{ fontSize: 12, color: "#94a3b8", cursor: renamingId === track.id ? "default" : "pointer" }}
                  onClick={renamingId === track.id ? undefined : () => navigate(`/editor/${track.id}`)}
                >
                  {track.manual_width} × {track.manual_length} m · zuletzt geändert{" "}
                  {new Date(track.updated_at).toLocaleString("de-DE")}
                </div>
              </div>
              <button
                onClick={() => handleDelete(track.id, track.name)}
                style={{
                  border: "1px solid #fecaca", background: "white", borderRadius: 8,
                  padding: 7, cursor: "pointer", color: "#b91c1c", display: "flex", flexShrink: 0,
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

const iconActionBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  border: "1px solid #e2e8f0", background: "white", borderRadius: 6,
  padding: 4, cursor: "pointer", flexShrink: 0,
};
