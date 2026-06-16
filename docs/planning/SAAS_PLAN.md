# Kartslalom Streckenplaner — SaaS-Transformation

**Dokument-Version:** 1.3  
**Erstellt:** 2026-06-02  
**Zuletzt geändert:** 2026-06-16  
**Änderungen v1.1:** Enterprise/Verband-Tier entfernt (zu früh). Export nur für angemeldete Nutzer. User-Lifecycle-Management (Inaktivitäts-Reminder + Cleanup) ergänzt.  
**Änderungen v1.2:** Tech-Stack final entschieden: Supabase-first, Hetzner/Coolify statt Vercel, Zustand+TanStack Query+Zod, Resend (kein DOI für Transaktionsmails), Stripe mit Paddle als Fallback.  
**Änderungen v1.3:** Zahlungsmodell geändert — kein Stripe, kein In-App-Checkout. Bezahlung läuft extern, Tier-Upgrades werden manuell per SQL gesetzt. Operative Details siehe `IMPLEMENTATION_PLAN.md` Phase 2.  
**Autor:** Claude Sonnet 4.6 (Analyse-Agent)  
**Zweck:** Maschinenlesbares Planungsdokument für die SaaS-Transformation des Kartslalom MVP. Verwendbar durch Menschen und AI-Agenten gleichermaßen.

> **Hinweis:** Alle Abschnitte dieses Dokuments, die Stripe, Checkout, Customer Portal oder Webhooks beschreiben, sind durch die Entscheidung vom 2026-06-16 **überholt**. Das operative Planungsdokument ist `IMPLEMENTATION_PLAN.md`.

---

## 1. IST-ANALYSE DES MVP

### 1.1 Technischer Stack

```yaml
frontend:
  framework: React 18 + TypeScript
  bundler: Vite 8
  icons: lucide-react
  animation: framer-motion (installiert, kaum genutzt)
  map: OpenStreetMap Tiles (direkt via img-Tags)
  deployment: Docker (Dockerfile + docker-compose vorhanden)

backend:
  type: KEINER
  storage: localStorage (Browser-only)
  auth: KEINE
  api: KEINE

export_formats:
  - SVG (generiert als String)
  - PDF (via window.print() in neuem Tab)
  - JSON (Datei-Download)

import_formats:
  - JSON
```

### 1.2 Vorhandene Features

```yaml
track_editor:
  - canvas_based_drag_drop: true
  - multi_select: true          # Shift+Klick
  - undo_redo: true             # 30 History-States
  - keyboard_shortcuts: true    # Cmd+Z, Delete, Escape
  - autosave: true              # localStorage, debounced 1s

formation_library:
  count: 23
  categories:
    - start_ziel: [startGate, finishLane, vorstartbereich, wechselzone]
    - basis: [singlePylon, tor, gasse, swissSlalom, switchGate]
    - kurven: [normalCorner, normalCornerAlt, germanCorner, turn90to180, circle, ypsilon]
    - komplex: [sLane, zLane, boxStraight, boxTurn, snail, cross, pretzel, chicane]
  rotation_variants: true       # 0/90/180/270° für Kurven-Elemente

map_integration:
  provider: OpenStreetMap
  satellite_toggle: true
  area_selection:
    modes: [rectangle, polygon]
    rotation: true              # 0-359°
  opacity_control: true

validation_engine:
  checks:
    - cone_too_close: threshold_0.5m
    - cone_too_far: threshold_10m
    - connectivity: graph_based
    - missing_vorstartbereich: required
    - missing_wechselzone: required
    - no_edge_anchor: info
    - long_jump: threshold_14m
  severities: [error, warning, info]

export:
  svg: true
  pdf: true                     # via window.print()
  json: true                    # komplettes Track-State

duration_estimation:
  per_formation: true
  total_seconds: true
  override_per_formation: true
```

### 1.3 Identifizierte Schwächen des MVP

```yaml
weaknesses:
  - no_persistence: "Strecken gehen verloren wenn Browser-Cache gelöscht wird"
  - no_accounts: "Keine Benutzer, keine Trennung von Designs"
  - no_sharing: "Strecken können nur als JSON-Datei weitergegeben werden"
  - no_collaboration: "Kein Echtzeit-Sharing, kein Kommentar-System"
  - no_versioning: "Keine Versions-Historie pro Strecke"
  - no_mobile: "UI nicht responsive, kein Touch-optimiertes Layout"
  - map_limitation: "Nur OSM, kein Satellite ohne separaten Provider"
  - no_regulations: "Keine Regelwerk-Datenbank für verschiedene Verbände"
  - no_templates: "Keine vorgefertigten Strecken-Templates"
  - no_analytics: "Keine Nutzungsdaten"
```

---

## 2. ZIELGRUPPEN-ANALYSE

```yaml
target_segments:
  primary:
    name: "Vereins-Streckenplaner"
    description: "Kartslalom-Vereins-Mitglieder die Trainings- und Wettkampfstrecken planen"
    pain_points:
      - "Strecken per Hand skizzieren oder in Excel"
      - "Strecken per WhatsApp als Foto teilen"
      - "Regelkonformität manuell prüfen"
    willingness_to_pay: "low-medium (5-15 EUR/Monat)"
    volume: "high (hunderte Vereine in DACH)"

  secondary:
    name: "Verbands-Veranstalter"
    description: "Offizielle Veranstalter von Kreismeisterschaften, Landesmeisterschaften"
    pain_points:
      - "Strecken müssen eingereicht und genehmigt werden"
      - "Mehrere Personen arbeiten an einer Strecke"
      - "Archivierung von vergangenen Wettkampfstrecken"
    willingness_to_pay: "medium-high (30-100 EUR/Monat)"
    volume: "medium (Landes-/Bundesverbände)"

  tertiary:
    name: "Trainer / Fahrtechnik-Coaches"
    description: "Coaches die Trainings-Parcours für Gruppen planen"
    pain_points:
      - "Unterschiedliche Strecken für verschiedene Schwierigkeitsgrade"
      - "Strecken mit Teilnehmern teilen"
    willingness_to_pay: "low-medium (10-20 EUR/Monat)"
    volume: "medium"

  enterprise:
    name: "Kartbahn-Betreiber"
    description: "Stationäre Kartbahnen die regelmäßig Slalom-Events anbieten"
    pain_points:
      - "Event-Management, Zeitplanung"
      - "Marketing-Material aus Streckenplänen"
    willingness_to_pay: "high (50-200 EUR/Monat)"
    volume: "low-medium"
```

