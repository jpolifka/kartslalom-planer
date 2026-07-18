// map-background-image — dünner Deno.serve-Entrypoint.
// Logik in handler.ts (siehe dortiger Kommentar) — main/index.ts importiert
// denselben handler direkt, kein Duplikat mehr.
export { handler, PROVIDERS } from "./handler.ts";
import { handler } from "./handler.ts";
Deno.serve(handler);
