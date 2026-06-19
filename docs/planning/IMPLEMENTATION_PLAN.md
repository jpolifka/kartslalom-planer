# Kartslalom SaaS — Implementierungsplan

**Version:** 2.3  
**Datum:** 2026-06-02  
**Zuletzt geändert:** 2026-06-19  
**Änderungen v2.1:** Korrekturen zu v2.0 — siehe Abschnitt "Korrekturen" am Ende.  
**Änderungen v2.2:** Phase 3 "Custom-Hindernisse" ergänzt (H0–H5 aus
`CUSTOM_FORMATIONS_PLAN.md` v1.2 integriert). Zahlungsmodell-Entscheidung in
Phase 2 dokumentiert.  
**Änderungen v2.3 (2026-06-19):** Account-Export = JSON (kein ZIP, bewusste Entscheidung).
Account-Löschung = Hard Delete (nicht Anonymisierung). Lifecycle-Funktion in Phase 1
voll aktiv (150/170/180-Tage-Mails + Soft-Delete); Datenschutz in Impressum/Datenschutz
Abschnitt 8 dokumentiert. Lifecycle-Cron via Supabase Dashboard Schedules (nicht GitHub Actions).  
**Referenz:** `SAAS_PLAN.md` v1.4, `CUSTOM_FORMATIONS_PLAN.md` v1.2

---

## Phasen-Überblick

```
PHASE 0   Saubere Basis       — Impressum/DDG, Security, Docker, Schema, RLS
PHASE 1   Login + Cloud Save  — Magic Link, Dashboard, Cloud Save via RPC, Limits
PHASE 2   Pro-Features        — Share-Links, PNG-Export, Versionshistorie (kein Stripe)
PHASE 3   Custom-Hindernisse  — WYSIWYG-Editor, Sharing, Admin, Library (H0–H5)
```

**Kernprinzip:** Kein direktes `.insert()` oder `.update()` auf sicherheitsrelevante Tabellen vom Client. Alle Schreiboperationen laufen durch SECURITY DEFINER Funktionen auf dem Server.

---

## PHASE 0 — Saubere Basis

**Ziel:** Rechtlich sicherer, technisch solider Unterbau. Gast-Modus bleibt vollständig erhalten.


### 0.5 Datenbank-Schema

SQL im Supabase SQL-Editor in dieser Reihenfolge ausführen.

**profiles** (nicht `users` — Verwechslung mit `auth.users` vermeiden)

```sql
create table public.profiles (
  id                      uuid primary key references auth.users(id) on delete cascade,
  email                   text not null,
  tier                    text not null default 'free'
                            check (tier in ('free', 'pro', 'team')),
  stripe_customer_id      text,
  stripe_subscription_id  text,
  stripe_status           text,
  last_active_at          timestamptz not null default now(),
  reminder_150_sent_at    timestamptz,
  reminder_170_sent_at    timestamptz,
  is_deleted              boolean not null default false,
  deleted_at              timestamptz,
  created_at              timestamptz not null default now()
);
```

**Trigger: Signup → profiles-Zeile**

