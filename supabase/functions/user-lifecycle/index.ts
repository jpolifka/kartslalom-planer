// user-lifecycle — dünner Deno.serve-Entrypoint.
// Logik in handler.ts (siehe dortiger Kommentar) — main/index.ts importiert
// denselben handler direkt, kein Duplikat mehr.
// Kein corsHeaders() hier/dort — diese Function wird nie aus dem Browser
// aufgerufen (nur Server-zu-Server-Cron mit x-cron-secret), siehe Kommentar
// in handler.ts.
export { handler } from "./handler.ts";
import { handler } from "./handler.ts";
Deno.serve(handler);
