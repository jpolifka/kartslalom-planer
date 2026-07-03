// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { useLocation } from "react-router-dom";
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
    <div style={{ padding: "32px 16px", boxSizing: "border-box" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", background: "white", borderRadius: 16, padding: 32, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 800 }}>Impressum</h2>
        <ImprintContent />
      </div>
    </div>
  );
}
