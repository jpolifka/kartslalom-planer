// account-export — dünner Deno.serve-Entrypoint.
// Logik in handler.ts (siehe dortiger Kommentar) — main/index.ts importiert
// denselben handler direkt, kein Duplikat mehr.
// CORS-Header (Access-Control-Allow-Origin/-Headers) werden dort in
// corsHeaders() gesetzt, nicht hier — dieser Entrypoint ruft nur den Handler
// unverändert per Deno.serve() auf.
export { handler } from "./handler.ts";
import { handler } from "./handler.ts";
Deno.serve(handler);