---

## 3. TIER-DEFINITION

### 3.1 FREE TIER — "Basis"

**Ziel:** Akquisition — aber mit harter Auth-Gate auf Export für Conversion-Druck

```yaml
tier_name: "Basis"
tier_key: "free"
price:
  monthly: 0
  yearly: 0

auth_required: true              # KEIN anonymes Editing — Account für alle Aktionen

limits:
  tracks_saved: 3
  formations_per_track: unlimited
  export_formats: [svg, pdf]     # Export nur nach Login — kein Download ohne Account
  map_selection: true
  map_satellite: false           # OSM-Standard nur
  history_undo_steps: 10
  cloud_save: true               # inklusive — das ist der Anreiz zum Anmelden
  sharing: false
  collaboration: false
  templates_access: "community_only"
  api_access: false

features_included:
  - full_formation_library       # alle 23 Formationen
  - drag_drop_editor
  - basic_validation
  - cloud_save_3_tracks          # Hauptanreiz für Account-Erstellung
  - svg_export                   # NUR nach Login
  - pdf_export                   # NUR nach Login
  - json_import_export           # NUR nach Login
  - area_selection_rectangle
  - duration_estimation
  - undo_redo_10_steps

features_excluded:
  - sharing_links
  - collaboration
  - satellite_imagery
  - polygon_area_selection
  - version_history
  - custom_formations
  - api_access
  - analytics
  - team_management

export_gate_ux:
  behavior: "Export-Button sichtbar aber gesperrt für nicht-eingeloggte Nutzer"
  cta_modal:
    title: "Kostenlos anmelden um zu exportieren"
    body: "Speichere deine Strecken sicher in der Cloud und lade sie als SVG oder PDF herunter."
    actions: ["Jetzt kostenlos anmelden", "Einloggen"]

conversion_hooks:
  - "Export-Button zeigt Login-Modal für Nicht-Angemeldete"
  - "Nach 3. Strecke: 'Upgrade auf Pro für unbegrenzte Strecken'"
  - "Teile diese Strecke mit deinem Verein (Pro)"
  - "Polygon-Auswahl und Satellitenbilder – verfügbar in Pro"
```

### 3.2 PREMIUM TIER — "Pro"

**Ziel:** Einzelpersonen und kleine Vereine, Haupt-Umsatzträger

```yaml
tier_name: "Pro"
tier_key: "pro"
price:
  monthly: 12
  yearly: 99          # ~8.25/Monat, 2 Monate gespart
  currency: "EUR"

limits:
  tracks_saved: 50
  formations_per_track: unlimited
  export_formats: [svg, pdf, png, json]
  map_selection: true
  map_satellite: true
  history_undo_steps: 30
  cloud_save: true
  sharing: true              # read-only Links
  collaboration: false       # nicht in diesem Tier
  templates_access: "all"    # inkl. offizieller Templates
  api_access: false

features_included:
  - everything_in_free
  - cloud_sync               # automatische Cloud-Speicherung
  - 50_saved_tracks
  - satellite_imagery        # Mapbox/Google Maps Satellite
  - polygon_area_selection   # komplexe Geländeformen
  - full_undo_redo_30_steps
  - shareable_view_links     # URL zum Betrachten (read-only)
  - version_history_10       # letzte 10 Versionen pro Strecke
  - png_export               # Raster-Export
  - official_templates       # verbands-konforme Vorlagen
  - advanced_validation      # erweiterte Regelprüfung
  - track_statistics         # Pylonen-Count, Schwierigkeitsindex
  - duration_per_section     # Abschnittszeiten
  - mobile_view              # responsive Ansicht (nicht Edit)

features_excluded:
  - collaboration_editing
  - team_workspaces
  - custom_formations
  - api_access
  - analytics_dashboard
  - white_label
  - compliance_pdf_reports

conversion_hooks:
  - "Braucht dein Verein mehr als 3 Strecken? Upgrade auf Team"
  - "API-Zugang und eigene Formationen – verfügbar in Team"
```

### 3.3 TEAM TIER — "Verein"

**Ziel:** Vereine und Verbände, höchster LTV

```yaml
tier_name: "Verein"
tier_key: "team"
price:
  monthly: 39
  yearly: 329         # ~27.50/Monat
  currency: "EUR"
  includes_seats: 5
  additional_seat: 6  # EUR/Monat pro weiterer Person

limits:
  tracks_saved: unlimited
  formations_per_track: unlimited
  export_formats: [svg, pdf, png, json, dxf]
  map_selection: true
  map_satellite: true
  history_undo_steps: unlimited
  cloud_save: true
  sharing: true              # read-only + edit-link
  collaboration: true        # Echtzeit-Kollaboration
  templates_access: "all"
  api_access: false          # bewusst nicht enthalten — kein Bedarf in dieser Zielgruppe

limits_team:
  seats: 5                   # inkl., erweiterbar
  workspaces: 3              # getrennte Vereins-Bereiche
  templates_per_workspace: 20

features_included:
  - everything_in_pro
  - team_workspaces
  - collaborative_editing    # Echtzeit (Yjs + PartyKit, Phase 2)
  - edit_sharing_links
  - unlimited_tracks
  - unlimited_version_history
  - custom_formations
  - formation_library_sharing
  - role_management          # owner / editor / viewer
  - compliance_pdf_reports
  - regulation_database      # DMSB, ADAC, kantonale Regeln (CH)
  - track_analytics
  - dxf_export               # für Feldmarkierung / CAD
  - bulk_export
  - priority_support         # E-Mail innerhalb 24h

note: "Enterprise/Verband-Tier wurde bewusst nicht definiert — zu früh für den Markt."
```

