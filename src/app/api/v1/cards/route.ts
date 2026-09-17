import { NextResponse } from "next/server"

import {
  authorize,
  createSupabaseServerClient,
  requireDetoxPrincipal,
} from "@/lib/auth-server"
import { createMachineSupabaseClient } from "@/lib/gpt-auth"

// GET /api/v1/cards - Indigos Kim-kort (én skjerm per research-story).
//
// DATAKILDE: `v_kim_cards` (migrasjon 0010), fylt av scripts/sync-kim-cards.py
// fra mindmatter-icm. Kortet er den menneskelesbare syntesen; findings er
// forskningsfunnene. QA-status (draft/active) eies av topics/README.md i ICM.
//
// Hvem ser hva: RLS-policyen i 0010 gjør at en maskinprinsipal (GPT, detox_role
// = service) bare får status = 'active'. Mennesker ser også draft. Ruten
// filtrerer ikke selv - den ber med kallerens egen JWT, så et draft kan ikke
// lekke til GPT-en via en feil her.
//
// Ingen mock-fallback: er migrasjonen ikke kjørt, sier vi det (503), vi later
// ikke som listen er tom.
export const dynamic = "force-dynamic"

type Card = {
  story: string
  version: string
  title: string
  anchors: unknown
  body: unknown
  status: "draft" | "active" | "superseded"
  requires_review: boolean
  source_path: string
  updated_at: string
}

const STORY_RE = /^[a-z0-9-]{1,64}$/

export async function GET(request: Request) {
  const principal = await requireDetoxPrincipal()
  const denied = authorize(principal, "detox:read")
  if (denied) return denied

  const url = new URL(request.url)
  const story = url.searchParams.get("story")
  if (story && !STORY_RE.test(story)) {
    return NextResponse.json(
      { error: "Ugyldig story", code: "validation_error" },
      { status: 400 },
    )
  }

  const supabase =
    principal!.actorType === "service" && principal!.accessToken
      ? createMachineSupabaseClient(principal!.accessToken)
      : createSupabaseServerClient()

  let query = supabase
    .from("v_kim_cards")
    .select(
      "story, version, title, anchors, body, status, requires_review, source_path, updated_at",
    )
    .neq("status", "superseded")
    .order("story", { ascending: true })
    .order("version", { ascending: false })
  if (story) query = query.eq("story", story)

  const { data, error } = await query
  if (error) {
    const ikkeKoblet = /does not exist|42P01|could not find the table/i.test(
      error.message,
    )
    return NextResponse.json(
      {
        error: ikkeKoblet
          ? "Kim-kortene er ikke koblet til ennå (migrasjon 0010 ikke kjørt)."
          : "Kunne ikke hente Kim-kort",
        code: ikkeKoblet ? "ikke_koblet_til" : "backend_error",
      },
      { status: 503 },
    )
  }

  const cards = (data ?? []) as Card[]
  const byStory: Record<string, number> = {}
  let updatedLatest: string | null = null
  for (const c of cards) {
    byStory[c.story] = (byStory[c.story] ?? 0) + 1
    if (!updatedLatest || c.updated_at > updatedLatest) updatedLatest = c.updated_at
  }

  return NextResponse.json({
    data_source: "live",
    source: "kim_cards",
    // For en maskinprinsipal er draft-kort filtrert bort av RLS, ikke av oss.
    visibility: principal!.actorType === "service" ? "active_only" : "all",
    updated_latest: updatedLatest,
    counts: { total: cards.length, by_story: byStory },
    cards: cards.map((c) => ({
      story: c.story,
      version: c.version,
      title: c.title,
      status: c.status,
      requires_review: c.requires_review,
      body: c.body,
      anchors: c.anchors,
      source_path: c.source_path,
      updated_at: c.updated_at,
    })),
    caveat:
      "Kortet er et markedsføringsmessig rammeverk (hva vi kan si / aldri sier), ikke helseråd. Et draft er ikke godkjent.",
  })
}
