/**
 * register-gcp.mjs — engangsregistrering av Cloud-prosjektet mot Merchant Center.
 *
 * DETTE ER DET ENESTE SKRIVENDE KALLET I HELE AUDIT-DATALAGET.
 *
 * Det er bevisst unntatt read-only-vakten i klienter/merchant.py, og ligger
 * derfor i et eget skript som et menneske kjører manuelt én gang — ikke i
 * jobbene, ikke i noen cron, ikke i noen timer.
 *
 * Krav fra Google:
 *   - Den som kaller MÅ ha ADMIN i Merchant Center. Service-kontoen har det
 *     ikke, og skal ikke ha det. Eneste Admin er b2b@detox.no.
 *   - `developerEmail` må være en vanlig Google-konto, ikke service-kontoen.
 *   - Ett Cloud-prosjekt kan bare registreres mot én Merchant Center-konto.
 *
 * Mønsteret (lokal callback på port 3999) er hentet fra scripts/google-oauth.mjs.
 *
 * VERSJON: v1. v1beta ble stengt 28.02.2026 og svarer ikke lenger.
 * `developerRegistration` ligger i accounts-sub-API-et, som er v1 (verifisert mot
 * Googles referanse 26.09.2026).
 *
 * ADVARSEL — ENDEPUNKTET ER IKKE PRØVD: stien er bygget fra dokumentasjonen, ikke
 * bekreftet mot et ekte svar. Skriptet printer derfor nøyaktig hva det vil sende
 * og krever at du skriver JA før noe går ut. Svarer Google 404, er stien feil —
 * ikke gjett, sjekk dokumentasjonen.
 *
 * Bruk (fra workers/audit):
 *   node skript/register-gcp.mjs
 *
 * Logg inn med b2b@detox.no når nettleseren åpner seg.
 */
import { createServer } from "http"
import { readFileSync } from "fs"
import { createInterface } from "readline"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))

// Merchant Center-kontoen (spesifikasjonen §2.3).
const KONTO = process.env.MERCHANT_ACCOUNT_ID ?? "5365874444"
const DEVELOPER_EMAIL = process.env.MERCHANT_DEVELOPER_EMAIL ?? "b2b@detox.no"

// v1beta ble stengt 28.02.2026. accounts-sub-API-et er v1.
const API_VERSJON = "v1"
const ENDEPUNKT =
  `https://merchantapi.googleapis.com/accounts/${API_VERSJON}` +
  `/accounts/${KONTO}/developerRegistration:registerGcp`

const REDIRECT_URI = "http://localhost:3999/callback"
const SCOPES = ["https://www.googleapis.com/auth/content"].join(" ")

// Nøkler: miljøet først, ellers repoets .env.local (samme som google-oauth.mjs).
let CLIENT_ID = process.env.GOOGLE_CLIENT_ID
let CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
if (!CLIENT_ID || !CLIENT_SECRET) {
  try {
    const env = readFileSync(join(__dirname, "../../../.env.local"), "utf-8")
    for (const line of env.split("\n")) {
      if (line.startsWith("GOOGLE_CLIENT_ID=")) CLIENT_ID = line.split("=")[1].trim()
      if (line.startsWith("GOOGLE_CLIENT_SECRET=")) CLIENT_SECRET = line.split("=")[1].trim()
    }
  } catch {
    // Håndteres under.
  }
}
if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET mangler. Sett dem i miljøet, " +
      "eller legg dem i .env.local i repo-roten.",
  )
  process.exit(1)
}

/** Spør i terminalen. Returnerer det brukeren skrev. */
function spor(sporsmal) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((res) => rl.question(sporsmal, (svar) => { rl.close(); res(svar) }))
}

/** Bytt authorization code for et tilgangstoken. */
async function hentToken(code) {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  })
  const t = await r.json()
  if (!t.access_token) {
    // Tokenet skal aldri printes. Bare feltnavnene i svaret.
    throw new Error(
      `Token-bytte feilet. Google svarte med feltene: ${Object.keys(t).join(", ")}`,
    )
  }
  return t.access_token
}

/** Det skrivende kallet. Skjer bare etter et eksplisitt JA. */
async function registrer(token) {
  const kropp = { developerEmail: DEVELOPER_EMAIL }

  console.log("\n─────────────────────────────────────────────────")
  console.log("Dette er et SKRIVENDE kall. Ingenting er sendt ennå.")
  console.log("  metode:  POST")
  console.log(`  url:     ${ENDEPUNKT}`)
  console.log(`  kropp:   ${JSON.stringify(kropp)}`)
  console.log(`  konto:   ${KONTO}`)
  console.log("─────────────────────────────────────────────────")
  const svar = await spor("Skriv JA for å sende, hva som helst annet for å avbryte: ")
  if (svar.trim() !== "JA") {
    console.log("Avbrutt. Ingenting er sendt.")
    return 1
  }

  const r = await fetch(ENDEPUNKT, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(kropp),
  })
  const tekst = await r.text()
  console.log(`\nHTTP ${r.status}`)
  console.log(tekst.slice(0, 1500))

  if (r.status === 200) {
    console.log("\nRegistrert. Dette skal ikke kjøres igjen.")
    console.log("Før det inn i endringsloggen (audit_change_log): dato, hva, hvem.")
    return 0
  }
  if (r.status === 404) {
    console.log(
      "\n404 betyr at stien eller API-versjonen er feil — ikke at kontoen mangler.\n" +
        "Sjekk gjeldende dokumentasjon for accounts.developerRegistration.registerGcp,\n" +
        "rett ENDEPUNKT i dette skriptet, og kjør på nytt. Ikke gjett.",
    )
  }
  if (r.status === 403) {
    console.log(
      "\n403: kontoen du logget inn med har sannsynligvis ikke ADMIN i Merchant Center.\n" +
        "Eneste Admin er b2b@detox.no. Service-kontoen kan ikke gjøre dette kallet.",
    )
  }
  return 1
}

const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth" +
  `?client_id=${encodeURIComponent(CLIENT_ID)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  "&response_type=code" +
  `&scope=${encodeURIComponent(SCOPES)}` +
  "&access_type=offline&prompt=consent"

console.log(`\nÅpner nettleseren — logg inn med ${DEVELOPER_EMAIL} (må ha ADMIN).\n`)
const { exec } = await import("child_process")
exec(`open "${authUrl}"`)

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost:3999")
  if (url.pathname !== "/callback") return
  const code = url.searchParams.get("code")
  if (!code) {
    res.end("<h2>Ingen code i callback. Se terminalen.</h2>")
    console.error("Callback uten code. Avbrutt.")
    server.close()
    process.exitCode = 1
    return
  }
  res.end("<h2>Innlogget. Gå tilbake til terminalen — den venter på et JA.</h2>")
  server.close()
  try {
    const token = await hentToken(code)
    process.exitCode = await registrer(token)
  } catch (e) {
    console.error(`Feil: ${e.message}`)
    process.exitCode = 1
  }
})

server.listen(3999, () => console.log("Venter på callback på port 3999..."))
