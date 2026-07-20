// delete-account — dünner Deno.serve-Entrypoint.
// Logik in handler.ts (siehe dortiger Kommentar) — main/index.ts importiert
// denselben handler direkt, kein Duplikat mehr.
// CORS-Header werden dort in corsHeaders() gesetzt, nicht hier.
export { handler } from "./handler.ts";
import { handler } from "./handler.ts";
Deno.serve(handler);