```sql
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

**tracks**

```sql
create table public.tracks (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references public.profiles(id) on delete cascade,
  name             text not null default 'Neue Strecke',
  description      text,
  is_public        boolean not null default false,
  public_token_hash text unique,     -- SHA-256-Hash, Plaintext-Token nur einmalig zurückgeben
  state_json       jsonb not null default '{"items":[],"arrows":[]}',
  area_sel_json    jsonb,
  manual_width     numeric not null default 18,
  manual_length    numeric not null default 36,
  map_satellite    boolean not null default false,  -- Free/Gast: kein Satellite
  map_opacity      numeric not null default 0.5,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tracks_updated_at
  before update on public.tracks
  for each row execute procedure public.set_updated_at();
```

**track_versions** (Tabelle anlegen, UI kommt in Phase 2)

```sql
create table public.track_versions (
  id             uuid primary key default gen_random_uuid(),
  track_id       uuid not null references public.tracks(id) on delete cascade,
  version_number integer not null,
  state_json     jsonb not null,
  area_sel_json  jsonb,
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (track_id, version_number)
);

create index track_versions_by_track
  on public.track_versions(track_id, version_number desc);
```

### 0.6 Row Level Security

RLS aktivieren. Kernregel: **Client darf nur lesen. Alle Schreiboperationen gehen durch SECURITY DEFINER Funktionen.**

```sql
alter table public.profiles      enable row level security;
alter table public.tracks        enable row level security;
alter table public.track_versions enable row level security;
```

**profiles — nur lesen, kein direktes Schreiben**

```sql
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

-- Kein UPDATE-Policy. tier, stripe_*, is_deleted nur via service_role / Funktionen.
-- last_active_at via touch_last_active() (SECURITY DEFINER, s. u.)
```

**tracks — direktes INSERT und UPDATE gesperrt, nur via RPC**

```sql
-- Lesen: nur eigene Tracks
create policy "tracks_select_own" on public.tracks
  for select using (auth.uid() = owner_id);

-- Löschen: nur eigene Tracks (kein Feature-Bypass möglich, RLS reicht)
create policy "tracks_delete_own" on public.tracks
  for delete using (auth.uid() = owner_id);

-- INSERT und UPDATE für authenticated und anon sperren
-- Erstellen läuft via create_track() RPC
-- Speichern läuft via save_track() RPC
revoke insert, update on public.tracks from anon, authenticated;

-- Kein öffentliches SELECT via is_public — Zugriff nur via get_track_by_share_token() RPC (Phase 2)
```

**track_versions — alles via SECURITY DEFINER**

```sql
create policy "versions_select_own" on public.track_versions
  for select using (
    exists (select 1 from public.tracks t
            where t.id = track_id and t.owner_id = auth.uid())
  );

revoke insert, update on public.track_versions from anon, authenticated;
```

### 0.7 SECURITY DEFINER Funktionen

Diese Funktionen laufen mit Datenbankrechten und können daher REVOKE-Sperren und RLS umgehen — aber nur kontrolliert und mit eigenen Prüfungen.

**create_track — mit serverseitiger Limit-Prüfung**

```sql
create or replace function public.create_track(track_name text default 'Neue Strecke')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_tier    text;
  v_count   integer;
  v_limit   integer;
  v_new_id  uuid;
begin
  select tier into v_tier from public.profiles where id = auth.uid();

  v_limit := case v_tier
    when 'free' then 3
    when 'pro'  then 50
    when 'team' then 2147483647
    else 3
  end;

  select count(*) into v_count from public.tracks where owner_id = auth.uid();

  if v_count >= v_limit then
    raise exception 'track_limit_reached'
      using hint = v_tier, detail = v_limit::text;
  end if;

  insert into public.tracks (owner_id, name)
  values (auth.uid(), track_name)
  returning id into v_new_id;

  return v_new_id;
end;
$$;

grant execute on function public.create_track(text) to authenticated;
```

**save_track — mit Tier-Validierung**

Kein direktes `.update()` vom Client — diese Funktion ist der einzige Weg einen Track zu speichern. Sie prüft Ownership und verhindert Feature-Bypass (z. B. `map_satellite = true` für Free-User).

```sql
create or replace function public.save_track(
  p_track_id    uuid,
  p_state_json  jsonb,
  p_area_sel    jsonb,
  p_width       numeric,
  p_length      numeric,
  p_satellite   boolean,
  p_opacity     numeric
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_tier text;
begin
  -- Ownership prüfen — kein Zugriff auf fremde Tracks
  if not exists (
    select 1 from public.tracks where id = p_track_id and owner_id = auth.uid()
  ) then
    raise exception 'not_owner';
  end if;

  select tier into v_tier from public.profiles where id = auth.uid();

  -- Satellite nur für Pro/Team
  if p_satellite = true and v_tier = 'free' then
    raise exception 'satellite_requires_pro';
  end if;

  update public.tracks set
    state_json    = p_state_json,
    area_sel_json = p_area_sel,
    manual_width  = p_width,
    manual_length = p_length,
    map_satellite = p_satellite,
    map_opacity   = p_opacity
  where id = p_track_id and owner_id = auth.uid();

  -- last_active_at direkt hier aktualisieren (kein separater RPC-Call nötig)
  update public.profiles set last_active_at = now() where id = auth.uid();
end;
$$;

grant execute on function public.save_track(uuid, jsonb, jsonb, numeric, numeric, boolean, numeric)
  to authenticated;
```

**touch_last_active — für Aktionen ohne save_track (z. B. Export)**

```sql
create or replace function public.touch_last_active()
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set last_active_at = now() where id = auth.uid();
end;
$$;

grant execute on function public.touch_last_active() to authenticated;
```

### 0.8 RLS testen

`set local request.jwt.claims` ist in Supabase nicht zuverlässig — produktive Auth läuft anders. **Nicht als alleiniger Test verwenden.**

**Empfohlener Ansatz: echte Test-User im Supabase-Client**

```typescript
// test-rls.ts — lokal ausführen, nicht in Produktion
import { createClient } from "@supabase/supabase-js";

const clientA = createClient(URL, ANON_KEY);
const clientB = createClient(URL, ANON_KEY);

// User A und User B anlegen/einloggen (Magic Link in Testumgebung oder direkt über Admin API)
await clientA.auth.signInWithPassword({ email: "a@test.invalid", password: "testA" });
await clientB.auth.signInWithPassword({ email: "b@test.invalid", password: "testB" });

// Test 1: User A kann Track von User B nicht sehen
const trackId = await clientA.rpc("create_track", { track_name: "Track A" });
const { data } = await clientB.from("tracks").select().eq("id", trackId);
console.assert(data?.length === 0, "FAIL: User B sieht Track von User A");

// Test 2: User A kann tier nicht direkt hochsetzen
const { error } = await clientA.from("profiles").update({ tier: "pro" }).eq("id", userAId);
console.assert(error !== null, "FAIL: Direktes tier-Update möglich");

// Test 3: Vierter Track schlägt fehl
await clientA.rpc("create_track", { track_name: "Track 2" });
await clientA.rpc("create_track", { track_name: "Track 3" });
const { error: limitError } = await clientA.rpc("create_track", { track_name: "Track 4" });
console.assert(limitError?.message.includes("track_limit_reached"), "FAIL: Limit nicht durchgesetzt");

// Test 4: Direkter INSERT schlägt fehl
const { error: insertError } = await clientA.from("tracks").insert({ name: "Direct" });
console.assert(insertError !== null, "FAIL: Direkter INSERT möglich");

// Test 5: save_track mit map_satellite=true für Free-User schlägt fehl
const { error: satError } = await clientA.rpc("save_track", {
  p_track_id: trackId, p_satellite: true, /* ... */
});
console.assert(satError?.message.includes("satellite_requires_pro"), "FAIL: Satellite für Free möglich");
```

### 0.9 Definition of Done Phase 0

- [x] `/impressum` und `/datenschutz` erreichbar, DDG-konform
- [ ] Security Headers aktiv (`securityheaders.com` zeigt A oder B+)
- [ ] Docker-Build mit `nginx-unprivileged`, läuft ohne root
- [ ] Supabase-Projekt in Frankfurt, Auth konfiguriert
- [ ] Schema: `profiles`, `tracks`, `track_versions` ausgerollt
- [ ] RLS-Tests mit echten Supabase-Clients bestanden (alle 5 Tests)
- [ ] `create_track()` erzwingt Limit serverseitig
- [ ] `save_track()` blockt `map_satellite=true` für Free-User
- [ ] Direkter INSERT/UPDATE auf `tracks` von `authenticated` Role schlägt fehl
- [ ] Kein UPDATE-Policy auf `profiles` für Clients
- [ ] Gast-Modus: Editor, SVG-Export, PDF-Export ohne Login vollständig funktionsfähig

---

## PHASE 1 — Login + Cloud Save

**Ziel:** Nutzer können sich anmelden, Strecken in der Cloud speichern und ihren Account verwalten.  
**Nicht in Phase 1:** Stripe, Tier-Wechsel, Share-Links.

### 1.1 Dependencies installieren

```bash
npm install react-router-dom @tanstack/react-query zustand zod @supabase/supabase-js
```

### 1.2 Verzeichnisstruktur

```
src/
  main.tsx
  router.tsx

  pages/
    LoginPage.tsx
    AuthCallbackPage.tsx     ← Magic-Link-Redirect
    DashboardPage.tsx
    EditorPage.tsx           ← bisherige App.tsx, umgebaut
    SettingsPage.tsx

  components/
    auth/
      AuthGuard.tsx
    layout/
      AppShell.tsx

  lib/
    supabase.ts
    api/
      tracks.ts

  store/
    authStore.ts

  hooks/
    useTracks.ts
    useProfile.ts
```

### 1.3 Supabase Client

**`src/lib/supabase.ts`**

```typescript
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string
);
```

**`.env.local`** — in `.gitignore`

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### 1.4 Auth-Store

**`src/store/authStore.ts`**

```typescript
import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";

type Tier = "free" | "pro" | "team";

type Profile = { id: string; email: string; tier: Tier };

type AuthStore = {
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  setSession: (s: Session | null) => void;
  setProfile: (p: Profile | null) => void;
};

export const useAuthStore = create<AuthStore>((set) => ({
  session: null,
  profile: null,
  isLoading: true,
  setSession: (session) => set({ session, isLoading: false }),
  setProfile: (profile) => set({ profile }),
}));
```

### 1.5 main.tsx

```typescript
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { supabase } from "./lib/supabase";
import { useAuthStore } from "./store/authStore";
import AppRouter from "./router";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000 } },
});

