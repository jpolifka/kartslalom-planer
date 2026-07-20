// main — self-hosted Fat-Router-Dispatcher (docker/supabase/docker-compose.yml).
// Kong routet /functions/v1/* komplett hierher (siehe kong.yml,
// functions-v1-Route). main ist der einzige Prozess, der von Deno.serve()
// tatsächlich läuft; für bekannte Service-Namen wird der jeweilige Handler
// per statischem Import direkt aus der kanonischen Quelle aufgerufen — KEIN
// dupliziertes Logik-Handling mehr (siehe Red-Team-Review 2026-07-13 unten).
//
// Frühere Version hatte hier eine komplette, separat gepflegte Kopie jedes
// Handlers ("kein Modul-Import über Funktionsgrenzen hinweg"). Der
// eigentliche Grund dafür war NICHT, dass main.ts selbst keine anderen
// Module importieren könnte (ein normaler statischer Import im selben
// Deno-Prozess funktioniert problemlos), sondern dass der Fallback-Pfad
// unten (EdgeRuntime.userWorkers.create) kein Deno.serve() als Entrypoint
// unterstützt — jede standalone Function braucht dafür trotzdem ihr eigenes
// Deno.serve(handler) in index.ts. Die Lösung: jede Function ist in
// handler.ts (reine Logik, kein Deno.serve) + index.ts (dünner
// Deno.serve-Entrypoint für Cloud-Deployment/Worker-Fallback) aufgeteilt;
// main.ts importiert direkt aus handler.ts. Single Source of Truth, beide
// Deployment-Pfade funktionieren weiter.
//
// Die Duplikation hatte bereits real Schaden angerichtet: ein Fix für
// send-welcome (Idempotenz-Claim) landete nur in der standalone Datei, nicht
// hier — main.ts ist aber das, was Kong tatsächlich aufruft. Und
// handleDeleteAccount hatte hier einen abweichenden, unvollständigen
// Direkt-PATCH statt der delete_account_data()-RPC zu rufen — dadurch
// wurden persönliche Custom-Formationen bei Account-Löschung nicht wirklich
// gelöscht (nur ownerlos, siehe delete-account/handler.ts-Kommentar). Beide
// Bugs sind mit diesem Refactor behoben.
import * as jose from 'https://deno.land/x/jose@v4.14.4/index.ts'
import { handler as handleAccountExport } from '../account-export/handler.ts'
import { handler as handleDeleteAccount } from '../delete-account/handler.ts'
import { handler as handleSendWelcome } from '../send-welcome/handler.ts'
import { handler as handleUserLifecycle } from '../user-lifecycle/handler.ts'
import { handler as handleMapBackgroundImage } from '../map-background-image/handler.ts'

console.log('main function started')

const JWT_SECRET       = Deno.env.get('JWT_SECRET')
const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
// VERIFY_JWT ist ein GLOBALER Schalter für ALLE Functions hinter diesem
// Router (siehe docker/supabase/docker-compose.yml-Kommentar dazu). Er wird
// hier bewusst NICHT auf "true" gesetzt: user-lifecycle wird ohne User-JWT
// per Cron aufgerufen (CRON_SECRET/x-cron-secret, siehe user-lifecycle/
// handler.ts) und würde von einem globalen VERIFY_JWT=true fälschlich mit
// 401 abgewiesen, da es (noch) keine Pro-Function-Konfiguration gibt. Jede
// Function prüft ihre eigene Auth deshalb ohnehin selbst (account-export/
// delete-account/send-welcome/map-background-image per /auth/v1/user,
// user-lifecycle per CRON_SECRET) — dieser Schalter ist nur eine optionale
// zusätzliche Verteidigungsschicht VOR dem Dispatch.
const VERIFY_JWT       = Deno.env.get('VERIFY_JWT') === 'true'

// ── JWT-Verifikation ─────────────────────────────────────────────────────────
// Zwei unterstützte Signaturverfahren nebeneinander, für den Übergang
// zwischen älteren und neueren Supabase/GoTrue-Auslieferungen:
//   - HS256 (isValidLegacyJWT): symmetrisch, mit dem geteilten JWT_SECRET
//     signiert — das klassische Supabase-Verfahren.
//   - RS256/ES256 (isValidJWT): asymmetrisch, gegen den JWKS-Endpoint von
//     GoTrue geprüft (Schlüsselrotation möglich, kein geteiltes Secret nötig).
// Ein Token mit anderem/unbekanntem alg wird ohne weitere Prüfung abgelehnt.

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

// OPTIONS wird immer durchgelassen (sonst würde ein CORS-Preflight ohne
// Authorization-Header hier mit 401 statt mit einer Preflight-Antwort
// scheitern); ohne VERIFY_JWT=true ist diese Funktion komplett inaktiv und
// jede Function verlässt sich rein auf ihre eigene Auth-Prüfung.
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

function json(data: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  })
}

// ── Router ───────────────────────────────────────────────────────────────────
// Routing-Prinzip: Kong terminiert "/functions/v1/" per strip_path (siehe
// docker/supabase/volumes/api/kong.yml, Route functions-v1-all) und leitet
// alles dahinter unverändert an diesen einen main-Prozess weiter. Der erste
// Pfadsegment-Teil (z. B. "account-export" in "/account-export") entscheidet,
// welcher In-Process-Handler aufgerufen wird — kein zusätzlicher HTTP-Hop,
// kein separates Deno.serve() pro Function. Diese zentrale Datei existiert
// NICHT, weil main.ts selbst keine anderen Module importieren könnte
// (ein normaler statischer Import läuft im selben Deno-Prozess problemlos),
// sondern weil der Fallback-Pfad unten (EdgeRuntime.userWorkers.create) kein
// Deno.serve() als Entrypoint kennt — jede eigenständig deploybare Function
// braucht dafür weiterhin ihr eigenes index.ts. Diese Datei ist also der
// einzige Prozess, den Kong tatsächlich erreicht; separate Deployments pro
// Function würden entweder denselben Code duplizieren (siehe Red-Team-Review
// 2026-07-13 oben) oder bräuchten pro Function einen eigenen Kong-Route/
// Worker-Prozess, was hier bewusst vermieden wird.
const HANDLERS: Record<string, (req: Request) => Promise<Response>> = {
  'account-export':       handleAccountExport,
  'delete-account':       handleDeleteAccount,
  'send-welcome':         handleSendWelcome,
  'user-lifecycle':       handleUserLifecycle,
  'map-background-image': handleMapBackgroundImage,
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

  // Unbekannte Funktionen: User-Worker-Dispatch (Forward-Kompatibilität) —
  // erlaubt, zusätzliche, nicht in HANDLERS eingetragene Functions einfach
  // als eigenständiges Verzeichnis unter functions/ abzulegen, ohne main
  // anfassen zu müssen. Achtung: ALLE Prozess-Umgebungsvariablen (envVars)
  // werden an den Worker weitergereicht, nicht nur die für den jeweiligen
  // Service relevanten — ein unbekannter/neu hinzugefügter Service-Name
  // bekäme damit z. B. auch SUPABASE_SERVICE_ROLE_KEY oder RESEND_API_KEY
  // zu sehen, obwohl er sie nicht braucht.
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
