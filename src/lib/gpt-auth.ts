// Maskin-autentisering for Custom GPT-klienter (Kim GPT, senere Anniken GPT).
//
// Bakgrunn (se detox-os-architecture: docs/iam.md, docs/security.md T20):
// Kim og Anniken deler én ChatGPT-konto. ChatGPT-innloggingen kan derfor ALDRI
// brukes som bevis på hvilket menneske som skrev en melding. Vi skiller i
// stedet på GPT-KLIENT: hver GPT får sin egen opake credential som mapper til
// en egen maskinidentitet.
//
// Hvorfor en ekte Supabase-bruker på innsiden, og ikke bare en header-sjekk:
// `activity_events` har RLS `insert with check (actor_id = auth.uid())`. En
// prinsipal uten Supabase-sesjon har ingen `auth.uid()`, og audit-skrivingen
// ville feilet stille. Alternativet - service_role for audit-innsettingen -
// er forbudt (mandatet) og ville brutt append-only-garantien. Den opake
// credentialen veksles derfor server-side inn i en ekte, lavprivilegert
// Supabase-sesjon for `gpt-kim@detox.no` (app_metadata.detox_role = "service").
//
// Resultatet: eksisterende IAM, RLS og audit gjenbrukes uendret.
//
// Credentialen finnes KUN som sha256-hash i env. Klarteksten lever i
// GPT-konfigurasjonen og i Adrians passordmanager - aldri i repo, logg,
// Markdown eller session report.

import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { createHash, timingSafeEqual } from "node:crypto"

import {
  GPT_CREDENTIAL_HEADER,
  scopesForRole,
  type DetoxScope,
} from "./auth-policy"

// Re-eksporteres for kallere som allerede importerer fra denne modulen.
export { GPT_CREDENTIAL_HEADER }

export type GptPrincipal = {
  /** Maskinidentiteten, f.eks. "kim-gpt". ALDRI et menneskenavn. */
  principal: string
  /**
   * Hvilket menneske GPT-en er KONFIGURERT for. Dette er kontekst, ikke
   * identitet: det betyr aldri at personen selv utførte handlingen.
   */
  configuredFor: string
  /** Supabase-brukeren maskinidentiteten logger inn som. */
  email: string
}

type GptClientConfig = GptPrincipal & {
  /** sha256-hex av den opake credentialen. */
  credentialSha256: string
  password: string
}

/**
 * Klientregisteret. Å legge til Anniken GPT senere er én oppføring her pluss
 * to env-variabler - ingen ny backend-kode (mandatets §18).
 */
function gptClients(): GptClientConfig[] {
  const clients: GptClientConfig[] = []

  const kimHash = process.env.KIM_GPT_CREDENTIAL_SHA256
  const kimPassword = process.env.KIM_GPT_SUPABASE_PASSWORD
  if (kimHash && kimPassword) {
    clients.push({
      principal: "kim-gpt",
      configuredFor: "kim",
      email: process.env.KIM_GPT_SUPABASE_EMAIL ?? "gpt-kim@detox.no",
      credentialSha256: kimHash.trim().toLowerCase(),
      password: kimPassword,
    })
  }

  const annikenHash = process.env.ANNIKEN_GPT_CREDENTIAL_SHA256
  const annikenPassword = process.env.ANNIKEN_GPT_SUPABASE_PASSWORD
  if (annikenHash && annikenPassword) {
    clients.push({
      principal: "anniken-gpt",
      configuredFor: "anniken",
      email: process.env.ANNIKEN_GPT_SUPABASE_EMAIL ?? "gpt-anniken@detox.no",
      credentialSha256: annikenHash.trim().toLowerCase(),
      password: annikenPassword,
    })
  }

  return clients
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex")
}

/** Timingsikker sammenligning av to hex-strenger av lik lengde. */
function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8")
  const bufB = Buffer.from(b, "utf8")
  // timingSafeEqual kaster på ulik lengde. Lengden på en sha256-hex er ikke
  // hemmelig, så det er trygt å avvise den forskjellen tidlig.
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

/**
 * Slår opp GPT-klienten en credential tilhører.
 *
 * Header-TILSTEDEVÆRELSE er aldri autentisering. Kun en credential som
 * hasher til en registrert verdi gir en prinsipal.
 */
export function resolveGptClient(
  rawCredential: string | null,
): GptClientConfig | null {
  if (!rawCredential) return null
  const credential = rawCredential.trim()
  // Avvis åpenbart for korte verdier før vi bruker tid på hashing.
  if (credential.length < 32) return null

  const hash = sha256Hex(credential)
  for (const client of gptClients()) {
    if (constantTimeEquals(hash, client.credentialSha256)) return client
  }
  return null
}

export type GptSession = GptPrincipal & {
  userId: string
  role: string
  scopes: DetoxScope[]
  accessToken: string
}

type CachedSession = { session: GptSession; expiresAtMs: number }

// Sesjonene caches per prinsipal slik at vi ikke gjør en full innlogging på
// hver request. Bevisst enkel: en Map i modulscope, ingen ekstern store.
const sessionCache = new Map<string, CachedSession>()

/** Nullstiller sesjonscachen. Kun for tester. */
export function __clearGptSessionCache(): void {
  sessionCache.clear()
}

/**
 * Veksler en verifisert GPT-klient inn i en ekte Supabase-sesjon for
 * maskinbrukeren. Rollen leses fra `app_metadata.detox_role` - nøyaktig samme
 * kilde som for mennesker - slik at scope-håndhevelsen er identisk.
 */
async function signInAsMachine(
  client: GptClientConfig,
): Promise<GptSession | null> {
  const cached = sessionCache.get(client.principal)
  if (cached && cached.expiresAtMs > Date.now()) return cached.session

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const { data, error } = await supabase.auth.signInWithPassword({
    email: client.email,
    password: client.password,
  })

  if (error || !data.session || !data.user) {
    // Aldri logg credential eller passord - kun at innloggingen feilet.
    console.error(
      JSON.stringify({
        msg: "gpt_machine_signin_failed",
        principal: client.principal,
        error: error?.message ?? "no_session",
      }),
    )
    return null
  }

  const role = (data.user.app_metadata as Record<string, unknown> | null)
    ?.detox_role
  const session: GptSession = {
    principal: client.principal,
    configuredFor: client.configuredFor,
    email: client.email,
    userId: data.user.id,
    role: typeof role === "string" ? role : "none",
    scopes: scopesForRole(role),
    accessToken: data.session.access_token,
  }

  // Fornyes ett minutt før utløp, slik at en request aldri rekker å bruke en
  // token som utløper underveis.
  const expiresInMs = (data.session.expires_in ?? 3600) * 1000
  sessionCache.set(client.principal, {
    session,
    expiresAtMs: Date.now() + Math.max(expiresInMs - 60_000, 0),
  })

  return session
}

/**
 * Autentiserer en request som GPT-maskinidentitet.
 * Returnerer null hvis headeren mangler ELLER credentialen er ugyldig -
 * kallende kode skiller ikke på de to, og svarer 401 i begge tilfeller.
 */
export async function authenticateGptRequest(
  headers: Headers,
): Promise<GptSession | null> {
  const client = resolveGptClient(headers.get(GPT_CREDENTIAL_HEADER))
  if (!client) return null
  return signInAsMachine(client)
}

/** Supabase-klient bundet til maskinidentitetens JWT. RLS gjelder som normalt. */
export function createMachineSupabaseClient(
  accessToken: string,
): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    },
  )
}
