// Kartslalom Streckenplaner
// Copyright (c) Jens Polifka
// All rights reserved.

export type FormationPermission = "owner" | "edit" | "view" | null | undefined;

export type FormationAccess = {
  effectivePermission: FormationPermission;
  isReadOnly: boolean;
  // true, wenn ein Admin gerade eine fremde Formation bearbeitet — steuert, ob
  // admin_update_custom_formation (kennt keine Owner/Share-Beschraenkung) statt
  // update_custom_formation (nur Owner/Edit-Share) aufgerufen werden muss.
  isAdminForeignFormation: boolean;
};

// Zentrale Zugriffslogik fuer den Formation-Editor. get_my_formation_permission
// liefert 'owner' | 'edit' | 'view' | null (Owner, Share, oder seit der Library-
// Erweiterung auch is_library=true als 'view'). Admins duerfen zusaetzlich jede
// fremde Formation bearbeiten, weil admin_update_custom_formation nur die Admin-
// Rolle prueft, keine Owner/Share-Beziehung.
//
// Rechte-Hierarchie (schwaechste zuerst): null (kein Zugriff, ausser Admin) < view
// (nur lesen, z. B. Library-Formation ohne expliziten Edit-Share) < edit (Bearbeitung
// per Share erlaubt) < owner (volle Kontrolle, eigene Formation). Ein Admin bekommt
// unabhaengig von der eigentlichen Permission immer effektiv "edit" auf fremde
// Formationen, weil er sonst Library-/Moderations-Aufgaben (z. B. eingereichte
// Formationen pruefen/korrigieren) nicht erledigen koennte.
export function resolveFormationAccess(params: {
  isEdit: boolean;
  isAdmin: boolean;
  permission: FormationPermission;
  ownerId: string | null | undefined;
  currentUserId: string | undefined;
}): FormationAccess {
  const { isEdit, isAdmin, permission, ownerId, currentUserId } = params;
  const isAdminForeignFormation = isEdit && isAdmin && ownerId !== currentUserId;
  const effectivePermission = isAdminForeignFormation ? "edit" : permission;
  const isReadOnly = effectivePermission === "view";
  return { effectivePermission, isReadOnly, isAdminForeignFormation };
}

// Zugriffs-Guard: blockiert nur Nicht-Admins ohne jegliche RPC-Permission
// (kein Owner, kein Share, keine Library-Mitgliedschaft).
export function isAccessDenied(params: { isAdmin: boolean; permission: FormationPermission }): boolean {
  return !params.isAdmin && params.permission === null;
}
