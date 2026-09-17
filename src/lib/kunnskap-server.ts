// Server-side lesing av Indigos kort (migrasjon 0010, view v_kim_cards) for
// forsiden. Brukerens egen session, RLS gjelder: et menneske ser baade aktive
// kort og utkast — det er maskinprinsipalen (GPT-ene) som bare ser aktive.
// Kortene skrives av scripts/sync-kim-cards.py fra mindmatter-icm.

import { createSupabaseServerClient } from "./auth-server"
import { classifyError, type ReadError } from "./eiere-server"

/** Hvor mange kort som leses. Én rad per story og versjon; eldre versjoner er superseded. */
export const KORT_ROWS = 40

export type KortRad = {
  id: string
  story: string
  version: string
  title: string
  status: string
  requires_review: boolean
  updated_at: string
  /** Seksjonene i kortet som JSON (betydning_for_detox, kan_si, aldri_si, …). */
  body: unknown
}

export type KortResult = { ok: true; rows: KortRad[] } | ReadError

export async function fetchKort(limit: number = KORT_ROWS): Promise<KortResult> {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from("v_kim_cards")
    .select("id, story, version, title, status, requires_review, updated_at, body")
    .order("updated_at", { ascending: false })
    .limit(limit)
  if (error) {
    return { ok: false, error: error.message, code: classifyError(error.message) }
  }
  return { ok: true, rows: (data ?? []) as KortRad[] }
}
