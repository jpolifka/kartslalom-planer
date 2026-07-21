// map-background-image — dünner Deno.serve-Entrypoint.
// Logik in handler.ts (siehe dortiger Kommentar) — main/index.ts importiert
// denselben handler direkt, kein Duplikat mehr.
// CORS-Header werden dort in corsHeaders() gesetzt, nicht hier. PROVIDERS
// wird zusätzlich reexportiert, damit mapProviderConfigDrift.test.ts die
// serverseitige Allowlist gegen src/lib/mapProviders.ts abgleichen kann.
export { handler, PROVIDERS } from "./handler.ts";
import { handler } from "./handler.ts";
Deno.serve(handler);
