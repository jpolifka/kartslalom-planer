// delete-account — Account-Löschung auf Nutzer-Anfrage (DSGVO Art. 17)
// Kein externer Import — nur fetch() gegen Supabase REST/Auth API.

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

export async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: cors });

  const bearer = req.headers.get("authorization");
  if (!bearer) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: cors });

  // 1. User-Token validieren → uid ermitteln
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { "apikey": SERVICE_ROLE_KEY, "Authorization": bearer },
  });
  if (!userRes.ok) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: cors });
  const user = await userRes.json();
  const uid: string = user.id;

  // 2. Atomische DB-Bereinigung via SECURITY DEFINER RPC:
  //    - Soft-Delete des Profils (Audit-Trail)
  //    - Löschen aller nicht-Library-Formationen
  //    Wird mit dem User-Bearer aufgerufen, damit auth.uid() im RPC korrekt gesetzt ist.
  //    Library-Formationen erhalten owner_id=null später über ON DELETE SET NULL.
  const cleanupRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/delete_account_data`, {
    method: "POST",
    headers: {
      "apikey": SERVICE_ROLE_KEY,
      "Authorization": bearer,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  if (!cleanupRes.ok) {
    console.error("delete_account_data error", cleanupRes.status, await cleanupRes.text());
    return new Response(JSON.stringify({ error: "cleanup_failed" }), { status: 500, headers: cors });
  }

  // 3. Hard-Delete via Admin-API — ON DELETE SET NULL für Library-Formationen
  //    (ON DELETE CASCADE entfernt formation_shares, tracks-Referenzen bleiben als Snapshot)
  const deleteRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${uid}`, {
    method: "DELETE",
    headers: { "apikey": SERVICE_ROLE_KEY, "Authorization": `Bearer ${SERVICE_ROLE_KEY}` },
  });

  if (!deleteRes.ok) {
    console.error("deleteUser error", deleteRes.status, await deleteRes.text());
    // Soft-Delete rückgängig machen. Hinweis: gelöschte Formationen können nicht
    // wiederhergestellt werden — dies ist eine explizit akzeptierte Einschränkung.
    await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${uid}`, {
      method: "PATCH",
      headers: { "apikey": SERVICE_ROLE_KEY, "Authorization": `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ is_deleted: false, deleted_at: null }),
    });
    return new Response(JSON.stringify({ error: "delete_failed" }), { status: 500, headers: cors });
  }

  return new Response(JSON.stringify({ deleted: true }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(handler);
