// Server-side auth-helpere for route handlers (App Router).
// Bruker Supabase Auth via cookies. service_role brukes ALDRI her.

import { createServerClient } from "@supabase/ssr"
import { cookies, headers } from "next/headers"
import { NextResponse } from "next/server"

import {
  buildDecidedBy,
  hasScope,
  scopesForRole,
  type DetoxScope,
} from "./auth-policy"
import {
  authenticateGptRequest,
  createMachineSupabaseClient,
} from "./gpt-auth"

export type DetoxUser = {
  id: string
  email: string | null
  role: string
  scopes: DetoxScope[]
  // Normalisert actor-ID til audit/decided_by: e-post, ellers bruker-ID.
  actorLabel: string
}

/**
 * En autentisert kaller - menneske eller maskin.
 *
 * `principal` er identiteten som handlet. For et menneske er det e-post/uuid;
 * for en Custom GPT er det maskinnavnet ("kim-gpt"). `configuredFor` sier
 * hvilket menneske GPT-en er KONFIGURERT for, og er kontekst - aldri bevis
 * for at personen selv utførte handlingen. Se detox-os-architecture
 * docs/iam.md og mandatets §7.
 */
export type DetoxPrincipal = DetoxUser & {
  principal: string
  actorType: "human" | "service"
  configuredFor: string | null
  /** Maskinidentitetens JWT. Kun satt for actorType "service". */
  accessToken?: string
}

export function createSupabaseServerClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Route handlers kan ikke alltid sette cookies - trygt å ignorere.
          }
        },
      },
    },
  )
}

/**
 * Henter autentisert Detox-bruker fra requestens Supabase-session.
 * Returnerer null når requesten er anonym/ugyldig.
 */
export async function requireDetoxUser(): Promise<DetoxUser | null> {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) return null

  const role = (user.app_metadata as Record<string, unknown> | null)?.detox_role
  const scopes = scopesForRole(role)
  return {
    id: user.id,
    email: user.email ?? null,
    role: typeof role === "string" ? role : "none",
    scopes,
    actorLabel: buildDecidedBy({ id: user.id, email: user.email }),
  }
}

/**
 * Autentiserer en request som menneske ELLER maskin (Custom GPT).
 *
 * Rekkefølgen er bevisst: en gyldig GPT-credential vinner, slik at en GPT
 * aldri kan arve en menneskelig cookie-sesjon som tilfeldigvis følger med.
 * Header-tilstedeværelse alene autentiserer aldri - `authenticateGptRequest`
 * returnerer null hvis credentialen ikke hasher til en registrert klient, og
 * da faller vi tilbake til den vanlige menneskelige sesjonssjekken.
 */
export async function requireDetoxPrincipal(): Promise<DetoxPrincipal | null> {
  const gpt = await authenticateGptRequest(headers())
  if (gpt) {
    return {
      id: gpt.userId,
      email: gpt.email,
      role: gpt.role,
      scopes: gpt.scopes,
      actorLabel: gpt.principal,
      principal: gpt.principal,
      actorType: "service",
      configuredFor: gpt.configuredFor,
      accessToken: gpt.accessToken,
    }
  }

  const user = await requireDetoxUser()
  if (!user) return null
  return {
    ...user,
    principal: user.actorLabel,
    actorType: "human",
    configuredFor: null,
  }
}

export function unauthenticatedResponse() {
  return NextResponse.json(
    { error: "Ikke innlogget", code: "unauthenticated" },
    { status: 401 },
  )
}

export function forbiddenResponse(scope: DetoxScope) {
  return NextResponse.json(
    {
      error: `Mangler tilgang (${scope})`,
      code: "forbidden",
      required_scope: scope,
    },
    { status: 403 },
  )
}

/** 401/403-respons hvis brukeren mangler, eller mangler scope. null = OK. */
export function authorize(
  user: DetoxUser | null,
  scope: DetoxScope,
): NextResponse | null {
  if (!user) return unauthenticatedResponse()
  if (!hasScope(user.scopes, scope)) return forbiddenResponse(scope)
  return null
}

/**
 * Append-only audit til activity_events, med kallerens egen session (RLS
 * krever actor_id = auth.uid()). Best effort: audit-feil velter aldri svaret,
 * men logges strukturert.
 *
 * For en maskinprinsipal sendes `accessToken`, slik at raden skrives med
 * GPT-brukerens egen `auth.uid()` - ikke med service_role, og aldri med et
 * menneskes identitet.
 */
export async function recordActivityEvent(event: {
  actorId: string
  actorType?: "human" | "service"
  eventType: string
  objectType?: string
  objectId?: string
  source?: string
  correlationId?: string
  detail?: Record<string, unknown>
  accessToken?: string
}): Promise<void> {
  try {
    const supabase = event.accessToken
      ? createMachineSupabaseClient(event.accessToken)
      : createSupabaseServerClient()
    const { error } = await supabase.from("activity_events").insert({
      actor_id: event.actorId,
      actor_type: event.actorType ?? "human",
      event_type: event.eventType,
      object_type: event.objectType ?? null,
      object_id: event.objectId ?? null,
      source: event.source ?? "detox-os-dashboard",
      correlation_id: event.correlationId ?? null,
      detail: event.detail ?? {},
    })
    if (error) {
      console.error(
        JSON.stringify({
          msg: "activity_event_insert_failed",
          error: error.message,
          event_type: event.eventType,
          correlation_id: event.correlationId,
        }),
      )
    }
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "activity_event_insert_threw",
        error: err instanceof Error ? err.message : String(err),
        event_type: event.eventType,
        correlation_id: event.correlationId,
      }),
    )
  }
}