supabase.auth.getSession().then(({ data: { session } }) => {
  useAuthStore.getState().setSession(session);
});

supabase.auth.onAuthStateChange((_event, session) => {
  useAuthStore.getState().setSession(session);
  if (!session) useAuthStore.getState().setProfile(null);
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AppRouter />
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
);
```

### 1.6 Router — inkl. /auth/callback

**`src/router.tsx`**

```typescript
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/authStore";
import LoginPage from "./pages/LoginPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import DashboardPage from "./pages/DashboardPage";
import EditorPage from "./pages/EditorPage";
import SettingsPage from "./pages/SettingsPage";
import AuthGuard from "./components/auth/AuthGuard";

export default function AppRouter() {
  const { isLoading } = useAuthStore();
  if (isLoading) return <div style={{ padding: 40 }}>Laden…</div>;

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />

      <Route element={<AuthGuard />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/editor/new" element={<EditorPage />} />
        <Route path="/editor/:trackId" element={<EditorPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
```

### 1.7 AuthCallbackPage — PKCE-Hinweis beachten

**`src/pages/AuthCallbackPage.tsx`**

```typescript
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    async function handleCallback() {
      // Supabase JS v2 nutzt für Magic Links standardmäßig PKCE:
      // Der Link enthält ?code=... (Query-Parameter), kein #fragment mehr.
      // exchangeCodeForSession() tauscht den Code gegen eine Session.
      //
      // Falls die genutzte Supabase-Version noch den alten Implicit Flow verwendet
      // (Token im URL-Fragment #access_token=...), reicht getSession().
      // Vor der Implementierung prüfen: Auth → Settings → "Use PKCE flow" in Supabase Dashboard.

      const code = new URLSearchParams(window.location.search).get("code");

      if (code) {
        // PKCE flow (Supabase JS v2 Standard)
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) console.error("Code exchange failed:", error.message);
      }
      // getSession() funktioniert für beide Flows und liefert die Session nach dem Exchange
      const { data: { session } } = await supabase.auth.getSession();
      navigate(session ? "/dashboard" : "/login", { replace: true });
    }

    handleCallback();
  }, [navigate]);

  return <div style={{ padding: 40 }}>Anmelden…</div>;
}
```

**`src/components/auth/AuthGuard.tsx`**

```typescript
import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";

export default function AuthGuard() {
  const { session } = useAuthStore();
  if (!session) return <Navigate to="/login" replace />;
  return <Outlet />;
}
```

### 1.8 Profil laden

**`src/hooks/useProfile.ts`**

```typescript
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../store/authStore";

export function useProfile() {
  const { session, setProfile } = useAuthStore();

  const query = useQuery({
    queryKey: ["profile", session?.user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, tier")
        .eq("id", session!.user.id)
        .single();
      if (error) throw error;
      return data as { id: string; email: string; tier: "free" | "pro" | "team" };
    },
    enabled: !!session,
  });

  useEffect(() => {
    if (query.data) setProfile(query.data);
  }, [query.data, setProfile]);

  return query;
}
```

`useProfile()` wird einmal in `AppShell.tsx` aufgerufen — danach ist `profile.tier` im Store verfügbar.

### 1.9 Track-API — ausschließlich via RPC

**`src/lib/api/tracks.ts`**

```typescript
import { supabase } from "../supabase";
import type { SavedState } from "../storage";

export type TrackRow = {
  id: string;
  name: string;
  updated_at: string;
  manual_width: number;
  manual_length: number;
};

export type TrackDetail = TrackRow & {
  state_json: { items: unknown[]; arrows: unknown[] };
  area_sel_json: unknown;
  map_satellite: boolean;
  map_opacity: number;
};

