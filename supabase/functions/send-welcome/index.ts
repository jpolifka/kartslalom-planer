// send-welcome — Willkommens-Mail nach erstem Login
// Wird aus AuthCallbackPage nach exchangeCodeForSession() aufgerufen.
// Idempotent: Supabase-Auth liefert created_at; wir senden nur wenn
// der Account weniger als 5 Minuten alt ist.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY   = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL       = Deno.env.get("FROM_EMAIL") ?? "noreply@kartslalom-planer.de";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // User aus JWT auslesen
  const { data: { user }, error } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (error || !user) {
    return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: corsHeaders });
  }

  // Nur senden wenn Account < 5 Minuten alt (frischer Signup)
  const createdAt = new Date(user.created_at).getTime();
  const ageMs = Date.now() - createdAt;
  if (ageMs > 5 * 60 * 1000) {
    return new Response(JSON.stringify({ skipped: true, reason: "account_not_new" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const emailRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
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
    const body = await emailRes.text();
    console.error("Resend error", emailRes.status, body);
    return new Response(JSON.stringify({ error: "mail_send_failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ sent: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
