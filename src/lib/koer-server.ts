// Server-side lesing av eiernes faktiske køer (/ «Dagens» → «Venter på dere»).
//
// Samme mønster som eiere-server.ts og radar-server.ts: brukerens egen session
// via createSupabaseServerClient, RLS gjelder, service_role brukes aldri.
//
// Fram til 2026-09-17 leste forsiden `requests` her, som er agentenes arbeidskø.
// Denne filen leser `koer` (migrasjon 0009) i stedet — tabellen hub-jobben
// skriver til, med tall eid av stemme-laer og Raphaels kundeservice.
//
// Er migrasjonen ikke kjørt ennå, finnes ikke tabellen. Det er en helt vanlig
// tilstand her, ikke en feil: da sier seksjonen at køen ikke er koblet til ennå,
// i stedet for å late som den er tom.

import { createSupabaseServerClient } from "./auth-server"

export type Koe = {
  id: string
  navn: string
  antall: number
  eldste: string | null
  detalj: string | null
  kilde: string
  oppdatert: string
}

export type KoerFeil = {
  ok: false
  error: string
  /**
   * `ikke_koblet_til` = tabellen finnes ikke (0009 ikke kjørt) eller hub-jobben
   * har aldri skrevet. `no_access` = grants/policyer mangler. `other` = resten.
   */
  code: "ikke_koblet_til" | "no_access" | "other"
}

export type KoerResult = { ok: true; koer: Koe[] } | KoerFeil

function klassifiser(melding: string): KoerFeil["code"] {
  if (/does not exist|42P01|could not find the table/i.test(melding)) {
    return "ikke_koblet_til"
  }
  if (/permission denied|42501/i.test(melding)) return "no_access"
  return "other"
}

/**
 * Alle køene, største først. Tom liste er et gyldig svar (ingen venter).
 * Er tabellen borte, sier svaret det — det er ikke det samme som tom.
 */
export async function fetchKoer(): Promise<KoerResult> {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from("koer")
    .select("id, navn, antall, eldste, detalj, kilde, oppdatert")
    .order("antall", { ascending: false })

  if (error) {
    return { ok: false, error: error.message, code: klassifiser(error.message) }
  }
  return { ok: true, koer: (data ?? []) as Koe[] }
}

export const IKKE_KOBLET_TEKST =
  "Køen er ikke koblet til ennå. Tallene finnes — de ligger i stemme-løkka og " +
  "hos Raphael — men ingen jobb har skrevet dem til basen. Se migrasjon 0009."
