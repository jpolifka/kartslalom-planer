// delete-account — Account-Löschung auf Nutzer-Anfrage (DSGVO Art. 17)
// Löscht den auth.users-Eintrag via Admin-API; alle abhängigen Daten
// (profiles, tracks, track_versions) werden durch ON DELETE CASCADE entfernt.
// Vorher: Soft-Delete-Markierung und kurze Wartezeit können hier ergänzt werden.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // User aus JWT verifizieren
  const { data: { user }, error: authError } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: corsHeaders });
  }

  // Soft-Delete-Markierung setzen (für Audit-Trail, falls gewünscht)
  await admin.from("profiles").update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq("id", user.id);

  // Hard-Delete über Admin-API — cascadet alle abhängigen Daten
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error("deleteUser error", deleteError);
    // Soft-Delete rückgängig machen wenn Hard-Delete fehlschlug
    await admin.from("profiles").update({ is_deleted: false, deleted_at: null }).eq("id", user.id);
    return new Response(JSON.stringify({ error: "delete_failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ deleted: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
