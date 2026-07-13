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
  `get_library_formations()`): keine `owner_id`, keine E-Mail, **und bewusst
  kein `area_sel_json`/`map_provider_id`/`map_opacity`** (siehe Abschnitt
  "Kartenhintergrund" unten — der Viewer zeigt ohnehin keinen Kartenhintergrund,
  `area_sel_json` würde also nur ungenutzt die genauen Geokoordinaten der
  Strecke öffentlich preisgeben). Ungültiger und widerrufener Token liefern
  denselben `token_invalid`-Fehler (kein Unterschied nach außen, der
  Enumeration begünstigen würde). Ein gelöschter Track oder ein
  soft-gelöschter Account (`profiles.is_deleted`) machen den Link automatisch
  ungültig, ohne dass `revoke_track_share_link` explizit aufgerufen werden
  müsste.

## Rate Limiting

Zwei Ebenen, bewusst getrennt:

1. **IP-basiert, Cloudflare-Tunnel-Ebene** — Infra-Konfiguration außerhalb
   dieses Repos, siehe Betriebs-Roadmap (Ops-Block). Noch nicht eingerichtet.
2. **Einfacher Zähler pro Token** in `get_track_by_share_token()` (max. 3000
   Aufrufe/Stunde, sonst `rate_limit_exceeded`) — Verteidigungstiefe, falls
   (1) fehlt oder umgangen wird. Kein Kong-Rate-Limiting-Plugin im Repo.

   Ursprünglich 120/h (Red-Team-Review 2026-07-13): bei einem global pro
   Token statt pro IP geführten Zähler kann ein Angreifer, der den Link
   kennt, ihn absichtlich ausschöpfen und damit legitime Besucher für den
   Rest des Stundenfensters aussperren (DoS gegen den Track-Eigentümer).
   3000/h ist als Notfall-Bremse gegen automatisiertes Scraping gedacht,
   nicht als praktisches Pro-Besucher-Limit — solange (1) fehlt, ist dieser
   Zähler die einzige aktive Schutzschicht, ein hartes Limit auf einer für
   normale Nutzung leicht erreichbaren Schwelle wäre also selbst das Risiko.
   Zusätzlich wurde `for update of t` (Row-Lock bei jedem Lesezugriff)
   entfernt — Lesezugriffe auf denselben Link liefen dadurch serialisiert;
   der Zähler ist ohne Lock nicht mehr exakt (verlorene Updates unter hoher
   Nebenläufigkeit möglich), das ist für reine Verteidigungstiefe akzeptabel.

## Kartenhintergrund: bewusst nicht im öffentlichen Viewer

Geprüft am 2026-07-06 (Esri/OSM-Nutzungsbedingungen, wie im Phase-2-Plan als
DoD gefordert):

- **Esri World Imagery** (Satellitenbild, `server.arcgisonline.com/.../World_Imagery/...`):
  Der kostenlose Zugriff ist laut Esri-Nutzungsbedingungen nur für
  **"Noncommercial Use"** freigegeben — definiert als: niemand generiert
  Einnahmen oder einen kommerziellen Vorteil aus der Nutzung. Satellitenbild
  ist im Code zwar ein Pro/Team-Gate, aktuell steckt aber kein monetäres
  Modell dahinter (kein tatsächlicher Geldfluss, siehe Zahlungsmodell-Doku) —
  die "Noncommercial Use"-Einstufung passt damit aktuell noch. Relevant wird
  das erst, sobald für Pro/Team echt bezahlt wird; dann vor einem
  öffentlichen Rollout neu bewerten (Lizenz einholen, Anbieter wechseln oder
  Feature aus dem Pro-Gate nehmen).
- **OpenStreetMap** (`tile.openstreetmap.org`, Straßenkarte): Kommerzielle
  Nutzung der OSM-Daten selbst ist erlaubt (ODbL), aber die Tile-Usage-Policy
  des Demo-Servers ist ausdrücklich nur für Entwicklung/geringes Volumen
  gedacht — für produktive öffentliche Nutzung wird ein kommerzieller
  Anbieter oder Self-Hosting empfohlen. Der öffentliche Demo-Server wird
  während der Pilotphase bewusst weiter genutzt (geringer Traffic); eine
  Neubewertung erfolgt bei relevantem Traffic oder vor einem größeren
  öffentlichen Rollout (siehe `docs/roadmap.md`, Phase "Später").

**Update (2026-07-08):** Esri World Imagery wurde vollständig durch den
amtlichen RLP-DOP20-WMS-Dienst (GeoBasis-DE/LVermGeoRP, dl-de/by-2-0) ersetzt
— siehe `src/lib/mapProviders.ts`. Damit ist der oben offen gelassene
Esri-Lizenzpunkt erledigt; die RLP-DOP20-Nutzungsbedingungen (dl-de/by-2-0)
erlauben kommerzielle Nutzung inkl. öffentlicher Weiterverbreitung, solange
die Quelle genannt wird (Attribution im Provider-Eintrag hinterlegt). Die
OSM-Tile-Usage-Policy-Frage (Demo-Server) ist kein akuter Blocker mehr,
sondern eine bewusst zurückgestellte Entscheidung für die Zeit nach der
Pilotphase (siehe `docs/roadmap.md`).

**Entscheidung (2026-07-06, weiterhin gültig):** Der öffentliche Share-Viewer
(`/share/:token`) zeigt generell **keinen Kartenhintergrund**, unabhängig
davon, ob die Strecke selbst mit Luftbild/Straßenkarte gespeichert wurde. Das
war ursprünglich zur Reduktion der öffentlichen Esri-Exposition gedacht;
bleibt aber auch nach dem RLP-DOP20-Wechsel bestehen (kein zusätzlicher
Nutzen, öffentliche Geokoordinaten unnötig preiszugeben — siehe
`SharedTrackDetail` in `src/features/track-share/types.ts`). OSM-Tile-
Anbieterwechsel/Self-Hosting ist im Betriebs-Block (Backup/Monitoring) der
Roadmap eingeplant, nicht Teil dieses Features.

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
- OSM-Tile-Anbieterwechsel/Self-Hosting — zurückgestellt auf "Später"
  (`docs/roadmap.md`), erst bei relevantem Traffic.
