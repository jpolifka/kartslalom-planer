// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import AdminGuard from "./AdminGuard";

// --- Mocks ---

const mockSession = { user: { id: "u1" } };
let authState: { session: typeof mockSession | null } = { session: null };
let adminQueryState: { data: boolean | undefined; isLoading: boolean } = { data: undefined, isLoading: false };

vi.mock("../../store/authStore", () => ({
  useAuthStore: () => authState,
}));

vi.mock("../../hooks/useCustomFormations", () => ({
  useIsAdmin: () => adminQueryState,
}));

// Hilfsfunktion: rendert AdminGuard mit Routing-Kontext
function renderGuard() {
  return render(
    <MemoryRouter initialEntries={["/admin/formations"]}>
      <Routes>
        <Route element={<AdminGuard />}>
          <Route path="/admin/formations" element={<div>Admin-Inhalt</div>} />
        </Route>
        <Route path="/login" element={<div>Login</div>} />
        <Route path="/dashboard" element={<div>Dashboard</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  authState = { session: null };
  adminQueryState = { data: undefined, isLoading: false };
  vi.clearAllMocks();
});

describe("AdminGuard", () => {
  it("leitet nicht-eingeloggte Nutzer zu /login weiter", () => {
    authState = { session: null };
    renderGuard();
    expect(screen.getByText("Login")).toBeInTheDocument();
    expect(screen.queryByText("Admin-Inhalt")).not.toBeInTheDocument();
  });

  it("zeigt Ladeindikator wenn RPC-Ergebnis aussteht", () => {
    authState = { session: mockSession };
    adminQueryState = { data: undefined, isLoading: true };
    renderGuard();
    expect(screen.getByText("Laden…")).toBeInTheDocument();
    expect(screen.queryByText("Admin-Inhalt")).not.toBeInTheDocument();
  });

  it("leitet Nicht-Admin zu /dashboard weiter (isAdmin=false)", () => {
    authState = { session: mockSession };
    adminQueryState = { data: false, isLoading: false };
    renderGuard();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.queryByText("Admin-Inhalt")).not.toBeInTheDocument();
  });

  it("zeigt Admin-Inhalt wenn isAdmin=true", () => {
    authState = { session: mockSession };
    adminQueryState = { data: true, isLoading: false };
    renderGuard();
    expect(screen.getByText("Admin-Inhalt")).toBeInTheDocument();
    expect(screen.queryByText("Login")).not.toBeInTheDocument();
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });
});