---

## 3.5 USER-LIFECYCLE-MANAGEMENT

**Ziel:** Datenbank-Hygiene, DSGVO-Compliance, Re-Engagement

### Inaktivitäts-Definition

```yaml
inactivity_definition:
  tracked_events:
    - login
    - track_save
    - track_export
    - track_create
  last_active_at: "Timestamp des letzten dieser Events"
  note: "Reine Ansicht/Session-Start zählt NICHT als Aktivität"
```

### Lifecycle-Phasen & Automatisierungen

```yaml
lifecycle:

  phase_active:
    condition: "last_active_at < 60 Tage"
    actions: []

  phase_at_risk:
    condition: "last_active_at >= 150 Tage AND < 170 Tage"
    rationale: "Vereinsbetrieb ist saisonal — 60 Tage wären zu aggressiv"
    trigger: "Cron-Job täglich 08:00 UTC"
    phase_activated: 2          # in Phase 1 nur Logging, kein E-Mail-Versand
    actions:
      - send_email:
          template: "re_engagement_reminder"
          subject: "Deine Strecken warten auf dich"
          body_key_points:
            - "Du warst 150 Tage nicht aktiv"
            - "Deine X Strecken sind sicher gespeichert"
            - "CTA: Strecke öffnen"
            - "Hinweis: Account wird nach weiteren 30 Tagen Inaktivität gelöscht"
          unsubscribe_link: true
          one_time: true

  phase_final_warning:
    condition: "last_active_at >= 170 Tage AND < 180 Tage"
    trigger: "Cron-Job täglich 08:00 UTC"
    phase_activated: 2
    actions:
      - send_email:
          template: "account_deletion_warning"
          subject: "Dein Account wird in 10 Tagen gelöscht"
          body_key_points:
            - "Letzte Warnung: Inaktivität seit 170 Tagen"
            - "Löschung in 10 Tagen — danach nicht wiederherstellbar"
            - "CTA: Jetzt einloggen um Account zu behalten"
            - "Alternative CTA: Strecken als JSON herunterladen (letzter Export)"
          one_time: true

  phase_deleted:
    condition: "last_active_at >= 180 Tage"
    trigger: "Cron-Job täglich 03:00 UTC (outside peak hours)"
    actions:
      - anonymize_account:
          steps:
            - "email -> gelöscht_{uuid}@deleted.invalid"
            - "name -> [gelöscht]"
            - "stripe_customer_id -> null (Subscription bereits gekündigt)"
            - "is_deleted = true, deleted_at = now()"
      - delete_track_content:
          steps:
            - "state_json und area_sel_json aller Versionen auf null setzen"
            - "track.name -> [gelöscht]"
            - "track.is_public = false"
      - cancel_active_subscription:
          condition: "nur wenn noch aktive Stripe-Subscription"
          action: "stripe.subscriptions.cancel() mit Prorata-Erstattung"
      - log_deletion:
          fields: [user_id_hash, tier, tracks_count, deleted_at]
          note: "kein PII — nur für interne Statistik"

  paid_user_exception:
    description: "Nutzer mit aktiver bezahlter Subscription werden NICHT gelöscht"
    rationale: "Aktive Zahler sind per Definition nicht inaktiv im Business-Sinn"
    implementation:
      - "Cron prüft: tier IN ('pro', 'team') AND stripe_status = 'active' → skip"
      - "Reminder-E-Mails trotzdem senden wenn >60 Tage inaktiv (Feature-Nutzung anregen)"
      - "Kein Lösch-Flow — nur Kündigung durch Nutzer selbst"
```

### Technische Implementierung des Lifecycle-Crons

```yaml
cron_implementation:
  scheduler: "pg_cron (in Supabase) ODER externer Cron via Trigger.dev / Inngest"
  recommended: "Inngest (serverless, zuverlässige Retries, einfaches Debugging)"

  daily_cron_job:
    name: "user-lifecycle-check"
    schedule: "0 8 * * *"     # täglich 08:00 UTC
    steps:
      1_find_at_risk:
        query: |
          SELECT id, email, last_active_at
          FROM users
          WHERE last_active_at < NOW() - INTERVAL '60 days'
            AND last_active_at >= NOW() - INTERVAL '75 days'
            AND tier NOT IN ('pro', 'team') OR stripe_status != 'active'
            AND reminder_60_sent_at IS NULL
            AND is_deleted = false
      2_send_reminder_60:
        action: "E-Mail via Resend senden, reminder_60_sent_at = now() setzen"

      3_find_final_warning:
        query: |
          SELECT id, email, last_active_at
          FROM users
          WHERE last_active_at < NOW() - INTERVAL '80 days'
            AND last_active_at >= NOW() - INTERVAL '90 days'
            AND reminder_80_sent_at IS NULL
            AND is_deleted = false
      4_send_reminder_80:
        action: "E-Mail via Resend senden, reminder_80_sent_at = now() setzen"

  nightly_cleanup_job:
    name: "user-deletion-cleanup"
    schedule: "0 3 * * *"     # täglich 03:00 UTC
    steps:
      1_find_deleteable:
        query: |
          SELECT id
          FROM users
          WHERE last_active_at < NOW() - INTERVAL '90 days'
            AND is_deleted = false
            AND (tier = 'free' OR stripe_status != 'active')
      2_anonymize_and_delete:
        action: "Anonymisierung + Content-Löschung wie oben definiert"
        batch_size: 50         # nie zu viele auf einmal (Datenbank-Last)
        retry_on_failure: true

  db_columns_needed:
    profiles:
      - last_active_at: timestamp
      - reminder_150_sent_at: timestamp (nullable)
      - reminder_170_sent_at: timestamp (nullable)
      - is_deleted: boolean (default false)
      - deleted_at: timestamp (nullable)
```

