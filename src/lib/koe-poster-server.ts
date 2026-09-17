// Server-side lesing av kø-postene (koe_poster, migrasjon 0011) for /koe.
// Brukerens egen session, RLS gjelder, service_role brukes aldri. Er tabellen
// ikke der ennå, sier svaret det — det er ikke det samme som at ingenting venter.

import { createSupabaseServerClient } from "./auth-server"
import { POST_COLUMNS, type KoePost } from "./koe-poster"

export type PosterFeil = {
  ok: false
  error: string
  /** `ikke_koblet_til` = tabellen finnes ikke (0011 ikke kjørt). `no_access` = grants/policyer mangler. */
  code: "ikke_koblet_til" | "no_access" | "other"
}

export type PosterResult =
  | { ok: true; venter: KoePost[]; avgjortIkkeUtfort: KoePost[] }
  | PosterFeil

function klassifiser(melding: string): PosterFeil["code"] {
  if (/does not exist|42P01|could not find the table/i.test(melding)) {
    return "ikke_koblet_til"
  }
  if (/permission denied|42501/i.test(melding)) return "no_access"
  return "other"
}

/** Hvor mange ventende poster som leses. Køene skal være korte; er de ikke det, er det poenget. */
export const POSTER_ROWS = 200

/**
 * Ventende poster (haster først, eldst først), og poster som er avgjort men
 * ikke utført ennå — de siste er ærlighet: eieren har sagt ja, huben har ikke
 * gjort det ennå.
 */
export async function fetchPoster(): Promise<PosterResult> {
  const supabase = createSupabaseServerClient()
  const [v, a] = await Promise.all([
    supabase
      .from("koe_poster")
      .select(POST_COLUMNS)
      .eq("status", "venter")
      .order("prioritet", { ascending: true })
      .order("opprettet", { ascending: true })
      .limit(POSTER_ROWS),
    supabase
      .from("koe_poster")
      .select(POST_COLUMNS)
      .in("status", ["ja", "nei", "gjort"])
      .is("utfort_at", null)
      .order("avgjort_at", { ascending: false })
      .limit(50),
  ])
  if (v.error) return { ok: false, error: v.error.message, code: klassifiser(v.error.message) }
  if (a.error) return { ok: false, error: a.error.message, code: klassifiser(a.error.message) }
  return {
    ok: true,
    venter: (v.data ?? []) as KoePost[],
    avgjortIkkeUtfort: (a.data ?? []) as KoePost[],
  }
}

export const POSTER_IKKE_KOBLET =
  "Postene er ikke koblet til ennå. Tallene finnes i køene, men tabellen for " +
  "postene (migrasjon 0011) er ikke kjørt, så det er ingenting å si ja eller nei til her."
