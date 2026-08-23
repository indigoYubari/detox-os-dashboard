// Synk: detox-vault content-workflow -> content_items i Dashboard-DB.
//
// Autentisering: skriptet logger inn som en ekte Supabase-bruker med anon-nokkel
// og password grant. Det betyr at RLS gjelder fullt ut — brukeren maa ha
// detox_role admin/founder/operator for at skrivingen skal ga gjennom (0007).
// service_role brukes IKKE, hverken her eller noe annet sted i denne flyten.
//
// Idempotent: upsert paa (source_repo, source_path), som er unik i 0007. Kjor
// den saa ofte du vil — samme vault gir samme rader.
//
// Bruk:
//   node scripts/sync-content-from-vault.mjs [--vault <sti>] [--dry-run]
//
// Credentials leses fra miljoet, ellers fra ~/.detox-os-login (0600):
//   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, EMAIL, PASSWORD

import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

import { collectContentItems } from "./lib/content-source.mjs"

const args = process.argv.slice(2)
const dryRun = args.includes("--dry-run")
const vaultArg = args.indexOf("--vault")
const VAULT_ROOT =
  vaultArg !== -1 && args[vaultArg + 1]
    ? args[vaultArg + 1]
    : (process.env.DETOX_VAULT_PATH ?? join(homedir(), "detox", "detox-vault"))

/** Leser KEY=value-fil uten aa eksponere verdier i logg eller argv. */
function readEnvFile(path) {
  try {
    const out = {}
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const m = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line.trim())
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "")
    }
    return out
  } catch {
    return {}
  }
}

const fileEnv = readEnvFile(join(homedir(), ".detox-os-login"))
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? fileEnv.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? fileEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
const email = process.env.DETOX_SYNC_EMAIL ?? fileEnv.EMAIL
const password = process.env.DETOX_SYNC_PASSWORD ?? fileEnv.PASSWORD

const items = collectContentItems(VAULT_ROOT)

console.log(`Vault: ${VAULT_ROOT}`)
console.log(`Fant ${items.length} innholdselement(er) i workflow-output:`)
for (const item of items) {
  console.log(`  [${item.stage}/${item.stage_status}] ${item.source_path}`)
}

if (items.length === 0) {
  console.log("Ingenting aa synke. Avslutter uten aa roere databasen.")
  process.exit(0)
}

if (dryRun) {
  console.log("\n--dry-run: ingen skriving utfort.")
  process.exit(0)
}

if (!url || !anonKey) {
  console.error("Mangler NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.")
  process.exit(1)
}
if (!email || !password) {
  console.error("Mangler EMAIL/PASSWORD (miljo eller ~/.detox-os-login).")
  process.exit(1)
}

const supabase = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data: session, error: authError } = await supabase.auth.signInWithPassword({
  email,
  password,
})
if (authError || !session?.user) {
  console.error(`Innlogging feilet: ${authError?.message ?? "ukjent feil"}`)
  process.exit(1)
}
const role = session.user.app_metadata?.detox_role ?? "(ingen)"
console.log(`\nInnlogget som ${session.user.email} (detox_role: ${role})`)

const now = new Date().toISOString()
const rows = items.map((item) => ({ ...item, updated_at: now, synced_at: now }))

const { data, error } = await supabase
  .from("content_items")
  .upsert(rows, { onConflict: "source_repo,source_path" })
  .select("id, stage, source_path")

if (error) {
  // RLS-avvisning ser ut som en vanlig feil her; rollen i linja over forklarer den.
  console.error(`Synk feilet: ${error.message}`)
  process.exit(1)
}

console.log(`Synket ${data?.length ?? 0} rad(er) til content_items.`)
await supabase.auth.signOut()
