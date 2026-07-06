// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useSharedTrack } from "../features/track-share/hooks/useSharedTrack";
import { generateTrackSVG, type PdfMapConfig } from "../lib/exportSVG";
import type { AreaSelection } from "../lib/areaSelection";

// Rendert das SVG über ein <img data:...>-Element statt via
// dangerouslySetInnerHTML: generateTrackSVG() interpoliert Freitext
// (Custom-Formation-Label) ungeschützt in das SVG. Als direktes DOM-Element
// wäre das ein Stored-XSS-Risiko für anonyme Besucher dieser Seite — als
// Bildquelle führt der Browser darin enthaltene <script>/Event-Handler nie aus.
function svgToImgSrc(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export default function SharedTrackPage() {
  const { token } = useParams<{ token: string }>();
  const { data, isLoading, error } = useSharedTrack(token);

  const imgSrc = useMemo(() => {
    if (!data) return null;
    const mapConfig: PdfMapConfig | null = data.area_sel_json
      ? { selection: data.area_sel_json as AreaSelection, satellite: data.map_satellite, opacity: data.map_opacity }
      : null;
    const svg = generateTrackSVG(
      data.manual_width, data.manual_length,
      data.state_json.items, data.state_json.arrows,
      mapConfig
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