### E-Mail-Templates: Inhaltliche Anforderungen

```yaml
email_templates:

  re_engagement_reminder:
    from: "Kartslalom Streckenplaner <hallo@kartslalom.de>"
    timing: "60 Tage Inaktivität"
    tone: "freundlich, nicht alarmierend"
    must_contain:
      - Anzahl der gespeicherten Strecken
      - Direkt-Link zur App
      - Hinweis auf bevorstehende Löschung (klar aber nicht aggressiv)
      - Opt-out von Lifecycle-E-Mails (aber Account bleibt)
    must_not_contain:
      - "Du wirst gelöscht" (zu hart — erst in 80-Tage-Mail)
      - Preisangebote oder Upsell in dieser Mail

  account_deletion_warning:
    from: "Kartslalom Streckenplaner <hallo@kartslalom.de>"
    timing: "80 Tage Inaktivität (10 Tage vor Löschung)"
    tone: "klar, sachlich, hilfreich"
    must_contain:
      - Konkretes Löschdatum (now + 10 Tage)
      - Letzter Export-Link (JSON-Download aller Strecken, zeitlich begrenzt)
      - Einlog-CTA
      - DSGVO-Hinweis: was gelöscht wird
    must_not_contain:
      - Upsell-Angebote

  post_deletion_confirmation:
    send: false                # kein E-Mail nach Löschung — Account ist weg
    rationale: "E-Mail-Adresse nach Löschung nicht mehr zuzuordnen"
```

---

## 4. TECHNISCHE ARCHITEKTUR FÜR SAAS

### 4.1 Architektur-Überblick

```yaml
architecture_type: "supabase_first_saas"

# ENTSCHIEDEN — keine Alternativen mehr offen

frontend:
  keep:
    - React 18 + TypeScript
    - Vite
  add:
    - react_router             # Multi-Page Navigation (Login, Dashboard, Editor, Settings)
    - tanstack_query           # Server-State, Caching, Refetch-Logik
    - zustand                  # Client-State (ersetzt den useState-Flickenteppich in App.tsx)
    - zod                      # Schema-Validierung für API-Responses + Formulare

backend:
  primary: "Supabase"
  components:
    supabase_auth:
      use_for: ["Login/Signup", "Session-Management", "Magic Link"]
      note: "Kein separater Auth-Service nötig"
    supabase_postgres:
      use_for: ["Alle Daten: users, tracks, versions, orgs"]
      extensions: ["pgcrypto (für Tokens)", "pg_cron (für Lifecycle-Crons, alternativ extern)"]
    supabase_rls:
      use_for: ["Datentrennung zwischen Usern und Orgs ohne manuellen Auth-Check im Code"]
      critical: true
    supabase_edge_functions:
      use_for:
        - "Stripe Webhook Handler"
        - "PNG/PDF-Export (falls server-seitiger Render nötig)"
        - "User-Lifecycle E-Mails triggern (alternativ zu pg_cron)"
      runtime: "Deno"
    supabase_storage:
      use_for: ["PNG-Exports zwischenspeichern", "Custom-Formation-Icons (Team-Tier)"]
    supabase_realtime:
      use_for: ["Echtzeit-Kollaboration (Phase 2, Team-Tier)"]
      phase: 2

payments:
  primary: "Stripe"
  integration:
    - "Stripe Checkout (für Subscription-Start)"
    - "Stripe Customer Portal (für Verwaltung, Kündigung, Plan-Wechsel)"
    - "Stripe Webhooks → Supabase Edge Function → DB-Update"
  eu_alternative: "Paddle (falls EU-Steuer-Handling zu aufwändig wird)"
  note: "Mit Stripe beginnen. Paddle erst evaluieren wenn steuerliche Komplexität tatsächlich zum Problem wird."

email:
  provider: "Resend"
  policy:
    double_opt_in: "NUR für Newsletter / Marketing-E-Mails"
    transactional:
      requires_opt_in: false
      examples:
        - "Willkommens-E-Mail nach Signup"
        - "Einladungs-Links (Team-Tier)"
        - "Inaktivitäts-Reminder (60/80 Tage)"
        - "Zahlungs-Bestätigungen"
      must_not_contain: "Werbung, Upsell-Inhalte, Newsletter-Inhalte"

infrastructure:
  strategy: "Vereinsnah und kostenschlank — kein PaaS-Overhead wo nicht nötig"
  hosting_options_acceptable:
    docker_vps:
      example: "Hetzner CX21 (2 vCPU, 4 GB RAM, ~5 EUR/Monat)"
      orchestration: "Coolify (self-hosted PaaS, Docker-basiert)"
      suited_for: "Frontend-Build als statische Files + Edge Functions via Supabase"
    managed_paas:
      options: ["Railway", "Fly.io"]
      suited_for: "Falls zusätzlicher Node.js-Prozess nötig wird (z.B. PDF-Render-Service)"
  note: "Vercel ist NICHT zwingend — Static Build (vite build) läuft auf jedem Webserver / Nginx."
  cdn: "Cloudflare (Free-Tier reicht für Anfang — Proxy + DDoS-Schutz)"
  monitoring:
    errors: "Sentry (Free-Tier)"
    analytics: "Posthog (self-hosted auf dem VPS, oder EU-Cloud)"
  maps: "Mapbox (Satellite-Tiles, API-Key server-seitig gesichert) + OSM (Standard, direkt)"

data_model:
  users:
    id: uuid
    email: string
    tier: enum[free, pro, team]
    stripe_customer_id: string
    last_active_at: timestamp
    reminder_60_sent_at: timestamp     # nullable
    reminder_80_sent_at: timestamp     # nullable
    is_deleted: boolean
    deleted_at: timestamp              # nullable
    created_at: timestamp

  organizations:            # für Team-Tier
    id: uuid
    name: string
    tier: enum[team]
    owner_id: uuid
    stripe_subscription_id: string
    seats: integer

  org_members:
    org_id: uuid
    user_id: uuid
    role: enum[owner, editor, viewer]

  workspaces:
    id: uuid
    org_id: uuid
    name: string

  tracks:
    id: uuid
    owner_id: uuid
    workspace_id: uuid        # null für persönliche Strecken
    name: string
    description: string
    is_public: boolean
    public_token: string      # für Share-Links
    current_version_id: uuid
    created_at: timestamp
    updated_at: timestamp

  track_versions:
    id: uuid
    track_id: uuid
    version_number: integer
    state_json: jsonb         # PlacedFormation[] + PlacedArrow[]
    area_sel_json: jsonb
    created_by: uuid
    created_at: timestamp

  custom_formations:          # Team+
    id: uuid
    org_id: uuid
    key: string
    label: string
    description: string
    definition_json: jsonb
    created_by: uuid

  regulation_rules:           # Team+
    id: uuid
    org_id: uuid              # null = system-defined
    name: string
    body_name: string         # "DMSB", "ADAC", "kantonalSH"
    rules_json: jsonb

  templates:
    id: uuid
    org_id: uuid              # null = system template
    name: string
    description: string
    tier_required: enum
    track_version_id: uuid
```

