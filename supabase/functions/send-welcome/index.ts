// send-welcome — Willkommens-Mail nach erstem Login
// Idempotent: sendet nur wenn der Account weniger als 5 Minuten alt ist.
// Kein externer Import — nur fetch().

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY   = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL       = Deno.env.get("FROM_EMAIL") ?? "noreply@kart.cheezuscraizt.de";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const bearer = req.headers.get("authorization");
  if (!bearer) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: cors });

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { "apikey": SERVICE_ROLE_KEY, "Authorization": bearer },
  });
  if (!userRes.ok) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: cors });
  const user = await userRes.json();

  const ageMs = Date.now() - new Date(user.created_at).getTime();
  if (ageMs > 5 * 60 * 1000) {
    return new Response(JSON.stringify({ skipped: true, reason: "account_not_new" }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set, skipping welcome mail");
    return new Response(JSON.stringify({ skipped: true, reason: "no_resend_key" }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const emailRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [user.email],
      subject: "Willkommen beim Kartslalom Streckenplaner",
      html: `
        <p>Hallo,</p>
        <p>dein Account ist bereit. Du kannst jetzt Strecken erstellen und in der Cloud speichern.</p>
        <p>Im Free-Tarif kannst du bis zu 3 Strecken speichern. Für mehr Strecken und Satellitenbilder
           schreib einfach eine kurze Mail an <a href="mailto:jens@polifka.info">jens@polifka.info</a>.</p>
        <p>Viel Spaß beim Planen!</p>
        <p>Jens</p>
      `,
    }),
  });

  if (!emailRes.ok) {
    console.error("Resend error", emailRes.status, await emailRes.text());
    return new Response(JSON.stringify({ error: "mail_send_failed" }), { status: 500, headers: cors });
  }

  return new Response(JSON.stringify({ sent: true }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