export async function fetchTracks(): Promise<TrackRow[]> {
  const { data, error } = await supabase
    .from("tracks")
    .select("id, name, updated_at, manual_width, manual_length")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchTrack(id: string): Promise<TrackDetail> {
  const { data, error } = await supabase
    .from("tracks")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

// Erstellen via RPC — serverseitiges Limit-Check
export async function createTrack(name = "Neue Strecke"): Promise<string> {
  const { data, error } = await supabase.rpc("create_track", { track_name: name });
  if (error) {
    if (error.message.includes("track_limit_reached")) throw new Error("TRACK_LIMIT_REACHED");
    throw error;
  }
  return data as string;
}

// Speichern via RPC — Ownership + Tier-Validierung serverseitig
// Kein direktes .from("tracks").update() — das wäre am Server vorbei
export async function saveTrack(
  id: string,
  state: Omit<SavedState, "version">
): Promise<void> {
  const { error } = await supabase.rpc("save_track", {
    p_track_id:   id,
    p_state_json: { items: state.items, arrows: state.arrows },
    p_area_sel:   state.areaSel,
    p_width:      state.manualWidth,
    p_length:     state.manualLength,
    p_satellite:  state.mapSatellite,
    p_opacity:    state.mapOpacity,
  });
  if (error) {
    if (error.message.includes("satellite_requires_pro")) throw new Error("SATELLITE_REQUIRES_PRO");
    if (error.message.includes("not_owner"))              throw new Error("NOT_OWNER");
    throw error;
  }
  // last_active_at wird in save_track() serverseitig gesetzt — kein separater touch_last_active() nötig
}

// Löschen: RLS reicht (kein Feature-Bypass möglich)
export async function deleteTrack(id: string): Promise<void> {
  const { error } = await supabase.from("tracks").delete().eq("id", id);
  if (error) throw error;
}
```

### 1.10 TanStack Query Hooks

**`src/hooks/useTracks.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchTracks, fetchTrack, createTrack, saveTrack, deleteTrack } from "../lib/api/tracks";
import { useAuthStore } from "../store/authStore";

export function useTrackList() {
  const { session } = useAuthStore();
  return useQuery({ queryKey: ["tracks"], queryFn: fetchTracks, enabled: !!session });
}

export function useTrack(id: string | undefined) {
  return useQuery({ queryKey: ["track", id], queryFn: () => fetchTrack(id!), enabled: !!id });
}

export function useCreateTrack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createTrack,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tracks"] }),
  });
}

export function useSaveTrack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, state }: { id: string; state: Parameters<typeof saveTrack>[1] }) =>
      saveTrack(id, state),
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: ["track", id] });
      qc.invalidateQueries({ queryKey: ["tracks"] });
    },
  });
}

export function useDeleteTrack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteTrack,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tracks"] }),
  });
}
```

### 1.11 Tier-Hook — nur für UX, nicht für Enforcement

```typescript
// src/hooks/useTier.ts
import { useAuthStore } from "../store/authStore";

const LIMITS = { free: 3, pro: 50, team: Infinity } as const;

// Nur für UX-Entscheidungen: Buttons deaktivieren, Hinweise zeigen.
// Das eigentliche Enforcement passiert auf dem Server in create_track() und save_track().
export function useTier() {
  const { profile } = useAuthStore();
  const tier = profile?.tier ?? "free";
  return {
    tier,
    isLoggedIn: !!profile,
    trackLimit: LIMITS[tier],
    canUseSatellite:     tier !== "free",
    canUsePolygonArea:   tier !== "free",
    canShareLinks:       tier !== "free",
    canUseVersionHistory: tier !== "free",
  };
}
```

### 1.12 Autosave im Editor

Gast-Modus (localStorage) und Cloud-Save koexistieren:

```typescript
// In EditorPage.tsx:
const { session } = useAuthStore();
const saveTrackMutation = useSaveTrack();