### 4.2 API-Endpoints (RESTful)

```yaml
auth:
  - POST /auth/signup
  - POST /auth/login
  - POST /auth/logout
  - GET  /auth/me

tracks:
  - GET    /tracks                    # alle eigenen + org tracks
  - POST   /tracks                    # neue Strecke erstellen
  - GET    /tracks/:id                # Strecke laden
  - PUT    /tracks/:id                # Strecke speichern (neue Version)
  - DELETE /tracks/:id
  - GET    /tracks/:id/versions       # Version-Historie
  - POST   /tracks/:id/duplicate      # Strecke kopieren
  - GET    /tracks/shared/:token      # öffentliche Strecke via Share-Link

organizations:
  - GET    /orgs/:id
  - POST   /orgs                      # neue Organisation
  - PUT    /orgs/:id
  - POST   /orgs/:id/invite           # Mitglied einladen
  - DELETE /orgs/:id/members/:uid

billing:
  - GET    /billing/plans             # verfügbare Plans
  - POST   /billing/checkout          # Stripe Checkout Session
  - POST   /billing/portal            # Stripe Customer Portal
  - POST   /billing/webhook           # Stripe Webhook

export:
  - POST /export/svg    # { trackId } -> SVG string
  - POST /export/pdf    # { trackId } -> PDF (via headless Chrome)
  - POST /export/png    # { trackId } -> PNG
  - POST /export/dxf    # { trackId } -> DXF (Team+)

formations:
  - GET  /formations           # Standard-Bibliothek
  - GET  /formations/custom    # Custom-Formationen der Org
  - POST /formations/custom    # Neue Custom-Formation (Team+)

templates:
  - GET  /templates            # verfügbare Templates für den Tier
  - POST /tracks/from-template # Strecke aus Template erstellen
```

### 4.3 Echtzeit-Kollaboration

```yaml
collaboration_strategy:
  approach: "operational_transformation_or_crdts"
  library_candidates:
    - "Yjs (CRDT, bewährt, gut mit Vite integrierbar)"
    - "PartyKit (managed Websocket-Hosting mit Yjs-Support)"

  conflict_resolution:
    formations: "position-based merge (letzter Schreiber gewinnt per Formation)"
    arrows: "letzter Schreiber gewinnt"
    area_selection: "letzter Schreiber gewinnt"

  presence:
    - user_cursors: true       # wo ist wer auf dem Canvas
    - user_avatars: true       # wer ist gerade online
    - edit_lock_per_formation: optional  # optional: Lock beim Bewegen

  tier_gate: "team_and_enterprise_only"
```

---

## 5. SICHERHEITS-ANFORDERUNGEN

### 5.1 Authentifizierung & Autorisierung

```yaml
auth_requirements:
  authentication:
    method: "JWT + Refresh Tokens"
    provider_recommendation: "Clerk (managed) oder Auth.js (self-hosted)"
    mfa: "optional für Basis, empfohlen für Team/Enterprise"
    sso: "Enterprise-only (SAML 2.0)"
    password_policy:
      min_length: 12
      complexity: "mindestens Groß+Klein+Zahl oder Sonderzeichen"

  authorization:
    model: "RBAC (Role-Based Access Control)"
    roles:
      - owner:  "vollständige Kontrolle über Org + alle Workspaces"
      - admin:  "Mitglieder verwalten, aber kein Billing"
      - editor: "Strecken erstellen + bearbeiten in zugewiesenen Workspaces"
      - viewer: "nur lesen"
    resource_ownership:
      - "Jede Strecke hat einen owner_id"
      - "Org-Strecken sind über workspace_id der Org zugeordnet"
      - "Share-Links generieren zufällige Tokens (32 Byte, URL-safe)"
    public_tracks:
      - "Kein Auth nötig für GET /tracks/shared/:token"
      - "Token ist nicht erratbar (crypto random)"
```

### 5.2 Datenschutz (DSGVO/GDPR)

```yaml
gdpr_requirements:
  data_residency: "EU (Deutschland oder Irland bevorzugt)"
  processing_agreement: "DPA für Team/Enterprise Kunden"
  personal_data_stored:
    - email
    - name (optional)
    - ip_address (logs, 30 Tage retention)
    - track_content (kein PII per se, aber Geodaten könnten PII sein)

  user_rights:
    - right_to_access: "GET /account/data-export → ZIP mit allen Strecken + Account-Daten"
    - right_to_delete: "DELETE /account → vollständiges Löschen inkl. Strecken"
    - right_to_rectification: "PATCH /account → Daten korrigieren"

  data_retention:
    active_account: "solange Account aktiv"
    after_deletion: "sofortige Anonymisierung, Backups überschrieben nach 30 Tagen"
    logs: "30 Tage"

  cookie_policy:
    strictly_necessary: ["session_token", "csrf_token"]
    analytics: "opt-in, Posthog mit Server-Side-Proxy"
    marketing: "nicht empfohlen für B2B SaaS"
```

