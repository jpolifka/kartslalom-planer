// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useCustomFormation } from "../hooks/useCustomFormations";
import {
  useFormationShares,
  useShareFormation,
  useUnshareFormation,
  useFindShareableUser,
} from "../hooks/useCustomFormations";

// ACHTUNG — nicht mit den öffentlichen Track-Share-Links (/share/:token,
// siehe SharedTrackPage.tsx) verwechseln, das ist ein anderes Feature:
// Hier teilt der Eigentümer eine EIGENE Formation gezielt mit einem
// bestimmten, per E-Mail gesuchten Nutzer-Account (find_shareable_user)
// und vergibt ein Lese- oder Bearbeitungsrecht (share_custom_formation /
// unshare_custom_formation). Es gibt keinen anonymen Link, kein Login-loses
// Ansehen — der Empfänger muss selbst ein Konto haben und eingeloggt sein.
// Track-Share-Links dagegen sind token-basiert, anonym und read-only für
// jeden mit dem Link, unabhängig von einem Nutzerkonto.
const s: Record<string, React.CSSProperties> = {
  page: { maxWidth: 560, margin: "0 auto", padding: "28px 20px", fontFamily: "system-ui, sans-serif" },
  title: { fontSize: 20, fontWeight: 800, color: "#111827", margin: "0 0 4px" },
  sub: { fontSize: 13, color: "#6b7280", margin: "0 0 28px" },
  card: { background: "white", borderRadius: 12, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.07)", marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 12 },
  row: { display: "flex", gap: 8, alignItems: "center" },
  input: { flex: 1, padding: "8px 10px", fontSize: 14, border: "1px solid #d1d5db", borderRadius: 8, outline: "none" },
  btn: { padding: "8px 14px", fontSize: 13, fontWeight: 600, border: "none", borderRadius: 8, cursor: "pointer", background: "var(--c-primary)", color: "white" },
  btnSm: { padding: "4px 10px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer", background: "white" },
  btnDanger: { padding: "4px 10px", fontSize: 12, border: "1px solid #fecaca", borderRadius: 6, cursor: "pointer", background: "white", color: "#b91c1c" },
  shareRow: { display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid #f3f4f6" },
  badge: { fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 4 },
  permSelect: { fontSize: 12, border: "1px solid #d1d5db", borderRadius: 6, padding: "3px 6px", cursor: "pointer" },
};

export default function FormationSharePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: formation, isLoading: formationLoading } = useCustomFormation(id);
  const { data: shares, isLoading: sharesLoading } = useFormationShares(id);
  const shareMutation = useShareFormation();
  const unshareMutation = useUnshareFormation();
  const findUser = useFindShareableUser();

  const [query, setQuery] = useState("");
  const [foundUser, setFoundUser] = useState<{ id: string; email: string } | null | "not_found">(null);
  const [permission, setPermission] = useState<"view" | "edit">("view");
  const [shareError, setShareError] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setFoundUser(null);
    setShareError(null);
    const result = await findUser.mutateAsync(query.trim());
    setFoundUser(result ?? "not_found");
  }

  async function handleShare() {
    if (!id || !foundUser || foundUser === "not_found") return;
    setShareError(null);
    try {
      await shareMutation.mutateAsync({ formationId: id, targetId: foundUser.id, permission });
      setQuery("");
      setFoundUser(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "SHARE_WITH_SELF") setShareError("Du kannst nicht mit dir selbst teilen.");
      else if (msg === "TARGET_NOT_FOUND") setShareError("Nutzer nicht gefunden.");
      else setShareError("Fehler beim Teilen.");
    }
  }

  async function handleUnshare(targetId: string) {
    if (!id) return;
    await unshareMutation.mutateAsync({ formationId: id, targetId });
  }

  async function handlePermissionChange(targetId: string, perm: "view" | "edit") {
    if (!id) return;
    // Rechteänderung läuft über dieselbe share-RPC wie das Neu-Teilen —
    // ein bestehender Share wird per Upsert einfach mit neuer permission
    // überschrieben, es gibt keine separate "update"-Mutation.
    await shareMutation.mutateAsync({ formationId: id, targetId, permission: perm });
  }

  if (formationLoading) return <div style={{ padding: 40, color: "#6b7280" }}>Lädt…</div>;
  if (!formation) return <div style={{ padding: 40, color: "#ef4444" }}>Hindernis nicht gefunden.</div>;

  return (
    <div style={s.page}>
      <button onClick={() => navigate(`/formations/${id}`)} style={{ ...s.btnSm, marginBottom: 16 }}>
        ← Zurück
      </button>
      <h2 style={s.title}>Teilen: {formation.name}</h2>
      <p style={s.sub}>Teile dieses Hindernis mit anderen Nutzern.</p>

      {/* Nutzer suchen + hinzufügen */}
      <div style={s.card}>
        <div style={s.sectionTitle}>Nutzer hinzufügen</div>
        <form onSubmit={handleSearch} style={{ ...s.row, marginBottom: 8 }}>
          <input
            style={s.input}
            type="email"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setFoundUser(null); setShareError(null); }}
            placeholder="E-Mail-Adresse"
          />
          <button type="submit" style={s.btn} disabled={findUser.isPending}>
            {findUser.isPending ? "Suche…" : "Suchen"}
          </button>
        </form>

        {foundUser === "not_found" && (
          <div style={{ fontSize: 13, color: "#ef4444" }}>Kein Nutzer gefunden.</div>
        )}

        {foundUser && foundUser !== "not_found" && (
          <div style={{ ...s.row, marginTop: 8, padding: "10px 12px", background: "#f0fdf4", borderRadius: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, flex: 1, color: "#166534" }}>
              {foundUser.email}
            </span>
            <select
              style={s.permSelect}
              value={permission}
              onChange={(e) => setPermission(e.target.value as "view" | "edit")}
            >
              <option value="view">Lesen</option>
              <option value="edit">Bearbeiten</option>
            </select>
            <button style={s.btn} onClick={handleShare} disabled={shareMutation.isPending}>
              {shareMutation.isPending ? "…" : "Teilen"}
            </button>
          </div>
        )}

        {shareError && <div style={{ fontSize: 13, color: "#ef4444", marginTop: 6 }}>{shareError}</div>}
      </div>

      {/* Aktuelle Shares */}
      <div style={s.card}>
        <div style={s.sectionTitle}>Aktuell geteilt mit</div>
        {sharesLoading && <div style={{ fontSize: 13, color: "#9ca3af" }}>Lädt…</div>}
        {!sharesLoading && (!shares || shares.length === 0) && (
          <div style={{ fontSize: 13, color: "#9ca3af" }}>Noch mit niemandem geteilt.</div>
        )}
        {shares?.map((share) => (
          <div key={share.shared_with_id} style={s.shareRow}>
            <span style={{ flex: 1, fontSize: 14, color: "#111827" }}>
              {share.email}
            </span>
            <select
              style={s.permSelect}
              value={share.permission}
              onChange={(e) => handlePermissionChange(share.shared_with_id, e.target.value as "view" | "edit")}
              disabled={shareMutation.isPending}
            >
              <option value="view">Lesen</option>
              <option value="edit">Bearbeiten</option>
            </select>
            <button
              style={s.btnDanger}
              onClick={() => handleUnshare(share.shared_with_id)}
              disabled={unshareMutation.isPending}
            >
              Entfernen
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
