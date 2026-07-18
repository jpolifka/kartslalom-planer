// user-lifecycle — dünner Deno.serve-Entrypoint.
// Logik in handler.ts (siehe dortiger Kommentar) — main/index.ts importiert
// denselben handler direkt, kein Duplikat mehr.
export { handler } from "./handler.ts";
import { handler } from "./handler.ts";
Deno.serve(handler);
