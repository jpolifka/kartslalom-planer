// send-welcome — Willkommens-Mail nach erstem Login
// Idempotent: Account muss unter 5 Minuten alt sein UND welcome_email_sent_at
// muss noch leer sein — Letzteres wird per atomarem PATCH (WHERE ... IS NULL)
// beansprucht, bevor gesendet wird. Verhindert wiederholte Aufrufe derselben
// Function (z. B. durch den Client oder einen Angreifer mit gültigem, noch
// frischem Bearer-Token) von mehrfachen Willkommens-Mails an dieselbe Adresse.
// Kein externer Import — nur fetch().
//
// Einzige Quelle der Wahrheit für diese Function: main/index.ts (self-hosted
// Fat-Router-Dispatcher, siehe dortiger Kommentar) importiert handler direkt
// von hier statt die Logik zu duplizieren. index.ts bleibt der dünne
// Deno.serve-Entrypoint für Supabase-Cloud-Deployment / EdgeRuntime-
// Worker-Fallback (unbekannte Service-Namen in main/index.ts).

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY   = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL       = Deno.env.get("FROM_EMAIL") ?? "noreply@cheezuscraizt.de";
const SITE_URL         = Deno.env.get("SITE_URL") ?? "https://kart.cheezuscraizt.de";

function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const isLocal = origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:");
  return {
    "Access-Control-Allow-Origin": isLocal ? origin : SITE_URL,
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Vary": "Origin",
  };
}

export async function handler(req: Request): Promise<Response> {
  const cors = corsHeaders(req);
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

  // Atomarer Claim: nur der Aufruf, der welcome_email_sent_at von NULL auf
  // now() setzt, darf senden. Bereits geclaimte/gesendete Accounts bekommen
  // eine leere Antwort (0 Zeilen) zurück.
  const claimedAt = new Date().toISOString();
  const claimRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&welcome_email_sent_at=is.null`,
    {
      method: "PATCH",
      headers: {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
      },
      body: JSON.stringify({ welcome_email_sent_at: claimedAt }),
    }
  );
  if (!claimRes.ok) {
    console.error("welcome_email_sent_at claim failed", claimRes.status, await claimRes.text());
    return new Response(JSON.stringify({ error: "claim_failed" }), { status: 500, headers: cors });
  }
  const claimed: unknown[] = await claimRes.json();
  if (claimed.length === 0) {
    return new Response(JSON.stringify({ skipped: true, reason: "already_sent" }), {
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
        <p>Im Free-Tarif kannst du bis zu 3 Strecken speichern. Für mehr Strecken und Luftbilder
           schreib einfach eine kurze Mail an <a href="mailto:jens@polifka.info">jens@polifka.info</a>.</p>
        <p>Viel Spaß beim Planen!</p>
        <p>Jens</p>
      `,
    }),
  });

  if (!emailRes.ok) {
    console.error("Resend error", emailRes.status, await emailRes.text());
    // Claim zurückrollen, damit ein transienter Resend-Fehler (429/500/...)
    // nicht dauerhaft "already_sent" vortäuscht und der Nutzer nie eine
    // Willkommens-Mail bekommt. Bedingt auf den eigenen claimedAt-Wert, damit
    // ein verzögerter Rollback keinen zwischenzeitlich neu gesetzten Claim
    // löscht (z. B. durch einen erfolgreichen Retry, der schon durchgelaufen ist).
    const rollbackRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&welcome_email_sent_at=eq.${encodeURIComponent(claimedAt)}`,
      {
        method: "PATCH",
        headers: {
          "apikey": SERVICE_ROLE_KEY,
          "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ welcome_email_sent_at: null }),
      }
    );
    if (!rollbackRes.ok) {
      console.error("welcome_email_sent_at rollback failed", rollbackRes.status, await rollbackRes.text());
    }
    return new Response(JSON.stringify({ error: "mail_send_failed" }), { status: 500, headers: cors });
  }

  return new Response(JSON.stringify({ sent: true }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
