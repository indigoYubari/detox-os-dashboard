"use server"
// Server Action for «Be Anakin lage utkast» fra et kort eller en idé. Skriver
// KUN en rad i `requests` (som /eiere gjør), med kroppen bygget her fra det
// serveren selv leser i basen — aldri fra klientens tekst. Idempotent: finnes
// en åpen bestilling med samme hode, returneres den.

import { revalidatePath } from "next/cache"

import { hasScope } from "@/lib/auth-policy"
import { createSupabaseServerClient, requireDetoxUser } from "@/lib/auth-server"
import { QUEUE_STATUSES } from "@/lib/eiere"
import {
  bestillingBody,
  bestillingHode,
  ideDeler,
  KORT_UUID_RE,
  NOTE_ID_RE,
  vinkelAv,
  type Bestilling,
} from "@/lib/kort"
import { fetchIdeEtt, fetchKortEtt } from "@/lib/kort-server"

export type BestillResult =
  | { ok: true; id: string; duplicate: boolean }
  | { ok: false; code: "unauthenticated" | "forbidden" | "invalid" | "not_found" | "db"; error: string }

export async function bestillInnholdAction(input: { slag: string; id: string }): Promise<BestillResult> {
  const user = await requireDetoxUser()
  if (!user) return { ok: false, code: "unauthenticated", error: "Ikke innlogget" }
  if (!hasScope(user.scopes, "work:write"))
    return { ok: false, code: "forbidden", error: "Mangler tilgang (work:write)" }

  let bestilling: Bestilling
  if (input.slag === "kort") {
    if (typeof input.id !== "string" || !KORT_UUID_RE.test(input.id))
      return { ok: false, code: "invalid", error: "Ugyldig kort-id" }
    const res = await fetchKortEtt(input.id)
    if (!res.ok) return { ok: false, code: "db", error: res.error }
    if (!res.rad) return { ok: false, code: "not_found", error: "Fant ikke kortet" }
    bestilling = { slag: "kort", id: res.rad.id, story: res.rad.story, title: res.rad.title, vinkel: vinkelAv(res.rad.body) }
  } else if (input.slag === "ide") {
    if (typeof input.id !== "string" || !NOTE_ID_RE.test(input.id))
      return { ok: false, code: "invalid", error: "Ugyldig idé-id" }
    const res = await fetchIdeEtt(input.id)
    if (!res.ok) return { ok: false, code: "db", error: res.error }
    if (!res.rad) return { ok: false, code: "not_found", error: "Fant ikke idéen" }
    const d = ideDeler(res.rad.excerpt)
    bestilling = { slag: "ide", id: res.rad.id, title: res.rad.title, notion: d.notion, setning: d.setning, claims: d.claims }
  } else {
    return { ok: false, code: "invalid", error: "Ukjent slag" }
  }

  const supabase = createSupabaseServerClient()
  const hode = bestillingHode(bestilling)
  const existing = await supabase
    .from("requests")
    .select("id")
    .in("status", [...QUEUE_STATUSES])
    .like("body", `${hode}%`)
    .limit(1)
  if (existing.error) return { ok: false, code: "db", error: existing.error.message }
  const dup = existing.data?.[0]
  if (dup) return { ok: true, id: dup.id as string, duplicate: true }

  const inserted = await supabase
    .from("requests")
    .insert({
      requester: user.actorLabel,
      kind: "content",
      body: bestillingBody(bestilling, user.actorLabel),
      status: "open",
    })
    .select("id")
    .single()
  if (inserted.error) return { ok: false, code: "db", error: inserted.error.message }

  for (const p of ["/", "/kort", "/ideer", "/eiere", `/kort/${bestilling.id}`]) revalidatePath(p)
  return { ok: true, id: inserted.data.id as string, duplicate: false }
}