### 5.3 API-Sicherheit

```yaml
api_security:
  rate_limiting:
    unauthenticated: "20 requests/minute per IP"
    free_tier: "60 requests/minute per user"
    pro_tier: "300 requests/minute per user"
    team_tier: "1000 requests/minute per org"

  input_validation:
    - "Zod-Schemas für alle API-Inputs"
    - "JSON-Größenbeschränkung: max 5 MB pro Track-State"
    - "Formation-Count per Track: max 500 (Abuse-Prevention)"

  output_encoding:
    - "SVG-Export: alle User-Inhalte (Labels) HTML-escaped"
    - "Keine Code-Execution in generierten Dokumenten"

  cors:
    allowed_origins: ["https://app.kartslalom.de", "https://kartslalom.de"]
    credentials: true

  security_headers:
    - "Content-Security-Policy"
    - "X-Frame-Options: DENY"
    - "X-Content-Type-Options: nosniff"
    - "Strict-Transport-Security"

  secrets_management:
    - "Alle Secrets in Umgebungsvariablen, nie in Code"
    - "Stripe Webhooks mit Signature-Verification"
    - "Mapbox API-Keys: domain-restricted"
```

### 5.4 Infrastruktur-Sicherheit

```yaml
infrastructure_security:
  database:
    - "Row-Level-Security (RLS) wenn Supabase"
    - "Alle Queries parametrisiert (kein raw SQL mit User-Input)"
    - "Datenbankverbindung nur vom Backend, nie direkt vom Browser"
    - "Tägliche automatische Backups, Point-in-Time-Recovery"

  tls:
    - "TLS 1.2+ für alle Verbindungen"
    - "HSTS aktiviert"

  dependency_security:
    - "Dependabot oder Renovate für automatische Dependency-Updates"
    - "npm audit in CI/CD Pipeline"
    - "Keine Packages mit bekannten kritischen CVEs"

  monitoring:
    - "Sentry für Fehler-Tracking (kein PII in Error-Messages)"
    - "Uptime-Monitoring (BetterStack oder UptimeRobot)"
    - "Alert bei >1% Error-Rate oder P99 Latenz >2s"

  penetration_testing:
    - "OWASP Top 10 Checkup vor Go-Live"
    - "Jährlicher Pen-Test für Enterprise-Kunden"
```

---

## 6. MONETARISIERUNGSPLAN

### 6.1 Preismodell-Zusammenfassung

```yaml
pricing_model:
  type: "freemium_subscription"
  billing_cycles: [monthly, yearly]
  yearly_discount: "~31% (entspricht 2 Monate gratis)"
  tier_count: 3              # Free, Pro, Team — kein Enterprise

  tiers:
    free:
      price_monthly: 0
      price_yearly: 0
      export_gate: true      # Export NUR nach Login — Haupt-Conversion-Trigger
      target_conversion_rate: "5-15% -> Pro innerhalb 6 Monate"

    pro:
      price_monthly: 12
      price_yearly: 99
      target_users_year1: 200

    team:
      price_monthly: 39
      price_yearly: 329
      included_seats: 5
      per_additional_seat: 6
      target_orgs_year1: 30
```

### 6.2 Revenue-Projektion (Jahr 1)

```yaml
year1_revenue_projection:
  assumptions:
    free_users_end_of_year: 2000
    pro_conversion_rate: 0.08        # 8% der Free User
    pro_users_avg_monthly: 80
    pro_avg_plan: "mix 60% monatlich, 40% jährlich"

    team_orgs_avg_monthly: 15
    team_avg_mrr_per_org: 51         # ~39 + 2 extra Seats

    enterprise_orgs: 3
    enterprise_avg_mrr: 220

  mrr_month_12:
    pro: 80_users * 10_avg = 800     # EUR (gemischt monatlich/jährlich)
    team: 15_orgs * 51 = 765         # EUR
    total_mrr_month12: ~1565         # EUR (kein Enterprise-Tier)

  arr_year1: ~10000                  # EUR (konservativ, inkl. Ramp-up)
  arr_year2_target: ~45000           # EUR
  arr_year3_target: ~120000          # EUR

  note: "Markt ist Nische (DACH Kartslalom), aber sticky und zahlungsbereit. Export-Gate erhöht Free-to-Paid-Conversion signifikant."
```

### 6.3 Umsatz-Hebel & Growth-Strategie

```yaml
growth_strategy:
  acquisition:
    channels:
      - name: "Organisch / SEO"
        tactics:
          - "Blog: 'Kartslalom Strecken planen' Keyword-Cluster"
          - "Kostenlose Strecken-Templates öffentlich indexierbar"
          - "Tool-Verzeichnisse: Producthunt, AppSumo (Launch)"

      - name: "Community"
        tactics:
          - "DMSB / ADAC Kartslalom Facebook-Gruppen"
          - "YouTube Tutorial: 'Wettkampfstrecke in 10 Minuten planen'"
          - "Kostenloses Webinar für Vereinsvorstände"

      - name: "Partnerships"
        tactics:
          - "DMSB Offizieller Partner werden -> Verband empfiehlt Tool"
          - "Kartbahn-Hersteller (CRG, Tony Kart) als Empfehlungspartner"
          - "Trainingscamp-Veranstalter als Affiliates"

      - name: "Virality"
        tactics:
          - "Jede geteilte Strecke hat 'Erstellt mit Kartslalom Streckenplaner'-Badge"
          - "Einbettbarer Track-Viewer für Vereins-Websites"
          - "PDF-Export mit Branding im Free Tier"

  retention:
    - "Email Onboarding-Sequenz (5 Mails in 14 Tagen)"
    - "In-App Tooltips für Key-Features"
    - "Monatlicher 'Strecken-Inspirations'-Newsletter mit Community-Tracks"
    - "Jährliche Renewal-Erinnerung 30 Tage vorher mit Rabatt-Angebot"

  expansion:
    - "Seat-Expansion im Team-Tier (low friction: einfach Einladen)"
    - "Upsell Free->Pro nach 3. Strecken-Speicherung"
    - "Upsell Pro->Team wenn Sharing-Feature genutzt wird"
    - "Upsell Pro->Team wenn Sharing-Feature oder 2. Nutzer hinzugefügt werden soll"
```