useEffect(() => {
  if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
  setSaveStatus("pending");

  saveTimerRef.current = setTimeout(async () => {
    if (session && trackId) {
      // Eingeloggter Nutzer → Cloud via RPC
      try {
        await saveTrackMutation.mutateAsync({
          id: trackId,
          state: { items, arrows, manualWidth, manualLength, mapSatellite, mapOpacity, areaSel },
        });
      } catch (err) {
        if (err instanceof Error && err.message === "SATELLITE_REQUIRES_PRO") {
          // Satellite-Flag zurücksetzen, User informieren
          setMapSatellite(false);
          // Toast: "Satellitenbilder sind ab Pro verfügbar"
        }
      }
    } else {
      // Gast → localStorage (unverändert)
      saveState({ items, arrows, manualWidth, manualLength, mapSatellite, mapOpacity, areaSel });
    }
    setSaveStatus("saved");
    savedFadeRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
  }, 1000);
}, [items, arrows, manualWidth, manualLength, mapSatellite, mapOpacity, areaSel]);
```

### 1.13 localStorage Migration beim ersten Login

```typescript
// In AuthCallbackPage.tsx — nach erfolgreichem Login:
async function migrateLocalStorage() {
  const local = loadState();
  if (!local?.items.length) return;

  const { count } = await supabase
    .from("tracks")
    .select("id", { count: "exact", head: true });

  if (count && count > 0) return;   // User hat schon Cloud-Tracks

  const trackId = await createTrack("Meine Strecke (migriert)");
  await saveTrack(trackId, {
    items: local.items,
    arrows: local.arrows,
    manualWidth: local.manualWidth,
    manualLength: local.manualLength,
    mapSatellite: false,           // Free-User: kein Satellite, RPC würde es sowieso blocken
    mapOpacity: local.mapOpacity,
    areaSel: local.areaSel,
  });
  clearSavedState();
}
```

### 1.14 Account-Verwaltung (DSGVO-Pflicht)

**Account-Export** — Edge Function `account-export`, gibt JSON zurück (Entscheidung 2026-06-19: kein ZIP):

```typescript
// supabase/functions/account-export/index.ts
// Gibt Content-Disposition: attachment; filename="kartslalom-export-YYYY-MM-DD.json"
// Inhalt:
//   exported_at       — ISO-Timestamp
//   profile           — id, email, tier, created_at, last_active_at
//   tracks[]          — alle Felder inkl. state_json
//   track_versions[]  — alle Versionen aller Tracks
// Art. 20 DSGVO (Datenübertragbarkeit) erfüllt.
```

**Account-Löschung** — Edge Function `delete-account`, Hard Delete (Entscheidung 2026-06-19):

```typescript
// supabase/functions/delete-account/index.ts
// Reihenfolge:
//   1. profiles: is_deleted = true, deleted_at = now() (Rollback-Marker)
//   2. auth.admin.deleteUser(userId)
//      → ON DELETE CASCADE löscht profiles + tracks + track_versions vollständig
//   3. Bei Fehler in Schritt 2: is_deleted auf false zurücksetzen
// Kein Anonymisierungsschritt — vollständige unwiderrufliche Löschung.
// Art. 17 DSGVO (Löschungsrecht) erfüllt. Dokumentiert in Datenschutzerklärung Abschnitt 8.
```

### 1.15 Willkommens-Mail

Auslöser: `AuthCallbackPage.tsx` feuert nach erfolgreichem Magic-Link-Login einen
fire-and-forget-`fetch` an `send-welcome`. Idempotenz-Check: nur wenn Account < 5 Minuten alt.

```typescript
// supabase/functions/send-welcome/index.ts
// Kein externer npm-Import — nur fetch() gegen Resend REST-API
// Env-Vars: RESEND_API_KEY, FROM_EMAIL (Fallback: noreply@kart.cheezuscraizt.de)
// SUPABASE_URL + SERVICE_ROLE_KEY für /auth/v1/user-Lookup
Deno.serve(async (req) => {
  const bearer = req.headers.get("authorization");
  const user = await fetch(`${SUPABASE_URL}/auth/v1/user`,
    { headers: { apikey: SERVICE_ROLE_KEY, Authorization: bearer } }).then(r => r.json());
  const ageMs = Date.now() - new Date(user.created_at).getTime();
  if (ageMs > 5 * 60 * 1000) return json({ skipped: true });
  await fetch("https://api.resend.com/emails", { method: "POST", ... });
});
```

Kein Double-Opt-In — Willkommens-Mail ist Vertragskommunikation (Art. 6 Abs. 1 lit. b DSGVO).
Deployment: `supabase functions deploy send-welcome --project-ref <ref>`

### 1.16 Lifecycle-Cron — Phase 1: voll aktiv

Lifecycle-Funktion ist in Phase 1 vollständig aktiv. Datenschutz dokumentiert in
Impressum/Datenschutz Abschnitt 8 (Kontolöschung und Inaktivitätsregel).

```typescript
// supabase/functions/user-lifecycle/index.ts (standalone, für Cloud-Deployment)
// supabase/functions/main/index.ts (Dispatcher, für lokales Docker-Dev)
// Stufen:
//   150 Tage Inaktivität → erste Erinnerungsmail (einmalig, reminder_150_sent_at)
//   170 Tage Inaktivität → zweite Warnung (einmalig, reminder_170_sent_at)
//   180 Tage Inaktivität → is_deleted = true, deleted_at = now(), Deaktivierungsmail
// Kein externer Import — nur fetch() gegen Supabase REST + Resend API.
// Auth: x-cron-secret Header (Env-Var CRON_SECRET).
```

Cron-Scheduling via **Supabase Dashboard** (nicht GitHub Actions):

```
Supabase Dashboard → Edge Functions → user-lifecycle → Schedules → Add
Cron-Ausdruck: 0 3 * * *   (täglich 03:00 UTC)
```

Deployment:
```bash
supabase functions deploy user-lifecycle --project-ref <ref>
supabase secrets set RESEND_API_KEY=... FROM_EMAIL=... CRON_SECRET=... --project-ref <ref>
```

### 1.17 Definition of Done Phase 1

- [x] Magic Link Login: E-Mail empfangen, `/auth/callback` verarbeitet, Session aktiv
- [x] PKCE-Flow geprüft (`flowType: "pkce"` in `src/lib/supabase.ts`, Ende-zu-Ende gegen lokalen Stack getestet)
- [x] Dashboard zeigt eigene Tracks aus der DB
- [x] Neuer Track via `create_track()` RPC — kein direkter INSERT
- [x] Autosave schreibt via `save_track()` RPC für eingeloggte Nutzer
- [x] Gast-Modus vollständig: Editor, SVG-Export, PDF-Export ohne Login
- [x] Free-User: 4. Track → `TRACK_LIMIT_REACHED` vom Server
- [x] Free-User: map_satellite=true → `SATELLITE_REQUIRES_PRO` vom Server, Frontend setzt zurück
- [x] localStorage-Migration läuft beim ersten Login
- [x] Account-Export-Button in Settings gibt JSON zurück (`kartslalom-export-YYYY-MM-DD.json`)
- [x] Account-Löschen: Hard Delete via `auth.admin.deleteUser()` + ON DELETE CASCADE
- [ ] Willkommens-Mail kommt an (nach `supabase functions deploy send-welcome` + Secrets)
- [x] Lifecycle-Funktion deployed; 150/170/180-Tage-Mails + Soft-Delete aktiv; Cron via Supabase Dashboard

---

## PHASE 2 — Pro-Features

**Voraussetzung:** Phase 1 stabil und mindestens 2 Wochen in Produktion ohne kritische Fehler.

**Zahlungsmodell (Entscheidung 2026-06-16):** Kein Stripe, kein In-App-Checkout.
Upgrades auf Pro/Team laufen extern (z. B. Rechnung, Banküberweisung, direkte
Absprache). Der Admin setzt `tier` danach manuell per SQL:
```sql
UPDATE profiles SET tier = 'pro' WHERE email = 'nutzer@example.com';
```
Produktiv über Supabase Dashboard → SQL-Editor. Lokal per `docker compose exec db psql`.

Free-Nutzer sehen an den gesperrten Features einen Hinweis mit Kontakt-Link
(`mailto:` o. ä.) statt einem Checkout-Flow.

### 2.1 Features

```yaml
share_links:
  flow:
    1: "Edge Function generiert 32-Byte crypto-Token"
    2: "SHA-256-Hash in tracks.public_token_hash speichern"
    3: "Plaintext-Token einmalig an Client zurückgeben"
    4: "Share-URL: /share/<plaintext-token>"
  lookup: "RPC get_track_by_share_token(token) — hasht, sucht, gibt Track zurück"
  rls: "Kein öffentliches SELECT via is_public — nur via RPC"
  tier: "Pro+"

