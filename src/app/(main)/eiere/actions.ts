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
  awaitingAnakin,
  buildChatThreadBody,
  buildRequestBody,
  CHAT_THREAD_TYPE,
  DECISIONS,
  findDuplicateRequest,
  isDecision,
  isRefRequestType,
  isRefTable,
  isRequestType,
  QUEUE_STATUSES,
  refKey,
  REQUEST_TYPES,
  requestBodyHead,
  validMessage,
  type RefTable,
  type RequestRow,
} from "@/lib/eiere"
import { fetchThread, type ThreadRowsResult } from "@/lib/eiere-server"

export type ActionResult =
  | { ok: true; row: RequestRow; duplicate: boolean }
  | {
      ok: false
      code:
        | "unauthenticated"
        | "forbidden"
        | "invalid"
        | "not_found"
        | "not_in_queue"
        | "db"
      error: string
    }

const REQUEST_COLUMNS =
  "id, requester, kind, body, status, created_at, response, responded_at, thread_id, parent_id"
const UUID_RE = /^[0-9a-f-]{36}$/i

function validPeriod(v: unknown): string | null {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null
}

/** Kolonnen som baerer teksten eieren ser, per tabell en ref kan peke paa. */
const REF_TEXT_COLUMN: Record<RefTable, string> = {
  recommendations: "action",
  findings: "claim",
  content_items: "title",
}

/** Kolonner som gir Anakin kontekst i en samtale, utover teksten selv. */
const REF_CONTEXT_COLUMNS: Record<RefTable, string[]> = {
  recommendations: ["kind", "status"],
  findings: ["evidence", "source_url"],
  content_items: ["topic", "stage"],
}

type SupabaseClient = ReturnType<typeof createSupabaseServerClient>

/**
 * Leser teksten (og eventuelt kontekst) for raden en ref peker paa — med
 * brukerens session, aldri fra klienten. null = finnes ikke / tom.
 */
async function readRefText(
  supabase: SupabaseClient,
  table: RefTable,
  id: string,
  withContext: boolean,
): Promise<{ text: string } | { error: string } | null> {
  const column = REF_TEXT_COLUMN[table]
  const extra = withContext ? REF_CONTEXT_COLUMNS[table] : []
  const found = await supabase
    .from(table)
    .select(["id", column, ...extra].join(", "))
    .eq("id", id)
    .maybeSingle()
  if (found.error) return { error: found.error.message }
  const row = found.data as Record<string, unknown> | null
  const text = row?.[column]
  if (typeof text !== "string" || text.trim() === "") return null
  const parts = [text]
  for (const c of extra) {
    const v = row?.[c]
    if (typeof v === "string" && v.trim() !== "") parts.push(`${c}: ${v}`)
  }
  return { text: parts.join(" · ") }
}

/**
 * "Be Anakin gjøre dette" / "Forklar dette funnet" / "Lag utkast til dette" —
 * en forespoersel som peker paa én rad. Klienten sender bare id; teksten leses
 * fra basen med brukerens egen session (RLS), aldri fra klienten. Idempotent
 * per (type, radar-periode, ref).
 */
