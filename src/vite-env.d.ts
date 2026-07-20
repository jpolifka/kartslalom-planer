/// <reference types="vite/client" />

// Wird von vite.config.ts per define zur Build-Zeit aus package.json injiziert
// (kein echtes Modul/keine Laufzeit-Variable) — genutzt u. a. in FeedbackDialog.tsx,
// um die App-Version an Fehlerberichten anzuhängen.
declare const __APP_VERSION__: string;

// Projektspezifische Ergänzung der Vite-Standard-Env-Typen um die beiden
// öffentlichen (VITE_-Prefix, im Client-Bundle sichtbaren) Supabase-Zugangsdaten.
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