png_export:
  library: "html-to-image (client-seitig, kein Puppeteer nötig)"
  tier: "Pro+"

version_history:
  write: "SECURITY DEFINER Funktion create_track_version()"
  keep:  "letzte 10 für Pro, unbegrenzt für Team"
  ui:    "Liste in Track-Settings, Wiederherstellen lädt state_json"
  tier: "Pro+"

satellite_imagery:
  provider: "Mapbox"
  security: "API-Key via Edge-Function-Proxy — nie im Client-Bundle"
  tier: "Pro+"

upgrade_hint:
  ui: "Gesperrte Features zeigen Hinweis mit Kontakt-Link (kein Checkout)"
  format: "Tooltip oder Inline-Banner: 'Nur für Pro-Nutzer — Kontakt: …'"

lifecycle_emails:
  activate: "erst nach Datenschutz-Review und Abmeldemöglichkeit"
  timing:
    150d: "freundlicher Reminder"
    170d: "Letzte Warnung + Export-Link"
    180d: "Hard Delete — auth.admin.deleteUser() + ON DELETE CASCADE (Entscheidung 2026-06-19)"
  paid_users: "Kein Lösch-Flow — nur Reminder bei >150d/170d Inaktivität"
```

### 2.2 Definition of Done Phase 2

- [ ] Share-Link: Token-Hash in DB, Plaintext einmalig zurückgegeben, Track über `/share/...` abrufbar
- [ ] Kein SELECT `WHERE is_public = true` ohne RPC für Fremdzugriff möglich
- [ ] PNG-Export für Pro, Upgrade-Hinweis mit Kontakt-Link für Free
- [ ] Mapbox-Key nicht im Client-Bundle (über Edge-Function-Proxy)
- [ ] Lifecycle-E-Mails mit Abmeldemöglichkeit, Datenschutz-Review dokumentiert
- [ ] Versionshistorie: Wiederherstellen lädt korrekte Version

---

## PHASE 3 — Custom-Hindernisse (H0–H5)

**Voraussetzung:** Phase 1 abgeschlossen.  
**Vollständiges Datenmodell, SQL und RPCs:** `CUSTOM_FORMATIONS_PLAN.md` v1.2.  
Dieses Kapitel enthält Verzeichnisstruktur, Typen und DoD-Checklisten.

### 3.0 Datenbank-Erweiterungen (H0)

Läuft parallel zu Phase 0/1 — Tabellen und RPCs können im Supabase-SQL-Editor
vorab ausgerollt werden, da sie eigenständig sind und bestehende Tabellen nur
additiv erweitern.

**profiles — ALTER**
```sql
alter table public.profiles
  add column username text,
  add column role text not null default 'user'
    check (role in ('user', 'admin'));

-- Case-insensitive Eindeutigkeit
create unique index profiles_username_lower_idx on public.profiles (lower(username));
```

**Neue Tabellen** (vollständiges SQL in `CUSTOM_FORMATIONS_PLAN.md` 2.2–2.4):
- `public.custom_formations` — Hindernis-Definitionen (Cones, Pfeile, Meta)
- `public.formation_shares` — Sharing zwischen Usern
- `public.app_config` — Feature-Gates, Seed: `custom_formations_required_tier = null`

**RPCs** (SECURITY DEFINER, alle mit `auth.uid()`-Check zuerst):

| Funktion | Zweck |
|---|---|
| `create_custom_formation(...)` | Erstellen + Premium-Gate + Limits |
| `update_custom_formation(id, ...)` | Owner oder edit-Share |
| `delete_custom_formation(id)` | Nur Owner |
| `find_shareable_user(query)` | Username oder E-Mail, exakter Treffer |
| `share_custom_formation(...)` | Share anlegen, status → 'shared' |
| `unshare_custom_formation(...)` | Share entfernen, status → 'private' falls leer |
| `admin_list_custom_formations(...)` | Alle lesen (Admin-Gate) |
| `admin_get_custom_formation(id)` | Einzeln lesen (Admin-Gate) |
| `admin_promote_to_library(...)` | Kopie mit is_library=true |
| `admin_delete_custom_formation(id)` | Löschen (Admin-Gate) |
| `admin_update_custom_formation(...)` | Bearbeiten + Metadaten + Audit |

**Definition of Done H0**
- [ ] `profiles`: username, role, `profiles_username_lower_idx` ausgerollt
- [ ] `custom_formations`, `formation_shares`, `app_config` + RLS + Indizes aktiv
- [ ] `app_config`: Seed-Row `custom_formations_required_tier = null`
- [ ] Alle RPCs deploybar, auth.uid()-Checks, Kategorie-/Name-Validierung
- [ ] RLS-Test: User A kann Custom-Formation von User B nicht lesen (wenn nicht geteilt)
- [ ] RLS-Test: Direkter INSERT auf `custom_formations` schlägt fehl
- [ ] Library-Formation (is_library=true) ist für anon lesbar

---

### 3.1 Editor-Skeleton — Typen + Komponente (H1)

Kann vor H0 begonnen werden (kein Backend nötig, localStorage-Basis).

**Typen-Erweiterungen `src/types.ts`**
```typescript
export type FormationCategory =
  | "start_ziel" | "basis" | "kurven" | "komplex"
  | "individuell";                    // NEU

