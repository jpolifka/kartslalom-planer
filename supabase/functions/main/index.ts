// Lokaler Dispatcher für Docker-Dev-Setup (docker/supabase/docker-compose.yml).
// Supabase Cloud: jede Funktion einzeln deployen (supabase functions deploy <name>).
import * as jose from 'https://deno.land/x/jose@v4.14.4/index.ts'

console.log('main function started')

const JWT_SECRET       = Deno.env.get('JWT_SECRET')
const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY   = Deno.env.get('RESEND_API_KEY') ?? ''
const FROM_EMAIL       = Deno.env.get('FROM_EMAIL') ?? 'noreply@kart.cheezuscraizt.de'
const CRON_SECRET      = Deno.env.get('CRON_SECRET') ?? ''
const VERIFY_JWT       = Deno.env.get('VERIFY_JWT') === 'true'

// ── JWT-Verifikation ─────────────────────────────────────────────────────────

let SUPABASE_JWT_KEYS: ReturnType<typeof jose.createRemoteJWKSet> | null = null
if (SUPABASE_URL) {
  try {
    SUPABASE_JWT_KEYS = jose.createRemoteJWKSet(
      new URL('/auth/v1/.well-known/jwks.json', SUPABASE_URL)
    )
  } catch (e) {
    console.error('Failed to fetch JWKS:', e)
  }
}

function getAuthToken(req: Request): string {
  const h = req.headers.get('authorization')
  if (!h) throw new Error('Missing authorization header')
  const [bearer, token] = h.split(' ')
  if (bearer !== 'Bearer') throw new Error("Auth header is not 'Bearer {token}'")
  return token
}

async function isValidLegacyJWT(jwt: string): Promise<boolean> {
  if (!JWT_SECRET) return false
  try {
    await jose.jwtVerify(jwt, new TextEncoder().encode(JWT_SECRET))
    return true
  } catch { return false }
}

async function isValidJWT(jwt: string): Promise<boolean> {
  if (!SUPABASE_JWT_KEYS) return false
  try {
    await jose.jwtVerify(jwt, SUPABASE_JWT_KEYS)
    return true
  } catch { return false }
}

async function verifyRequest(req: Request): Promise<Response | null> {
  if (req.method === 'OPTIONS' || !VERIFY_JWT) return null
  try {
    const token = getAuthToken(req)
    const { alg } = jose.decodeProtectedHeader(token)
    const valid = alg === 'HS256' ? await isValidLegacyJWT(token)
      : (alg === 'ES256' || alg === 'RS256') ? await isValidJWT(token)
      : false
    if (!valid) return json({ msg: 'Invalid JWT' }, 401)
  } catch (e) {
    return json({ msg: String(e) }, 401)
  }
  return null
}

// ── Hilfsfunktionen ──────────────────────────────────────────────────────────

function json(data: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  })
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

function svcHeaders() {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  }
}

async function getUser(bearer: string): Promise<{ id: string; email: string; created_at: string } | null> {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: bearer },
  })
  return r.ok ? r.json() : null
}

async function sendMail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) return false
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
  })
  if (!r.ok) console.error('Resend error', r.status, await r.text())
  return r.ok
}

// ── Handler ──────────────────────────────────────────────────────────────────

async function handleAccountExport(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  const bearer = req.headers.get('authorization')
  if (!bearer) return json({ error: 'Unauthorized' }, 401)
  const user = await getUser(bearer)
  if (!user) return json({ error: 'Invalid token' }, 401)
  const uid = user.id

  const [profileRes, tracksRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${uid}&select=id,email,tier,created_at,last_active_at`, { headers: svcHeaders() }),
    fetch(`${SUPABASE_URL}/rest/v1/tracks?owner_id=eq.${uid}&select=id,name,description,state_json,area_sel_json,manual_width,manual_length,map_satellite,map_opacity,created_at,updated_at&order=created_at`, { headers: svcHeaders() }),
  ])
  const profiles = await profileRes.json()
  const tracks = await tracksRes.json()

  const trackIds: string[] = Array.isArray(tracks) ? tracks.map((t: { id: string }) => t.id) : []
  let versions: unknown[] = []
  if (trackIds.length > 0) {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/track_versions?track_id=in.(${trackIds.join(',')})&select=track_id,version_number,state_json,area_sel_json,created_at&order=created_at`,
      { headers: svcHeaders() },
    )
    versions = await r.json()
  }

  const date = new Date().toISOString().slice(0, 10)
  return new Response(JSON.stringify({ exported_at: new Date().toISOString(), profile: profiles[0] ?? null, tracks: tracks ?? [], track_versions: versions }, null, 2), {
    headers: { ...cors, 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="kartslalom-export-${date}.json"` },
  })
}

async function handleDeleteAccount(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const bearer = req.headers.get('authorization')
  if (!bearer) return json({ error: 'Unauthorized' }, 401)
  const user = await getUser(bearer)
  if (!user) return json({ error: 'Invalid token' }, 401)
  const uid = user.id

  await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${uid}`, {
    method: 'PATCH', headers: svcHeaders(),
    body: JSON.stringify({ is_deleted: true, deleted_at: new Date().toISOString() }),
  })
  const del = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${uid}`, {
    method: 'DELETE', headers: svcHeaders(),
  })
  if (!del.ok) {
    console.error('deleteUser error', del.status, await del.text())
    await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${uid}`, {
      method: 'PATCH', headers: svcHeaders(),
      body: JSON.stringify({ is_deleted: false, deleted_at: null }),
    })
    return json({ error: 'delete_failed' }, 500)
  }
  return json({ deleted: true })
}