### 6.4 Zusätzliche Umsatzquellen

```yaml
additional_revenue:
  marketplace:
    description: "Marketplace für Premium-Strecken-Templates von zertifizierten Coaches"
    revenue_model: "70/30 Split (Ersteller/Plattform)"
    timeline: "Jahr 2"
    estimated_gmv_year2: 5000   # EUR

  certification:
    description: "Offizielles Zertifikat 'Geprüfter Kartslalom-Streckenplaner'"
    price: 49                    # EUR einmalig
    timeline: "Jahr 2"

  api_premium:
    description: "Paid API für Event-Management-Systeme"
    price: 99                    # EUR/Monat
    timeline: "Jahr 2-3"

  training:
    description: "Online-Kurs 'Professionelle Kartslalom-Strecken'"
    price: 149                   # EUR einmalig
    timeline: "Jahr 1-2"
```

---

## 7. IMPLEMENTIERUNGS-ROADMAP

### 7.1 Phasen-Überblick

```yaml
roadmap:
  phase_0:
    name: "Foundation"
    duration: "4-6 Wochen"
    priority: "kritisch"
    tasks:
      - "Domain + Hosting Setup (Vercel + Railway)"
      - "Auth-Integration (Clerk oder Supabase Auth)"
      - "PostgreSQL-Schema erstellen und migrieren"
      - "Cloud-Save API implementieren (GET/PUT /tracks/:id)"
      - "Stripe-Integration (Checkout + Webhook)"
      - "Basis-Tier-Gates im Frontend implementieren"
    deliverable: "Nutzer können sich anmelden und Strecken in der Cloud speichern"

  phase_1:
    name: "Pro Features"
    duration: "4-6 Wochen"
    priority: "hoch"
    tasks:
      - "Satellite-Maps (Mapbox)"
      - "Polygon-Area-Selection (bereits im Code, nur Tier-Gate)"
      - "Share-Links (read-only)"
      - "Version-Historie (10 Versionen)"
      - "PNG-Export (via html-to-image oder puppeteer)"
      - "Templates-System"
      - "Onboarding-Flow + Welcome-Emails"
    deliverable: "Pro-Tier vollständig funktional"

  phase_2:
    name: "Team Features"
    duration: "6-8 Wochen"
    priority: "hoch"
    tasks:
      - "Organisations-Management"
      - "Einladungs-System (E-Mail-Link)"
      - "Rollen-System (RBAC)"
      - "Workspaces"
      - "Echtzeit-Kollaboration (Yjs + PartyKit)"
      - "Custom-Formationen"
      - "DXF-Export"
      - "Compliance-PDF-Reports"
    deliverable: "Team-Tier vollständig funktional"

  phase_3:
    name: "Growth & Polish"
    duration: "ongoing"
    priority: "mittel"
    tasks:
      - "Analytics-Dashboard für Nutzer (Strecken-Statistiken)"
      - "Marketplace für Community-Templates"
      - "Mobile-responsive Edit-Modus"
      - "Regulation-Datenbank (DMSB, ADAC) für Team-Tier"
      - "In-App Onboarding-Tooltips"
    deliverable: "Retention-Features + Community-Wachstum"
```

### 7.2 Kritische Abhängigkeiten

```yaml
critical_dependencies:
  maps_satellite:
    provider: "Mapbox"
    why: "OSM bietet kein offizielles Satellite-Tile-API"
    cost: "Free bis 50.000 Map loads/Monat, dann $0.50/1000"
    risk: "API-Key muss server-seitig proxied werden"

  pdf_generation:
    current: "window.print() (client-side, kein server-side control)"
    needed: "Puppeteer oder @playwright/browser auf Server"
    alternative: "pdf-lib (pure JS, kein Browser needed)"
    recommendation: "pdf-lib für einfache Layouts, Puppeteer für pixel-perfect"

  realtime_collab:
    library: "Yjs"
    hosting: "PartyKit (managed) oder eigene WebSocket-Server"
    complexity: "HOCH — Konfliktauflösung bei gleichzeitiger Formation-Verschiebung"
    mvp_simplification: "Optimistic Locking statt CRDT für Phase 2 MVP"
```

---

## 8. KPI & METRIKEN

```yaml
kpis:
  acquisition:
    - name: "CAC (Customer Acquisition Cost)"
      target_year1: "<50 EUR"
    - name: "Organic Share"
      target_year1: ">60%"
    - name: "Free Signup Rate"
      target: ">40% der Besucher testen das Tool"

  activation:
    - name: "Activated User"
      definition: "User der in ersten 7 Tagen mindestens 1 Strecke erstellt + exportiert"
      target: ">35% aller Signups"
    - name: "Aha-Moment"
      definition: "Erste gespeicherte Cloud-Strecke"
      target: "innerhalb Session 1"

  retention:
    - name: "Monthly Active Users"
      target_year1: ">40% der Free, >70% der Pro"
    - name: "Net Revenue Retention"
      target: ">100% (Expansion > Churn)"

  monetization:
    - name: "Free-to-Paid Conversion"
      target: "8-12% innerhalb 90 Tage"
    - name: "Monthly Churn"
      target: "<3% für Pro, <1.5% für Team"
    - name: "ARPU (Average Revenue Per User)"
      target_year1: "8 EUR/Monat (inkl. Free)"

  satisfaction:
    - name: "NPS"
      target: ">40"
    - name: "Support Tickets per 100 MAU"
      target: "<2"
```