export type CustomFormationStatus =
  | "private" | "shared" | "submitted" | "library" | "rejected";

export type CustomFormationDefinition = {
  id: string;
  ownerId: string | null;
  ownerUsername?: string;
  name: string;
  description?: string;
  category: FormationCategory;
  status: CustomFormationStatus;
  isLibrary: boolean;
  pylonCount: number;
  lichteBreite?: number;
  durationSeconds?: number;
  sourceFormationKey?: FormationKey;
  sourceCustomFormationId?: string;
  cones: ConePoint[];
  arrows: PlacedArrow[];
  defaultDirection?: DirectionMode;
  createdAt: string;
  updatedAt: string;
};

// PlacedFormation — Erweiterung (bestehende Felder bleiben)
// key = "custom" für Custom-Formationen
// customFormationId: UUID der Quelle (für Referenz/Updates)
// customSnapshot: beim Platzieren eingefroren (cones + arrows + label)
//   → Track bleibt self-contained auch wenn Quell-Formation gelöscht wird
```

**Neue Seiten / Komponenten**
```
src/
  pages/
    FormationEditorPage.tsx     ← WYSIWYG-Editor (lokal & cloud)
    AdminFormationsPage.tsx     ← /admin/formations

  components/
    formation-editor/
      FormationEditorCanvas.tsx ← Cone/Pfeil-Editing, Rule-Overlays
      FormationMetaPanel.tsx    ← Name, Pylonenzahl, Dauer, lichte Breite
      GatePairTool.tsx          ← Tor-Paar markieren → lichte Breite live
      BasisAuswahl.tsx          ← leer / Standard / Custom duplizieren
    admin/
      AdminGuard.tsx            ← wie AuthGuard, prüft role='admin'

  hooks/
    useCustomFormations.ts      ← TanStack Query: eigene + geteilte + Library
    useFeatureGate.ts           ← reads app_config, profile.tier
    useFormationEditor.ts       ← Reducer für Cone/Pfeil-State, Undo/Redo

  lib/
    api/
      customFormations.ts       ← RPC-Wrapper (analog tracks.ts)
    validation/
      customFormation.ts        ← Live-Checks: cone_too_close, Tor-Breite
