"use server"
// Server Action for /koe. Eneste skriveflate i den nye flaten, og den skriver
// KUN status, avgjort_av, avgjort_at og oppdatert i koe_poster. Aldri
// fagtabellene: hub-jobbene utfører avgjørelsen og kvitterer i utfort_*.
//
// Identitet kommer fra sesjonen (requireDetoxUser), aldri fra klienten. En
// maskinprinsipal har ikke action:approve, og RLS-policyen i 0011 stopper den
// uansett. Ingen agent godkjenner sitt eget forslag.

import { revalidatePath } from "next/cache"

import { hasScope } from "@/lib/auth-policy"
import { createSupabaseServerClient, requireDetoxUser } from "@/lib/auth-server"
import {
  erBeslutning,
  gyldigBeslutning,
  POST_COLUMNS,
  UUID_RE,
  type Handling,
  type KoePost,
} from "@/lib/koe-poster"

export type AvgjorResult =
  | { ok: true; post: KoePost }
  | {
      ok: false
      code: "unauthenticated" | "forbidden" | "invalid" | "db" | "not_waiting"
      error: string
    }

export async function avgjorPostAction(input: {
  id: string
  beslutning: string
}): Promise<AvgjorResult> {
  const user = await requireDetoxUser()
  if (!user)
    return { ok: false, code: "unauthenticated", error: "Ikke innlogget" }
  if (!hasScope(user.scopes, "action:approve"))
    return { ok: false, code: "forbidden", error: "Mangler tilgang (action:approve)" }
  if (typeof input.id !== "string" || !UUID_RE.test(input.id))
    return { ok: false, code: "invalid", error: "Ugyldig id" }
  if (!erBeslutning(input.beslutning))
    return { ok: false, code: "invalid", error: "Ukjent beslutning" }

  const supabase = createSupabaseServerClient()
  const naavaerende = await supabase
    .from("koe_poster")
    .select("id, handling, status")
    .eq("id", input.id)
    .maybeSingle()
  if (naavaerende.error)
    return { ok: false, code: "db", error: naavaerende.error.message }
  if (!naavaerende.data || naavaerende.data.status !== "venter")
    return {
      ok: false,
      code: "not_waiting",
      error: "Posten er allerede avgjort eller finnes ikke",
    }
  if (!gyldigBeslutning(naavaerende.data.handling as Handling, input.beslutning))
    return { ok: false, code: "invalid", error: "Beslutningen passer ikke posten" }

  const naa = new Date().toISOString()
  const updated = await supabase
    .from("koe_poster")
    .update({
      status: input.beslutning,
      avgjort_av: user.actorLabel,
      avgjort_at: naa,
      oppdatert: naa,
    })
    .eq("id", input.id)
    .eq("status", "venter") // dobbelt-sjekk mot kappløp
    .select(POST_COLUMNS)
    .maybeSingle()
  if (updated.error) return { ok: false, code: "db", error: updated.error.message }
  if (!updated.data)
    return {
      ok: false,
      code: "not_waiting",
      error: "Posten ble avgjort av noen andre i mellomtiden",
    }

  revalidatePath("/koe")
  revalidatePath("/")
  return { ok: true, post: updated.data as KoePost }
}
