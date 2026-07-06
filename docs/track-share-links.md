# Track-Share-Links

Öffentliche, widerrufbare Nur-Lese-Links auf eine Strecke — ohne Anmeldung
für Betrachter. Pro/Team-Feature, bewusst einfach gehalten (siehe
[`docs/planning/IMPLEMENTATION_PLAN.md`](planning/IMPLEMENTATION_PLAN.md#23-share-links--rate-limiting--token-widerruf-planungsstand-2026-07-03)
für den ursprünglichen, umfangreicheren Entscheidungsrahmen):

- **1 aktiver Link pro Strecke.** Kein Verlauf mehrerer Tokens — ein neu
  erzeugter Link ersetzt den alten sofort.
- **Kein Ablaufdatum per Default.** Widerruf und Neu-Erzeugen reichen; ein
  automatisch ablaufender Link wäre für Rennvorbereitung/Vereinskommunikation
  eher störend als nützlich.
- **Nur lesender Snapshot-Zugriff**, keine E-Mail/Eigentümerdaten öffentlich.

## Datenmodell

Nutzt die bereits in `20260615120000_app_schema.sql` vorbereiteten Spalten
auf `tracks` statt einer eigenen Tabelle (es gibt ohnehin nie mehr als einen
aktiven Token pro Strecke):

- `is_public boolean`, `public_token_hash text` (SHA-256-Hash, Plaintext nur
  einmalig bei der Erzeugung zurückgegeben)
- `share_access_count integer`, `share_window_started_at timestamptz` — für
  den einfachen Rate-Limit-Zähler in `get_track_by_share_token()`

Migration: `supabase/migrations/20260706000001_track_share_links.sql`.

## RPCs

- `create_track_share_link(p_track_id uuid) returns text` — nur Pro/Team,
  nur Eigentümer. Erzeugt einen neuen 256-Bit-Zufallstoken (hex), speichert
  nur dessen SHA-256-Hash, gibt den Plaintext einmalig zurück.
- `revoke_track_share_link(p_track_id uuid) returns void` — nur Eigentümer.
- `get_track_by_share_token(p_token text) returns table(...)` — `anon` +
  `authenticated`, kein Ownership-Check. Reduzierter Feldsatz (analog
  `get_library_formations()`): keine `owner_id`, keine E-Mail. Ungültiger und
  widerrufener Token liefern denselben `token_invalid`-Fehler (kein
  Unterschied nach außen, der Enumeration begünstigen würde). Ein gelöschter
  Track oder ein soft-gelöschter Account (`profiles.is_deleted`) machen den
  Link automatisch ungültig, ohne dass `revoke_track_share_link` explizit
  aufgerufen werden müsste.

## Rate Limiting

Zwei Ebenen, bewusst getrennt:

1. **IP-basiert, Cloudflare-Tunnel-Ebene** — Infra-Konfiguration außerhalb
   dieses Repos, siehe Betriebs-Roadmap (Ops-Block). Noch nicht eingerichtet.
2. **Einfacher Zähler pro Token** in `get_track_by_share_token()` (max. 120
   Aufrufe/Stunde, sonst `rate_limit_exceeded`) — Verteidigungstiefe, falls
   (1) fehlt oder umgangen wird. Kein Kong-Rate-Limiting-Plugin im Repo.

## Frontend

- `src/features/track-share/` — Feature-Slice (api/hooks/components/types/tests).
  `getSharedTrack()`/`useSharedTrack()` für die öffentliche Seite,
  `ShareLinkDialog` für die Eigentümer-UI (Editor-Header, "Teilen"-Button,
  gesperrt für Free via `useTier().canShareLinks`).
- `create_track_share_link`/`revoke_track_share_link` liegen als normale
  Track-Mutationen in `src/lib/api/tracks.ts` / `src/hooks/useTracks.ts`
  (analog `renameTrack`), da sie Eigentümer-seitige Track-Operationen sind —
  nur die öffentliche, nicht-authentifizierte Hälfte des Features liegt im
  Feature-Slice.
- `src/pages/SharedTrackPage.tsx`, Route `/share/:token` (öffentlich, kein
  `AuthGuard`, siehe `router.tsx`). Rendert die Strecke über dieselbe
  `generateTrackSVG()`-Pipeline wie SVG/PDF/PNG-Export — aber **nicht** über
  `dangerouslySetInnerHTML`. `generateTrackSVG()` interpoliert
  Custom-Formation-Labels (Freitext) ungeschützt in den SVG-String; als
  direktes DOM-Element wäre das ein Stored-XSS-Risiko für anonyme Besucher.
  Stattdessen wird das SVG als `data:`-URI in ein `<img>` geladen — Browser
  führen darin enthaltene `<script>`/Event-Handler grundsätzlich nie aus.

## Bewusst nicht in diesem Umfang

- Mehrere gleichzeitig aktive Links pro Strecke.
- Ablaufdatum/Gültigkeitsdauer.
- Esri-/OSM-Nutzungsbedingungen für öffentlich geteilte Kartenhintergründe —
  separat zu prüfen (siehe Roadmap), nicht Teil dieser Implementierung.