```

**Rule-Overlays** (referenzieren Konstanten aus `formations/common.ts`):
- `PYLON_GAP` (0,5 m) → Mindestabstand Kante-zu-Kante, reuse `validation/geometry.ts`-Logik
- `TASK_LANE_WIDTH` (1,65 m) → Tor-Breite nach Markierung von Tor-Paar, live-Anzeige

**formationRegistry.ts — Erweiterung**
```typescript
// getFormation() erhält optionalen zweiten Parameter für Custom-Formationen:
// wenn key === "custom" → gibt FormationDefinition aus PlacedFormation.customSnapshot
export function resolveFormation(
  pf: PlacedFormation,
  customMap?: Map<string, CustomFormationDefinition>
): FormationDefinition { ... }
```

**Definition of Done H1**
- [ ] `FormationCategory` um `"individuell"` erweitert, kein Typ-Fehler in bestehendem Code
- [ ] `PlacedFormation` um `customFormationId?` und `customSnapshot?` erweitert
- [ ] `FormationEditorCanvas`: stehende/liegende/Sensor-Pylone platzieren, verschieben, löschen, rotieren
- [ ] Pfeil-Tool im Editor (formation-lokale PlacedArrow)
- [ ] `GatePairTool`: zwei Pylone markieren, lichte Breite live berechnen und anzeigen
- [ ] `FormationMetaPanel`: Name (Pflicht), Pylonenzahl (auto), Dauer, lichte Breite
- [ ] Rule-Overlays: Warnung wenn Pylon-Abstand < 0,5 m / Tor-Breite < 1,65 m
- [ ] `BasisAuswahl`: leer starten, Standard-Formation duplizieren
- [ ] Editor lokal speicherbar (localStorage) ohne Backend
- [ ] Gast-Zugriff auf Palette-Gruppe "Individuell" (Library-Formationen) vorbereitet

---

### 3.2 Cloud-Anbindung + Feature-Gate (H2)

**Voraussetzung:** H0 + H1

```typescript
// src/hooks/useFeatureGate.ts
export function useFeatureGate(feature: 'custom_formations') {
  // Liest app_config-Row via SELECT (public read, RLS erlaubt)
  // + profile.tier aus useAuthStore
  // gibt { allowed: boolean; requiredTier: string | null } zurück
  // Heute: requiredTier = null → allowed = true für alle eingeloggten User
}
```

**`src/lib/api/customFormations.ts`** — analog `tracks.ts`:
alle Schreiboperationen via `.rpc(...)`, Error-Mapping für
`premium_required`, `track_limit_reached`, `too_many_cones`, `invalid_name`, etc.

**Definition of Done H2**
- [ ] `useFeatureGate('custom_formations')`: allowed=true bei null-Gate
- [ ] Erstellen/Speichern/Löschen via RPCs, keine direkten `.insert()`/`.update()`
- [ ] `create_custom_formation`: Premium-Gate schlägt fehl wenn Gate aktiv + Tier zu niedrig
- [ ] "Meine Hindernisse"-Sektion im Dashboard zeigt eigene Custom-Formationen
- [ ] `BasisAuswahl` ergänzt: eigene Custom-Formation duplizieren
- [ ] Autosave im FormationEditorPage (analog Editor-Autosave aus 1.12)

---

### 3.3 Sharing (H3)

**Voraussetzung:** H2

**Username-Onboarding** (in `AuthCallbackPage.tsx` oder separatem Guard):
```typescript
// Nach Login: falls profiles.username IS NULL → Redirect auf /onboarding/username
// Pflicht-Dialog mit Validierung: 3-24 Zeichen, [a-z0-9_-], lowercase normalisiert
```

**Router-Erweiterungen**
```
/onboarding/username          ← Username-Pflichtdialog
/formations/:id/share         ← Sharing-Verwaltung einer Formation
```

**Definition of Done H3**
- [ ] Username-Onboarding: Dialog erscheint nach Login falls username fehlt, kann nicht übersprungen werden
- [ ] `lower(username)`-Unique-Constraint verhindert Duplikate (inkl. case-Varianten)
- [ ] Share-Dialog: Eingabe von Username oder E-Mail, `find_shareable_user` liefert Treffer
- [ ] `share_custom_formation` / `unshare_custom_formation` funktionieren, status wechselt korrekt
- [ ] Empfänger sieht Formation unter "Geteilt mit mir"
- [ ] Permission `view`: Empfänger kann duplizieren, aber Original-RPC schlägt fehl
- [ ] Permission `edit`: Empfänger kann `update_custom_formation` erfolgreich aufrufen

---

### 3.4 Admin (H4)

**Voraussetzung:** H2

```
/admin/formations             ← AdminGuard (role='admin'), admin_list_custom_formations
/admin/formations/:id         ← admin_get_custom_formation + FormationEditorCanvas
```

**Definition of Done H4**
- [ ] `AdminGuard`: nicht-Admin-User werden zu `/dashboard` weitergeleitet
- [ ] Admin-Rolle wird via separatem RPC serverseitig bestätigt (nicht aus Store übernommen)
- [ ] `/admin/formations`: Tabelle mit Filter status/category, Paginierung
- [ ] "In Bibliothek übernehmen": `admin_promote_to_library` erstellt Kopie, Original unberührt
- [ ] "Löschen": `admin_delete_custom_formation`, Bestätigungs-Dialog
- [ ] "Bearbeiten": öffnet FormationEditorCanvas im Admin-Kontext, speichert via `admin_update_custom_formation`
- [ ] `admin_update_custom_formation`: pylon_count, lichte_breite, duration_seconds aktualisiert
- [ ] Audit-Felder `edited_by_admin_id/_at` in DB gesetzt und in Admin-UI sichtbar

---

### 3.5 Library-Integration & Export-Robustheit (H5)

**Voraussetzung:** H2 + H4

**Definition of Done H5**
- [ ] Palette "Individuell" zeigt Library-Formationen (is_library=true) auch für Gäste
- [ ] `resolveFormation()` liest für `key="custom"` aus `customSnapshot` (kein Registry-Lookup)
- [ ] Track mit Custom-Formation exportierbar als SVG/PDF ohne Fehler, auch wenn Quelle gelöscht
- [ ] JSON-Import eines Tracks mit `customSnapshot` lädt korrekt
- [ ] Account-Löschung: Library-Formationen behalten `owner_id=null`, Attribution "[gelöschter Nutzer]"
- [ ] Nicht-Library Custom-Formationen des gelöschten Accounts werden bereinigt
- [ ] Attribution-Anzeige in Palette: "Erstellt von <username>" / "[gelöschter Nutzer]"

---

## KORREKTUREN ZU V2.0

```yaml
corrections:
  - id: C1
    issue: "§ 5 TMG — TMG 2024 durch DDG abgelöst"
    fix: "§ 5 DDG (Digitale-Dienste-Gesetz)"

  - id: C2
    issue: "nginx non-root im Dockerfile aufwändig und fehleranfällig"
    fix: "nginxinc/nginx-unprivileged:1.25-alpine — läuft ohne root auf Port 8080"

  - id: C3
    issue: "RLS-Tests via set local request.jwt.claims nicht produktionsäquivalent"
    fix: "Tests mit echten Supabase-Clients und Test-Usern (test-rls.ts)"

  - id: C4
    issue: "tracks_update_own Policy schützte owner_id nicht sauber"
    fix: "Kein UPDATE-Policy auf tracks. REVOKE UPDATE. Speichern nur via save_track() RPC."

  - id: C5
    issue: "map_satellite für Free-User clientseitig nicht durchgesetzt"
    fix: "save_track() prüft Tier serverseitig. Bei Free + satellite=true: Exception satellite_requires_pro."

  - id: C6
    issue: "Account-Löschung setzte state_json auf null — Spalte ist NOT NULL"
    fix: "Löschung setzt state_json = '{\"items\":[],\"arrows\":[]}'"

  - id: C7
    issue: "AuthCallbackPage nutzte nur getSession(), kein Hinweis auf PKCE"
    fix: "exchangeCodeForSession(code) für PKCE-Flow (Supabase JS v2 Standard). Beide Flows dokumentiert."

  - id: C8
    issue: "Lifecycle-E-Mails in Phase 1 zu früh ohne Datenschutz-/Abmeldeprüfung"
    fix: "Revidiert v2.3: Lifecycle voll aktiv in Phase 1. Datenschutz stattdessen in
          Impressum/Datenschutz Abschnitt 8 dokumentiert (Inaktivitätsregel, Hard Delete,
          150/170/180-Tage-Stufen). Abmeldemöglichkeit: Account-Löschung via Settings."
```

---

*Version 2.1 — maschinenlesbar strukturiert.*
