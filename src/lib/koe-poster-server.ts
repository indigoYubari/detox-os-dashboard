// Server-side lesing av kø-postene (koe_poster, migrasjon 0011) for /koe.
// Brukerens egen session, RLS gjelder, service_role brukes aldri. Er tabellen
// ikke der ennå, sier svaret det — det er ikke det samme som at ingenting venter.

import { createSupabaseServerClient } from "./auth-server"
import { POST_COLUMNS, utgaattPerKoe, type KoePost } from "./koe-poster"

export type PosterFeil = {
  ok: false
  error: string
  /** `ikke_koblet_til` = tabellen finnes ikke (0011 ikke kjørt). `no_access` = grants/policyer mangler. */
  code: "ikke_koblet_til" | "no_access" | "other"
}

export type PosterResult =
  | {
      ok: true
      venter: KoePost[]
      avgjortIkkeUtfort: KoePost[]
      /** Avgjort og utført av huben, nyeste først — kvitteringene. */
      avgjortUtfort: KoePost[]
      /** Poster som ble satt til utgatt siste UTGAATT_DAGER, per kø. */
      utgaatt: Record<string, number>
    }
  | PosterFeil

/** Vinduet for «utgikk ubesvart». */
export const UTGAATT_DAGER = 7
/** Hvor mange kvitteringer siden viser. */
export const KVITTERING_ROWS = 20

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
export async function fetchPoster(naa: Date = new Date()): Promise<PosterResult> {
  const supabase = createSupabaseServerClient()
  const utgaattFra = new Date(naa.getTime() - UTGAATT_DAGER * 86_400_000).toISOString()
  const [v, a, u, g] = await Promise.all([
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
    supabase
      .from("koe_poster")
      .select(POST_COLUMNS)
      .in("status", ["ja", "nei", "gjort"])
      .not("utfort_at", "is", null)
      .order("utfort_at", { ascending: false })
      .limit(KVITTERING_ROWS),
    supabase
      .from("koe_poster")
      .select("koe_id, status, oppdatert")
      .eq("status", "utgatt")
      .gte("oppdatert", utgaattFra)
      .limit(500),
  ])
  if (v.error) return { ok: false, error: v.error.message, code: klassifiser(v.error.message) }
  if (a.error) return { ok: false, error: a.error.message, code: klassifiser(a.error.message) }
  if (u.error) return { ok: false, error: u.error.message, code: klassifiser(u.error.message) }
  if (g.error) return { ok: false, error: g.error.message, code: klassifiser(g.error.message) }
  return {
    ok: true,
    venter: (v.data ?? []) as KoePost[],
    avgjortIkkeUtfort: (a.data ?? []) as KoePost[],
    avgjortUtfort: (u.data ?? []) as KoePost[],
    utgaatt: utgaattPerKoe(
      (g.data ?? []) as Pick<KoePost, "koe_id" | "status" | "oppdatert">[],
      naa,
      UTGAATT_DAGER,
    ),
  }
}

export const POSTER_IKKE_KOBLET =
  "Postene er ikke koblet til ennå. Tallene finnes i køene, men tabellen for " +
  "postene (migrasjon 0011) er ikke kjørt, så det er ingenting å si ja eller nei til her."
