// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useSharedTrack } from "../features/track-share/hooks/useSharedTrack";
import { generateTrackSVG } from "../lib/exportSVG";

// Rendert das SVG über ein <img data:...>-Element statt via
// dangerouslySetInnerHTML: generateTrackSVG() interpoliert Freitext
// (Custom-Formation-Label) ungeschützt in das SVG. Als direktes DOM-Element
// wäre das ein Stored-XSS-Risiko für anonyme Besucher dieser Seite — als
// Bildquelle führt der Browser darin enthaltene <script>/Event-Handler nie aus.
function svgToImgSrc(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// Öffentliche, login-lose Nur-Lese-Ansicht einer geteilten Strecke unter
// /share/:token. Die Token-Prüfung passiert vollständig serverseitig per RPC
// get_track_by_share_token (anon darf sie laut Grants explizit ausführen);
// ungültige/abgelaufene/widerrufene Tokens liefern serverseitig einheitlich
// einen "token_invalid"-Fehler zurück (kein Unterschied nach außen, damit man
// per Trial-and-Error nichts über existierende Tokens erfährt). Zusätzlich
// serverseitiges Rate-Limiting pro Token/Stunde.
export default function SharedTrackPage() {
  const { token } = useParams<{ token: string }>();
  const { data, isLoading, error } = useSharedTrack(token);

  const imgSrc = useMemo(() => {
    if (!data) return null;
    // Bewusst ohne Kartenhintergrund (kein mapConfig) — siehe
    // docs/track-share-links.md (Kartenanbieter-Nutzungsbedingungen).
    // manual_width/manual_length sind hier bereits die effektive Feldgröße
    // (siehe SharedTrackDetail-Typ) — bei Strecken mit Kartenausschnitt NICHT
    // mehr die reinen 18x36-Manual-Defaults, sonst wäre die Skalierung falsch
    // und Items würden außerhalb der viewBox landen.
    const svg = generateTrackSVG(
      data.manual_width, data.manual_length,
      data.state_json.items, data.state_json.arrows
    );
    return svgToImgSrc(svg);
  }, [data]);

  if (isLoading) {
    return <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>Lädt…</div>;
  }

  if (error || !data) {
    const rateLimited = error instanceof Error && error.message === "RATE_LIMIT_EXCEEDED";
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
        {rateLimited
          ? "Zu viele Abrufe — bitte versuche es später erneut."
          : "Dieser Link ist ungültig oder wurde widerrufen."}
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", margin: 0 }}>{data.name}</h1>
        <span style={{ fontSize: 12, color: "#94a3b8" }}>Nur-Lese-Ansicht</span>
      </div>
      {imgSrc && (
        <img
          src={imgSrc}
          alt={`Streckenplan: ${data.name}`}
          style={{ width: "100%", height: "auto", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.1)", background: "white" }}
        />
      )}
    </div>
  );
}
