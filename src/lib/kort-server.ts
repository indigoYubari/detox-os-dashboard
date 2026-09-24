// Server-side lesing for /kort, /kort/[id] og /ideer i den nye flaten.
// Brukerens egen session, RLS gjelder, service_role brukes aldri. Samme mønster
// som kunnskap-server.ts. Ingen mock: feil sies som feil.

import { createSupabaseServerClient } from "./auth-server"
import { classifyError, type ReadError } from "./eiere-server"
import { POST_COLUMNS, type KoePost } from "./koe-poster"
import { erIde, KIM_KORT_KOE, type IdeRad } from "./kort"
import type { KortRad } from "./kunnskap-server"

export type KortEttRad = KortRad & {
  source_repo: string | null
  source_path: string | null
}

export type KortEttResult = { ok: true; rad: KortEttRad | null } | ReadError

export async function fetchKortEtt(id: string): Promise<KortEttResult> {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from("v_kim_cards")
    .select("id, story, version, title, status, requires_review, updated_at, body, source_repo, source_path")
    .eq("id", id)
    .maybeSingle()
  if (error) return { ok: false, error: error.message, code: classifyError(error.message) }
  return { ok: true, rad: (data as KortEttRad | null) ?? null }
}

export type VentendeResult = { ok: true; post: KoePost | null } | ReadError

/** Posten i køen som venter på et ja for dette kortet — null når ingen venter. */
export async function fetchVentendePost(kortId: string): Promise<VentendeResult> {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from("koe_poster")
    .select(POST_COLUMNS)
    .eq("koe_id", KIM_KORT_KOE)
    .eq("ekstern_id", kortId)
    .eq("status", "venter")
    .order("opprettet", { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) {
    // Tabellen mangler (0011 ikke kjørt) er ikke en feil for kortsiden: da er det bare ingen post.
    if (/does not exist|42P01|could not find the table/i.test(error.message)) return { ok: true, post: null }
    return { ok: false, error: error.message, code: classifyError(error.message) }
  }
  return { ok: true, post: (data as KoePost | null) ?? null }
}

export type IdeerResult = { ok: true; rows: IdeRad[] } | ReadError

/** Hvor mange notater som leses før filtrering. Idékortene er få; seed-raden filtreres bort. */
export const IDE_ROWS = 60

export async function fetchIdeer(): Promise<IdeerResult> {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from("notes")
    .select("id, title, excerpt, type, tags, project, updated, pinned")
    .eq("type", "ide")
    .order("pinned", { ascending: false })
    .order("updated", { ascending: false })
    .limit(IDE_ROWS)
  if (error) return { ok: false, error: error.message, code: classifyError(error.message) }
  return { ok: true, rows: ((data ?? []) as IdeRad[]).filter(erIde) }
}

export async function fetchIdeEtt(id: string): Promise<{ ok: true; rad: IdeRad | null } | ReadError> {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from("notes")
    .select("id, title, excerpt, type, tags, project, updated, pinned")
    .eq("id", id)
    .maybeSingle()
  if (error) return { ok: false, error: error.message, code: classifyError(error.message) }
  const rad = (data as IdeRad | null) ?? null
  return { ok: true, rad: rad && erIde(rad) ? rad : null }
}
