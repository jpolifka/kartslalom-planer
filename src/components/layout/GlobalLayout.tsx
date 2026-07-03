// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { Outlet } from "react-router-dom";
import GlobalNav from "./GlobalNav";
import { useProfile } from "../../hooks/useProfile";

export default function GlobalLayout() {
  useProfile(); // Profil global laden — auch außerhalb AppShell verfügbar

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#f1f5f9" }}>
      <GlobalNav />
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <Outlet />
      </div>
    </div>
  );
}
