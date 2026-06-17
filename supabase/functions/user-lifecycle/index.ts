// user-lifecycle — Inaktivitäts-Reminders und Soft-Delete
// Cron-Job: täglich aufrufen. Stufen: 150 / 170 / 180 Tage Inaktivität.
// Kein externer Import — nur fetch().

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY   = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL       = Deno.env.get("FROM_EMAIL") ?? "noreply@kartslalom-planer.de";
const CRON_SECRET      = Deno.env.get("CRON_SECRET") ?? "";

const svc = { "apikey": SERVICE_ROLE_KEY, "Authorization": `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json" };

async function sendMail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
  });
  if (!res.ok) console.error("Resend error", res.status, await res.text());
  return res.ok;
}

async function patchProfile(uid: string, patch: Record<string, unknown>) {
  await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${uid}`, {
    method: "PATCH", headers: svc, body: JSON.stringify(patch),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null);

  if (CRON_SECRET && req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  const now = new Date();
  const stats = { reminder150: 0, reminder170: 0, softDeleted: 0, errors: 0 };

  function daysAgo(days: number) {
    return new Date(now.getTime() - days * 86400_000).toISOString();
  }

  // 180+ Tage → Soft-Delete
  const del = await (await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?is_deleted=eq.false&last_active_at=lt.${daysAgo(180)}&select=id,email`,
    { headers: svc },
  )).json() as { id: string; email: string }[];

  for (const p of del ?? []) {
    await patchProfile(p.id, { is_deleted: true, deleted_at: now.toISOString() });
    stats.softDeleted++;
    await sendMail(p.email, "Dein Account wurde deaktiviert",
      `<p>Dein Account war 180 Tage inaktiv und wurde deaktiviert. Bei Fragen: <a href="mailto:jens@polifka.info">jens@polifka.info</a></p>`);
  }

  // 170–180 Tage → zweite Warnung
  const warn170 = await (await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?is_deleted=eq.false&reminder_170_sent_at=is.null&last_active_at=lt.${daysAgo(170)}&last_active_at=gt.${daysAgo(180)}&select=id,email`,
    { headers: svc },
  )).json() as { id: string; email: string }[];

  for (const p of warn170 ?? []) {
    const sent = await sendMail(p.email, "Letzte Erinnerung: Account wird bald deaktiviert",
      `<p>Dein Account ist 170 Tage inaktiv. In 10 Tagen wird er deaktiviert. <a href="https://kartslalom-planer.de">Jetzt anmelden</a></p>`);
    if (sent) { await patchProfile(p.id, { reminder_170_sent_at: now.toISOString() }); stats.reminder170++; }
    else stats.errors++;
  }

  // 150–170 Tage → erste Erinnerung
  const warn150 = await (await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?is_deleted=eq.false&reminder_150_sent_at=is.null&last_active_at=lt.${daysAgo(150)}&last_active_at=gt.${daysAgo(170)}&select=id,email`,
    { headers: svc },
  )).json() as { id: string; email: string }[];

  for (const p of warn150 ?? []) {
    const sent = await sendMail(p.email, "Dein Account ist seit 150 Tagen inaktiv",
      `<p>Melde dich an um deinen Account zu behalten: <a href="https://kartslalom-planer.de">kartslalom-planer.de</a></p>`);
    if (sent) { await patchProfile(p.id, { reminder_150_sent_at: now.toISOString() }); stats.reminder150++; }
    else stats.errors++;
  }

  return new Response(JSON.stringify({ ok: true, stats }), {
    headers: { "Content-Type": "application/json" },
  });
});