---

## 9. RISIKEN & MITIGATIONEN

```yaml
risks:
  - id: R1
    name: "Markt zu klein"
    probability: "medium"
    impact: "high"
    mitigation: "Erweitern auf verwandte Sportarten (Autocross, Gymkhana, Trial-Slalom)"

  - id: R2
    name: "Verbands-Regulierung"
    probability: "low"
    impact: "high"
    mitigation: "Früh mit DMSB/ADAC sprechen, offizieller Partner werden"

  - id: R3
    name: "Map-Provider Kosten skalieren"
    probability: "medium"
    impact: "medium"
    mitigation: "Server-seitiges Tile-Caching, Cost-Per-User kalkulieren vor Satellite-Rollout"

  - id: R4
    name: "Echtzeit-Kollaboration zu komplex"
    probability: "high"
    impact: "medium"
    mitigation: "Phase 2 mit Optimistic Locking statt echtem CRDT starten"

  - id: R5
    name: "Copycats / Open Source Alternative"
    probability: "medium"
    impact: "medium"
    mitigation: "Netzwerkeffekte durch Community-Templates + Verbands-Partnerships"

  - id: R6
    name: "DSGVO-Verstoß (Geo-Daten)"
    probability: "low"
    impact: "high"
    mitigation: "Datenschutzbeauftragter konsultieren, EU-Hosting ab Tag 1, DPA-Template"
```

---

## 10. BESCHLOSSENER TECH-STACK (v1.2)

Diese Entscheidungen sind getroffen. Keine Alternativen mehr zu evaluieren.

```yaml
stack:
  status: "ENTSCHIEDEN"
  version: "1.2"
  decided_on: "2026-06-02"

  frontend:
    keep:
      - package: "react"         version: "^18"
      - package: "typescript"
      - package: "vite"
    add:
      - package: "react-router-dom"   purpose: "Routing (Login, Dashboard, Editor, Settings, Share)"
      - package: "@tanstack/react-query" purpose: "Server-State — Tracks laden/speichern, Cache-Invalidierung"
      - package: "zustand"            purpose: "Client-State — ersetzt useState-Chaos in App.tsx"
      - package: "zod"                purpose: "Input-Validierung, API-Response-Typen, Formulare"
      - package: "@supabase/supabase-js" purpose: "Auth-Client + DB-Client"

  backend:
    platform: "Supabase"
    eu_region: true
    components:
      - name: "Supabase Auth"
        use: "Login, Magic Link, Session"
        no_alternative: true
      - name: "Supabase Postgres"
        use: "Alle App-Daten"
        no_alternative: true
      - name: "Row Level Security (RLS)"
        use: "Datentrennung — User sieht nur eigene/org-eigene Daten"
        critical: true
        no_alternative: true
      - name: "Supabase Edge Functions"
        use: ["Stripe Webhook", "Export-Trigger", "Lifecycle-E-Mail-Trigger"]
        runtime: "Deno"
      - name: "Supabase Storage"
        use: ["PNG-Exports", "Custom-Formation-Icons"]
      - name: "Supabase Realtime"
        use: "Kollaboration (Phase 2 / Team-Tier)"
        phase: 2

  payments:
    primary: "Stripe"
    integration:
      - "Stripe Checkout (Subscription starten)"
      - "Stripe Customer Portal (Verwalten, Kündigen, Plan-Wechsel)"
      - "Stripe Webhooks → Edge Function → DB"
    fallback: "Paddle — nur evaluieren wenn EU-Steuer-Overhead tatsächlich zum Problem wird"

  email:
    provider: "Resend"
    double_opt_in: "nur Newsletter / Marketing"
    transactional_no_opt_in_required:
      - Willkommens-Mail nach Signup
      - Team-Einladungs-Links
      - Inaktivitäts-Reminder (60 Tage / 80 Tage)
      - Zahlungsbestätigungen / Receipts
    rule: "Transaktionsmails enthalten keinen Marketinginhalt"

  hosting:
    principle: "vereinsnah + kostenschlank — kein PaaS-Overhead wo nicht nötig"
    frontend:
      deployment: "Statischer Build (vite build) → Nginx oder Coolify"
      note: "Vercel nicht nötig"
    preferred_vps: "Hetzner (EU, günstig, DSGVO-konform)"
    orchestration: "Coolify (self-hosted PaaS auf dem VPS, Docker-basiert)"
    acceptable_managed:
      - "Railway"
      - "Fly.io"
      use_when: "zusätzliche Server-Prozesse nötig werden (z.B. PDF-Render)"
    cdn: "Cloudflare Free Tier (Proxy + DDoS)"

  monitoring:
    errors: "Sentry (Free Tier)"
    analytics: "Posthog (self-hosted auf dem VPS)"
    uptime: "UptimeRobot Free (5-Minuten-Intervall)"

  maps:
    standard: "OpenStreetMap (direkt, keine API-Key nötig)"
    satellite: "Mapbox (API-Key server-seitig via Edge Function proxied)"

  lifecycle_cron:
    preferred: "Supabase Edge Function + pg_cron Extension"
    alternative: "Externer Cron-Service (GitHub Actions Scheduled Workflow, kostenlos)"
```

---

*Dieses Dokument ist maschinenlesbar strukturiert (YAML-Blöcke in Markdown).  
Es kann von LLMs, Analyse-Scripts und Menschen gleichermaßen ausgewertet werden.*

*Nächste Revisionsdate: 2026-09-01 oder nach Phase-0-Abschluss.*
