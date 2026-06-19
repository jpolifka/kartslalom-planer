// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ImprintContent } from "../components/ImprintContent";

export default function ImpressumPage() {
  const { hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      el?.scrollIntoView({ behavior: "smooth" });
    }
  }, [hash]);

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", padding: "32px 16px", boxSizing: "border-box" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", background: "white", borderRadius: 16, padding: 32, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Impressum</h2>
          <Link to="/editor/new" style={{ fontSize: 13, color: "#2F6C40" }}>← Zurück zum Planer</Link>
        </div>
        <ImprintContent />
      </div>
    </div>
  );
}