async function handleSendWelcome(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  const bearer = req.headers.get('authorization')
  if (!bearer) return json({ error: 'Unauthorized' }, 401)
  const user = await getUser(bearer)
  if (!user) return json({ error: 'Invalid token' }, 401)

  const ageMs = Date.now() - new Date(user.created_at).getTime()
  if (ageMs > 5 * 60 * 1000) return json({ skipped: true, reason: 'account_not_new' })

  const sent = await sendMail(user.email, 'Willkommen beim Kartslalom Streckenplaner', `
    <p>Hallo,</p>
    <p>dein Account ist bereit. Du kannst jetzt Strecken erstellen und in der Cloud speichern.</p>
    <p>Im Free-Tarif kannst du bis zu 3 Strecken speichern. Für mehr Strecken und Satellitenbilder
       schreib einfach eine kurze Mail an <a href="mailto:jens@polifka.info">jens@polifka.info</a>.</p>
    <p>Viel Spaß beim Planen!</p><p>Jens</p>
  `)
  return sent ? json({ sent: true }) : json({ error: 'mail_send_failed' }, 500)
}

async function handleUserLifecycle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null)
  if (CRON_SECRET && req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return json({ error: 'Forbidden' }, 403)
  }
  const now = new Date()
  const stats = { reminder150: 0, reminder170: 0, softDeleted: 0, errors: 0 }
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86400_000).toISOString()
  const patch = (uid: string, p: Record<string, unknown>) =>
    fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${uid}`, {
      method: 'PATCH', headers: svcHeaders(), body: JSON.stringify(p),
    })

  const del: { id: string; email: string }[] = await (await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?is_deleted=eq.false&last_active_at=lt.${daysAgo(180)}&select=id,email`,
    { headers: svcHeaders() },
  )).json()
  for (const p of del ?? []) {
    await patch(p.id, { is_deleted: true, deleted_at: now.toISOString() })
    stats.softDeleted++
    await sendMail(p.email, 'Dein Account wurde deaktiviert',
      '<p>Dein Account war 180 Tage inaktiv und wurde deaktiviert. Bei Fragen: <a href="mailto:jens@polifka.info">jens@polifka.info</a></p>')
  }

  const warn170: { id: string; email: string }[] = await (await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?is_deleted=eq.false&reminder_170_sent_at=is.null&last_active_at=lt.${daysAgo(170)}&last_active_at=gt.${daysAgo(180)}&select=id,email`,
    { headers: svcHeaders() },
  )).json()
  for (const p of warn170 ?? []) {
    const ok = await sendMail(p.email, 'Letzte Erinnerung: Account wird bald deaktiviert',
      '<p>Dein Account ist 170 Tage inaktiv. In 10 Tagen wird er deaktiviert. <a href="https://kart.cheezuscraizt.de">Jetzt anmelden</a></p>')
    if (ok) { await patch(p.id, { reminder_170_sent_at: now.toISOString() }); stats.reminder170++ }
    else stats.errors++
  }

  const warn150: { id: string; email: string }[] = await (await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?is_deleted=eq.false&reminder_150_sent_at=is.null&last_active_at=lt.${daysAgo(150)}&last_active_at=gt.${daysAgo(170)}&select=id,email`,
    { headers: svcHeaders() },
  )).json()
  for (const p of warn150 ?? []) {
    const ok = await sendMail(p.email, 'Dein Account ist seit 150 Tagen inaktiv',
      '<p>Melde dich an um deinen Account zu behalten: <a href="https://kart.cheezuscraizt.de">kart.cheezuscraizt.de</a></p>')
    if (ok) { await patch(p.id, { reminder_150_sent_at: now.toISOString() }); stats.reminder150++ }
    else stats.errors++
  }

  return json({ ok: true, stats })
}

// ── Router ───────────────────────────────────────────────────────────────────

const HANDLERS: Record<string, (req: Request) => Promise<Response>> = {
  'account-export':  handleAccountExport,
  'delete-account':  handleDeleteAccount,
  'send-welcome':    handleSendWelcome,
  'user-lifecycle':  handleUserLifecycle,
}

Deno.serve(async (req: Request) => {
  const denied = await verifyRequest(req)
  if (denied) return denied

  const path_parts = new URL(req.url).pathname.split('/')
  const service_name = path_parts[1]

  if (!service_name) return json({ msg: 'missing function name' }, 400)

  // Bekannte Handler direkt aufrufen
  const handler = HANDLERS[service_name]
  if (handler) return handler(req)

  // Unbekannte Funktionen: User-Worker-Dispatch (Forward-Kompatibilität)
  const servicePath = `/home/deno/functions/${service_name}`
  console.error(`serving via worker: ${servicePath}`)
  const envVars = Object.entries(Deno.env.toObject())
  try {
    const worker = await EdgeRuntime.userWorkers.create({
      servicePath, memoryLimitMb: 150, workerTimeoutMs: 60_000,
      noModuleCache: false, importMapPath: null, envVars,
    })
    return await worker.fetch(req)
  } catch (e) {
    return json({ msg: String(e) }, 500)
  }
})
