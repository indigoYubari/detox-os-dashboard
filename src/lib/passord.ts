// Rene hjelpere for «Glemt passord»-flyten. Ingen Next/Supabase-importer, slik
// at både sidene, callback-ruten og testene kan bruke dem.
//
// Flyten (PKCE, som er standard i @supabase/ssr):
//   /glemt-passord  -> resetPasswordForEmail(redirectTo = /auth/callback?next=/oppdater-passord)
//   e-postlenken    -> /auth/callback?code=…  (veksler koden inn i en sesjon-cookie)
//   /oppdater-passord (krever sesjon, som alle andre sider) -> updateUser({ password })
// Lenken må åpnes i samme nettleser som ba om den: kodeverifikatoren ligger i
// en cookie der.

export const PASSORD_MIN_LENGDE = 8

export const STANDARD_NESTE = "/oppdater-passord"

export function tilbakestillingsAdresse(origin: string): string {
  return `${origin}/auth/callback?next=${encodeURIComponent(STANDARD_NESTE)}`
}

// Bare interne stier. «//evil.no» og «/\evil.no» tolkes av nettlesere som en
// annen vert, så de avvises (åpen omdirigering).
export function trygtNeste(neste: string | null | undefined): string {
  if (!neste || !neste.startsWith("/")) return STANDARD_NESTE
  if (neste.startsWith("//") || neste.startsWith("/\\")) return STANDARD_NESTE
  return neste
}

export function validerNyttPassord(passord: string, bekreft: string): string | null {
  if (passord.length < PASSORD_MIN_LENGDE) {
    return `Passordet må ha minst ${PASSORD_MIN_LENGDE} tegn.`
  }
  if (passord !== bekreft) return "Passordene stemmer ikke overens."
  return null
}

// Feilkoden callback-ruten sender tilbake til /glemt-passord.
export const LENKE_FEIL = "lenke"

export function lenkeFeilmelding(feil: string | null): string | null {
  if (feil !== LENKE_FEIL) return null
  return "Lenken er utløpt, allerede brukt eller åpnet i en annen nettleser. Be om en ny lenke under."
}
