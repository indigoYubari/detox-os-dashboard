#!/usr/bin/env node
// Engangsjobb: hent et Gmail refresh-token via OAuth2 loopback-flyt.
//
// Forutsetninger (gjøres i Google Cloud Console, se SETUP nederst):
//   1. Aktiver Gmail API.
//   2. Lag OAuth-klient av typen "Desktop app".
//   3. Legg client_id og client_secret i .env.local som
//      GOOGLE_CLIENT_ID og GOOGLE_CLIENT_SECRET.
//
// Kjør:  node scripts/google-oauth.mjs
// Scriptet åpner nettleseren, du logger inn med as.shikoba@gmail.com og
// godkjenner. Refresh-token skrives ut i terminalen - lim det inn i .env.local
// som GOOGLE_REFRESH_TOKEN.

import http from "node:http"
import { readFileSync } from "node:fs"
import { exec } from "node:child_process"

const PORT = 53682
const REDIRECT_URI = `http://localhost:${PORT}/callback`
const SCOPE = "https://www.googleapis.com/auth/gmail.readonly"

// Les client_id/secret fra env eller .env.local (enkel parser, kun for dette).
function fromEnvFile(key) {
  if (process.env[key]) return process.env[key]
  try {
    const text = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    const m = text.match(new RegExp(`^${key}=(.*)$`, "m"))
    return m ? m[1].trim().replace(/^["']|["']$/g, "") : undefined
  } catch {
    return undefined
  }
}

const CLIENT_ID = fromEnvFile("GOOGLE_CLIENT_ID")
const CLIENT_SECRET = fromEnvFile("GOOGLE_CLIENT_SECRET")

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    "Mangler GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET i .env.local.\n" +
      "Sett dem opp i Google Cloud Console (Desktop app), legg dem i .env.local, kjør igjen.",
  )
  process.exit(1)
}

const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
  }).toString()

async function exchangeCode(code) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  })
  if (!res.ok) {
    throw new Error(`Token-bytte feilet ${res.status}: ${await res.text()}`)
  }
  return res.json()
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  if (url.pathname !== "/callback") {
    res.writeHead(404).end()
    return
  }
  const code = url.searchParams.get("code")
  const err = url.searchParams.get("error")
  if (err || !code) {
    res.writeHead(400).end(`OAuth-feil: ${err ?? "mangler code"}`)
    server.close()
    process.exit(1)
  }
  try {
    const tokens = await exchangeCode(code)
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(
      "<h2>Ferdig. Lukk dette vinduet og gaa tilbake til terminalen.</h2>",
    )
    console.log("\n=== KOPIER DENNE LINJEN INN I .env.local ===\n")
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`)
    console.log("\n============================================\n")
    if (!tokens.refresh_token) {
      console.log(
        "Fikk ikke refresh_token. Gaa til https://myaccount.google.com/permissions,\n" +
          "fjern tilgangen for appen, og kjor scriptet paa nytt.",
      )
    }
  } catch (e) {
    console.error(e)
  } finally {
    server.close()
    process.exit(0)
  }
})

server.listen(PORT, () => {
  console.log(`Lytter paa ${REDIRECT_URI}`)
  console.log("Aapner nettleser for innlogging...\n")
  console.log("Hvis den ikke aapner, lim inn denne URL-en manuelt:\n")
  console.log(authUrl + "\n")
  exec(`open "${authUrl}"`)
})
