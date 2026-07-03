// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { Outlet } from "react-router-dom";

// AppShell: Content-Wrapper für Auth-Routen (Dashboard, Settings, Formations).
// Navigation ist jetzt in GlobalLayout/GlobalNav.
export default function AppShell() {
  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
      <Outlet />
    </div>
  );
}
