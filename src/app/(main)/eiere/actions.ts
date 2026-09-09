"use server"

// Server Actions for /eiere. Eneste skriveflate i eier-oversikten, og den
// skriver KUN til `requests` (insert + status-update). Aldri reports, findings,
// recommendations, content_items eller activity_events. Ingen publisering.
//
// Identitet og scope kommer fra sesjonen (requireDetoxUser), aldri fra
// klienten. Klientens input valideres mot de faste tabellene i lib/eiere.ts.

import { revalidatePath } from "next/cache"

import { hasScope } from "@/lib/auth-policy"
import { createSupabaseServerClient, requireDetoxUser } from "@/lib/auth-server"
import {
  buildRequestBody,
  DECISIONS,
  findDuplicateRequest,
  isDecision,
  isRequestType,
  QUEUE_STATUSES,
  REQUEST_TYPES,
  requestBodyHead,
  type RequestRow,
} from "@/lib/eiere"

export type ActionResult =
  | { ok: true; row: RequestRow; duplicate: boolean }
  | {
      ok: false
      code: "unauthenticated" | "forbidden" | "invalid" | "not_in_queue" | "db"
      error: string
    }

const REQUEST_COLUMNS = "id, requester, kind, body, status, created_at"

/**
 * "Be Anakin: …" — legger en forespoersel i koeen. Idempotent per (type,
 * radar-periode): finnes en aapen/paagaaende rad med samme hode, returneres den
 * med duplicate=true i stedet for at det lages en ny.
 */
export async function createRequestAction(input: {
  type: string
  period: string | null
}): Promise<ActionResult> {
  const user = await requireDetoxUser()
  if (!user) return { ok: false, code: "unauthenticated", error: "Ikke innlogget" }
  if (!hasScope(user.scopes, "work:write"))
    return { ok: false, code: "forbidden", error: "Mangler tilgang (work:write)" }
  if (!isRequestType(input.type))
    return { ok: false, code: "invalid", error: "Ukjent forespoerselstype" }
  const period =
    typeof input.period === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.period)
      ? input.period
      : null

  const supabase = createSupabaseServerClient()
  const head = requestBodyHead(input.type, period)

  const existing = await supabase
    .from("requests")
    .select(REQUEST_COLUMNS)
    .in("status", [...QUEUE_STATUSES])
    .like("body", `${head}%`)
  if (existing.error)
    return { ok: false, code: "db", error: existing.error.message }
  const dup = findDuplicateRequest(
    (existing.data ?? []) as RequestRow[],
    input.type,
    period,
  )
  if (dup) return { ok: true, row: dup, duplicate: true }

  const inserted = await supabase
    .from("requests")
    .insert({
      requester: user.actorLabel,
      kind: REQUEST_TYPES[input.type].kind,
      body: buildRequestBody({
        type: input.type,
        period,
        requestedBy: user.actorLabel,
      }),
      status: "open",
    })
    .select(REQUEST_COLUMNS)
    .single()
  if (inserted.error)
    return { ok: false, code: "db", error: inserted.error.message }

  revalidatePath("/eiere")
  return { ok: true, row: inserted.data as RequestRow, duplicate: false }
}

/** Godkjenn / avvis / marker lest — kun status-kolonnen i requests. */
export async function decideRequestAction(input: {
  id: string
  decision: string
}): Promise<ActionResult> {
  const user = await requireDetoxUser()
  if (!user) return { ok: false, code: "unauthenticated", error: "Ikke innlogget" }
  if (!isDecision(input.decision))
    return { ok: false, code: "invalid", error: "Ukjent beslutning" }
  const def = DECISIONS[input.decision]
  if (!hasScope(user.scopes, def.scope))
    return { ok: false, code: "forbidden", error: `Mangler tilgang (${def.scope})` }
  if (typeof input.id !== "string" || !/^[0-9a-f-]{36}$/i.test(input.id))
    return { ok: false, code: "invalid", error: "Ugyldig id" }

  const supabase = createSupabaseServerClient()
  const updated = await supabase
    .from("requests")
    .update({ status: def.status })
    .eq("id", input.id)
    .in("status", [...QUEUE_STATUSES])
    .select(REQUEST_COLUMNS)
    .maybeSingle()
  if (updated.error) return { ok: false, code: "db", error: updated.error.message }
  if (!updated.data)
    return {
      ok: false,
      code: "not_in_queue",
      error: "Forespoerselen er allerede avgjort eller finnes ikke",
    }

  revalidatePath("/eiere")
  return { ok: true, row: updated.data as RequestRow, duplicate: false }
}
