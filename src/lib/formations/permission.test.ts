// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

import { describe, it, expect } from "vitest";
import { resolveFormationAccess, isAccessDenied } from "./permission";

const ME = "user-me";
const OTHER = "user-other";

describe("resolveFormationAccess", () => {
  it("Owner: volle Bearbeitung, kein Read-only", () => {
    const r = resolveFormationAccess({ isEdit: true, isAdmin: false, permission: "owner", ownerId: ME, currentUserId: ME });
    expect(r).toEqual({ effectivePermission: "owner", isReadOnly: false, isAdminForeignFormation: false });
  });

  it("Explizites Edit-Share: Bearbeitung erlaubt, kein Admin-Foreign-Flag", () => {
    const r = resolveFormationAccess({ isEdit: true, isAdmin: false, permission: "edit", ownerId: OTHER, currentUserId: ME });
    expect(r).toEqual({ effectivePermission: "edit", isReadOnly: false, isAdminForeignFormation: false });
  });

  it("Explizites View-Share: Read-only", () => {
    const r = resolveFormationAccess({ isEdit: true, isAdmin: false, permission: "view", ownerId: OTHER, currentUserId: ME });
    expect(r).toEqual({ effectivePermission: "view", isReadOnly: true, isAdminForeignFormation: false });
  });

  it("Library-Formation ohne Share (RPC liefert 'view'): Read-only für normale Nutzer", () => {
    const r = resolveFormationAccess({ isEdit: true, isAdmin: false, permission: "view", ownerId: OTHER, currentUserId: ME });
    expect(r.isReadOnly).toBe(true);
    expect(r.isAdminForeignFormation).toBe(false);
  });

  it("Private fremde Formation ohne Share (permission=null): kein Read-only-Zustand, aber isAccessDenied greift separat", () => {
    const r = resolveFormationAccess({ isEdit: true, isAdmin: false, permission: null, ownerId: OTHER, currentUserId: ME });
    expect(r.effectivePermission).toBeNull();
    expect(r.isReadOnly).toBe(false);
  });

  it("Admin auf fremder Library-Formation: voller Edit-Override statt Read-only", () => {
    const r = resolveFormationAccess({ isEdit: true, isAdmin: true, permission: "view", ownerId: OTHER, currentUserId: ME });
    expect(r).toEqual({ effectivePermission: "edit", isReadOnly: false, isAdminForeignFormation: true });
  });

  it("Admin auf fremder privater Formation (permission=null): voller Edit-Override", () => {
    const r = resolveFormationAccess({ isEdit: true, isAdmin: true, permission: null, ownerId: OTHER, currentUserId: ME });
    expect(r).toEqual({ effectivePermission: "edit", isReadOnly: false, isAdminForeignFormation: true });
  });

  it("Admin auf verwaister Formation (owner_id=null): zählt als fremd, Edit-Override greift", () => {
    const r = resolveFormationAccess({ isEdit: true, isAdmin: true, permission: "view", ownerId: null, currentUserId: ME });
    expect(r).toEqual({ effectivePermission: "edit", isReadOnly: false, isAdminForeignFormation: true });
  });

  it("Admin auf eigener Formation: kein Foreign-Flag, Permission bleibt 'owner'", () => {
    const r = resolveFormationAccess({ isEdit: true, isAdmin: true, permission: "owner", ownerId: ME, currentUserId: ME });
    expect(r).toEqual({ effectivePermission: "owner", isReadOnly: false, isAdminForeignFormation: false });
  });

  it("Neue Formation (isEdit=false): kein Admin-Foreign-Flag, auch wenn Admin", () => {
    const r = resolveFormationAccess({ isEdit: false, isAdmin: true, permission: undefined, ownerId: undefined, currentUserId: ME });
    expect(r.isAdminForeignFormation).toBe(false);
    expect(r.isReadOnly).toBe(false);
  });
});

describe("isAccessDenied", () => {
  it("Nicht-Admin ohne Permission: Zugriff verweigert", () => {
    expect(isAccessDenied({ isAdmin: false, permission: null })).toBe(true);
  });

  it("Nicht-Admin mit view/edit/owner: Zugriff erlaubt", () => {
    expect(isAccessDenied({ isAdmin: false, permission: "view" })).toBe(false);
    expect(isAccessDenied({ isAdmin: false, permission: "edit" })).toBe(false);
    expect(isAccessDenied({ isAdmin: false, permission: "owner" })).toBe(false);
  });

  it("Admin: nie verweigert, unabhängig von permission", () => {
    expect(isAccessDenied({ isAdmin: true, permission: null })).toBe(false);
  });
});
