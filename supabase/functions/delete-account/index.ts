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

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { "apikey": SERVICE_ROLE_KEY, "Authorization": bearer },
  });
  if (!userRes.ok) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: cors });
  const user = await userRes.json();
  const uid: string = user.id;

  // Soft-Delete-Markierung (Audit-Trail)
  await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${uid}`, {
    method: "PATCH",
    headers: { "apikey": SERVICE_ROLE_KEY, "Authorization": `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ is_deleted: true, deleted_at: new Date().toISOString() }),
  });

  // Nicht-Library-Formationen löschen bevor der Account verschwindet.
  // Library-Formationen bekommen owner_id=null via ON DELETE SET NULL — Attribution "[gelöschter Nutzer]".
  await fetch(`${SUPABASE_URL}/rest/v1/custom_formations?owner_id=eq.${uid}&is_library=eq.false`, {
    method: "DELETE",
    headers: { "apikey": SERVICE_ROLE_KEY, "Authorization": `Bearer ${SERVICE_ROLE_KEY}`, "Prefer": "return=minimal" },
  });

  // Hard-Delete via Admin-API — ON DELETE CASCADE entfernt alle Daten, ON DELETE SET NULL für Library-Formationen
  const deleteRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${uid}`, {
    method: "DELETE",
    headers: { "apikey": SERVICE_ROLE_KEY, "Authorization": `Bearer ${SERVICE_ROLE_KEY}` },
  });

  if (!deleteRes.ok) {
    console.error("deleteUser error", deleteRes.status, await deleteRes.text());
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
