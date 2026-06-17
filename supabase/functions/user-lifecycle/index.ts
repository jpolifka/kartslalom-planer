// user-lifecycle — Inaktivitäts-Reminders und Soft-Delete
// Wird als Cron-Job aufgerufen (z. B. täglich via pg_cron oder externem Scheduler).
// Stufen basieren auf last_active_at:
//   150 Tage → erste Erinnerungs-Mail
//   170 Tage → zweite Erinnerungs-Mail (letzte Warnung)
//   180 Tage → Soft-Delete (is_deleted = true)
//
// Aufruf: POST /functions/v1/user-lifecycle
// Header: Authorization: Bearer <SERVICE_ROLE_KEY>

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY   = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL       = Deno.env.get("FROM_EMAIL") ?? "noreply@kartslalom-planer.de";

const CRON_SECRET = Deno.env.get("CRON_SECRET");

async function sendMail(to: string, subject: string, html: string): Promise<boolean> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
  });
  if (!res.ok) console.error("Resend error", res.status, await res.text());
  return res.ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  // Cron-Secret prüfen — verhindert unautorisierte Aufrufe
  if (CRON_SECRET) {
    const secret = req.headers.get("x-cron-secret");
    if (secret !== CRON_SECRET) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const now = new Date();

  const stats = { reminder150: 0, reminder170: 0, softDeleted: 0, errors: 0 };

  // Erst Soft-Delete (180+ Tage) — nicht noch Mails senden für bereits zu löschende User
  const { data: toDelete } = await admin
    .from("profiles")
    .select("id, email")
    .eq("is_deleted", false)
    .lt("last_active_at", new Date(now.getTime() - 180 * 86400_000).toISOString());

  for (const p of toDelete ?? []) {
    const { error } = await admin.from("profiles").update({ is_deleted: true, deleted_at: now.toISOString() }).eq("id", p.id);
    if (error) { stats.errors++; continue; }
    stats.softDeleted++;
    await sendMail(
      p.email,
      "Dein Account wurde deaktiviert",
      `<p>Dein Account beim Kartslalom Streckenplaner war 180 Tage inaktiv und wurde deaktiviert.</p>
       <p>Falls du noch Zugriff möchtest, melde dich unter <a href="mailto:jens@polifka.info">jens@polifka.info</a>.</p>`
    );
  }

  // 170-Tage-Erinnerung (noch nicht gesendet)
  const { data: warn170 } = await admin
    .from("profiles")
    .select("id, email")
    .eq("is_deleted", false)
    .is("reminder_170_sent_at", null)
    .lt("last_active_at", new Date(now.getTime() - 170 * 86400_000).toISOString())
    .gt("last_active_at", new Date(now.getTime() - 180 * 86400_000).toISOString());

  for (const p of warn170 ?? []) {
    const sent = await sendMail(
      p.email,
      "Letzte Erinnerung: Dein Account wird bald deaktiviert",
      `<p>Dein Account ist seit 170 Tagen inaktiv. In 10 Tagen wird er automatisch deaktiviert.</p>
       <p>Melde dich an um ihn zu behalten: <a href="https://kartslalom-planer.de">kartslalom-planer.de</a></p>`
    );
    if (sent) {
      await admin.from("profiles").update({ reminder_170_sent_at: now.toISOString() }).eq("id", p.id);
      stats.reminder170++;
    } else {
      stats.errors++;
    }
  }

  // 150-Tage-Erinnerung (noch nicht gesendet)
  const { data: warn150 } = await admin
    .from("profiles")
    .select("id, email")
    .eq("is_deleted", false)
    .is("reminder_150_sent_at", null)
    .lt("last_active_at", new Date(now.getTime() - 150 * 86400_000).toISOString())
    .gt("last_active_at", new Date(now.getTime() - 170 * 86400_000).toISOString());

  for (const p of warn150 ?? []) {
    const sent = await sendMail(
      p.email,
      "Dein Account ist seit 150 Tagen inaktiv",
      `<p>Nur eine kurze Erinnerung: Dein Account beim Kartslalom Streckenplaner war zuletzt vor 150 Tagen aktiv.</p>
       <p>Nach 180 Tagen Inaktivität wird er automatisch deaktiviert. Melde dich einfach an um das zu verhindern.</p>
       <p><a href="https://kartslalom-planer.de">kartslalom-planer.de</a></p>`
    );
    if (sent) {
      await admin.from("profiles").update({ reminder_150_sent_at: now.toISOString() }).eq("id", p.id);
      stats.reminder150++;
    } else {
      stats.errors++;
    }
  }

  return new Response(JSON.stringify({ ok: true, stats }), {
    headers: { "Content-Type": "application/json" },
  });
});