export async function createRefRequestAction(input: {
  type: string
  refId: string
  period: string | null
}): Promise<ActionResult> {
  const user = await requireDetoxUser()
  if (!user)
    return { ok: false, code: "unauthenticated", error: "Ikke innlogget" }
  if (!hasScope(user.scopes, "work:write"))
    return {
      ok: false,
      code: "forbidden",
      error: "Mangler tilgang (work:write)",
    }
  if (!isRefRequestType(input.type))
    return { ok: false, code: "invalid", error: "Ukjent forespørselstype" }
  if (typeof input.refId !== "string" || !UUID_RE.test(input.refId))
    return { ok: false, code: "invalid", error: "Ugyldig id" }
  const period = validPeriod(input.period)
  const table: RefTable = REQUEST_TYPES[input.type].ref

  const supabase = createSupabaseServerClient()
  const found = await readRefText(supabase, table, input.refId, false)
  if (found && "error" in found)
    return { ok: false, code: "db", error: found.error }
  if (!found)
    return {
      ok: false,
      code: "not_found",
      error: "Fant ikke raden det pekes på",
    }
  const text = found.text

  const key = refKey(table, input.refId)
  const head = requestBodyHead(input.type, period, key)
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
    key,
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
        ref: { key, text },
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
  if (!user)
    return { ok: false, code: "unauthenticated", error: "Ikke innlogget" }
  if (!hasScope(user.scopes, "work:write"))
    return {
      ok: false,
      code: "forbidden",
      error: "Mangler tilgang (work:write)",
    }
  if (!isRequestType(input.type) || isRefRequestType(input.type))
    return { ok: false, code: "invalid", error: "Ukjent forespørselstype" }
  const period = validPeriod(input.period)

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

/**
 * «Snakk om dette» — Vei A. Legger en [chat_thread]-rad i requests med
 * konteksten (teksten fra basen) og agent-anakinbot i kroppen, saa
 * webhook-triggeren vekker Anakin foer eieren har aapnet Telegram. Klienten
 * aapner deretter t.me-lenken selv — ingen payload, /start svarer ikke.
 *
 * Idempotent: finnes en aapen/paagaaende samtale om samme element, returneres
 * den (duplicate=true) — ett klikk, én rad, én agent-kjoering. En samtale kan
 * ogsaa fortsette en eksisterende traad (thread/parent), da uten ref.
 * responded_at sendes aldri — basen eier det.
 */
export async function startChatThreadAction(input: {
  ref: { table: string; id: string } | null
  period: string | null
  continues: { threadId: string; parentId: string } | null
  /** Eierens tekst fra kompositoren (kun sammen med continues). Da svarer
   *  Anakin i response paa raden, og eieren leser det i dashbordet. */
  message?: string | null
}): Promise<ActionResult> {
  const user = await requireDetoxUser()
  if (!user)
    return { ok: false, code: "unauthenticated", error: "Ikke innlogget" }
  if (!hasScope(user.scopes, "work:write"))
    return {
      ok: false,
      code: "forbidden",
      error: "Mangler tilgang (work:write)",
    }
  const period = validPeriod(input.period)
  if (!input.ref && !input.continues)
    return { ok: false, code: "invalid", error: "Samtalen mangler emne" }
  if (
    input.ref &&
    (!isRefTable(input.ref.table) || !UUID_RE.test(input.ref.id))
  )
    return { ok: false, code: "invalid", error: "Ugyldig referanse" }
  if (
    input.continues &&
    (!UUID_RE.test(input.continues.threadId) ||
      !UUID_RE.test(input.continues.parentId))
  )
    return { ok: false, code: "invalid", error: "Ugyldig tråd" }
  const message =
    input.message == null || input.message === ""
      ? null
      : validMessage(input.message)
  if (input.message != null && input.message !== "" && !message)
    return {
      ok: false,
      code: "invalid",
      error: "Meldingen er tom eller for lang",
    }
  if (message && !input.continues)
    return { ok: false, code: "invalid", error: "En melding hører til en tråd" }

  const supabase = createSupabaseServerClient()
  let ref: { key: string; text: string } | undefined
  if (input.ref) {
    const table = input.ref.table as RefTable
    const found = await readRefText(supabase, table, input.ref.id, true)
    if (found && "error" in found)
      return { ok: false, code: "db", error: found.error }
    if (!found)
      return {
        ok: false,
        code: "not_found",
        error: "Fant ikke raden det pekes på",
      }
    ref = { key: refKey(table, input.ref.id), text: found.text }
  }

  // Idempotens per element: én aapen samtale om samme ref. En fortsettelse av
  // en traad er alltid ny (den peker paa forrige melding).
  if (ref) {
    const head = requestBodyHead(CHAT_THREAD_TYPE, period, ref.key)
    const existing = await supabase
      .from("requests")
      .select(REQUEST_COLUMNS)
      .in("status", [...QUEUE_STATUSES])
      .like("body", `${head}%`)
    if (existing.error)
      return { ok: false, code: "db", error: existing.error.message }
    const dup = findDuplicateRequest(
      (existing.data ?? []) as RequestRow[],
      CHAT_THREAD_TYPE,
      period,
      ref.key,
    )
    if (dup) return { ok: true, row: dup, duplicate: true }
  }
  // Idempotens per traad: venter alt en rad i traaden paa Anakin (open/
  // in_progress uten svar), lages ingen ny — én rad, én agent-kjoering.
  // Knappen i vinduet er stengt i samme tilstand; dette er serverens sperre.
  if (input.continues) {
    const thread = await fetchThread(input.continues.threadId)
    if (!thread.ok) return { ok: false, code: "db", error: thread.error }
    const waiting = awaitingAnakin(thread.rows)
    if (waiting) return { ok: true, row: waiting, duplicate: true }
  }

  const inserted = await supabase
    .from("requests")
    .insert({
      requester: user.actorLabel,
      kind: REQUEST_TYPES[CHAT_THREAD_TYPE].kind,
      body: buildChatThreadBody({
        period,
        requestedBy: user.actorLabel,
        ref,
        continues: input.continues ?? undefined,
        message: message ?? undefined,
      }),
      status: "open",
      ...(input.continues
        ? {
            thread_id: input.continues.threadId,
            parent_id: input.continues.parentId,
          }
        : {}),
    })
    .select(REQUEST_COLUMNS)
    .single()
  if (inserted.error)
    return { ok: false, code: "db", error: inserted.error.message }

  revalidatePath("/eiere")
  return { ok: true, row: inserted.data as RequestRow, duplicate: false }
}

/** Godkjenn / avvis / marker lest / lukk tråd — kun status-kolonnen i requests. */
export async function decideRequestAction(input: {
  id: string
  decision: string
}): Promise<ActionResult> {
  const user = await requireDetoxUser()
  if (!user)
    return { ok: false, code: "unauthenticated", error: "Ikke innlogget" }
  if (!isDecision(input.decision))
    return { ok: false, code: "invalid", error: "Ukjent beslutning" }
  const def = DECISIONS[input.decision]
  if (!hasScope(user.scopes, def.scope))
    return {
      ok: false,
      code: "forbidden",
      error: `Mangler tilgang (${def.scope})`,
    }
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
  if (updated.error)
    return { ok: false, code: "db", error: updated.error.message }
  if (!updated.data)
    return {
      ok: false,
      code: "not_in_queue",
      error: "Forespoerselen er allerede avgjort eller finnes ikke",
    }

  revalidatePath("/eiere")
  return { ok: true, row: updated.data as RequestRow, duplicate: false }
}

export type ThreadReadResult =
  | { ok: true; rows: RequestRow[] }
  | { ok: false; code: "unauthenticated" | "invalid" | "db"; error: string }

/**
 * Chat-vinduets polling: les én traad paa nytt med eierens session. Ren
 * lesing — ingen skriving, ingen revalidate. Kalles hvert THREAD_POLL_MS
 * mens vinduet er aapent og traaden lever.
 */
export async function readThreadAction(input: {
  threadKey: string
}): Promise<ThreadReadResult> {
  const user = await requireDetoxUser()
  if (!user)
    return { ok: false, code: "unauthenticated", error: "Ikke innlogget" }
  if (typeof input.threadKey !== "string" || !UUID_RE.test(input.threadKey))
    return { ok: false, code: "invalid", error: "Ugyldig tråd" }
  const r: ThreadRowsResult = await fetchThread(input.threadKey)
  if (!r.ok) return { ok: false, code: "db", error: r.error }
  return { ok: true, rows: r.rows }
}
