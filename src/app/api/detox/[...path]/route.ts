import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'

import {
  buildDecidedBy,
  parseProposalDecision,
  requiredScopeForProxy,
} from '@/lib/auth-policy'
import {
  authorize,
  recordActivityEvent,
  requireDetoxPrincipal,
} from '@/lib/auth-server'
import { backendAuthHeaders, DETOX_BACKEND_URL } from '@/lib/detox-backend'

// Autentisert proxy mot ad-automation-agent. Krav (ADR-010, Mission 01):
// - anonym tilgang avvises (401), manglende scope avvises (403)
// - decided_by settes ALLTID server-side fra faktisk innlogget bruker
// - X-Correlation-Id følger kjeden dashboard -> ad-agent -> activity_events
// - approve/reject skrives til append-only activity_events (best effort)
// - Railway Basic Auth forblir server-side og når aldri browseren

async function forward(
  request: NextRequest,
  params: { path: string[] },
  method: 'GET' | 'POST',
) {
  const user = await requireDetoxPrincipal()
  const path = params.path.join('/')

  const requiredScope = requiredScopeForProxy(path, method)
  if (requiredScope === null) {
    return NextResponse.json(
      { error: 'Ukjent operasjon', code: 'unknown_operation' },
      { status: 403 },
    )
  }
  const denied = authorize(user, requiredScope)
  if (denied) {
    // Avviste autorisasjonsforsok ble tidligere ikke logget i det hele tatt
    // (T18 i detox-os-architecture docs/security.md): authorize() returnerte
    // 403 for recordActivityEvent ble kalt, saa "identitet uten
    // godkjenningsrett forsokte aa godkjenne" etterlot ingen spor.
    //
    // Vi logger kun naar kalleren FAKTISK er autentisert men mangler scope.
    // En anonym request har ingen identitet aa knytte raden til (RLS krever
    // actor_id = auth.uid()), og skal fortsatt bare fa 401.
    if (user) {
      await recordActivityEvent({
        actorId: user.id,
        actorType: user.actorType,
        source: user.actorType === 'service' ? user.principal : undefined,
        accessToken: user.accessToken,
        eventType: 'authorization.denied',
        objectType: 'api_route',
        objectId: path,
        detail: {
          method,
          required_scope: requiredScope,
          principal: user.principal,
          actor_type: user.actorType,
          configured_for: user.configuredFor,
          role: user.role,
        },
      })
    }
    return denied
  }
  // authorize garanterer user her.
  const actor = user!

  const correlationId = randomUUID()
  const search = request.nextUrl.searchParams.toString()
  const url = `${DETOX_BACKEND_URL}/api/${path}${search ? `?${search}` : ''}`

  const headers: Record<string, string> = {
    ...backendAuthHeaders(),
    'X-Correlation-Id': correlationId,
    'X-Detox-Actor-Id': actor.id,
    'X-Detox-Actor': actor.principal,
    'X-Detox-Actor-Type': actor.actorType,
  }

  const decision = method === 'POST' ? parseProposalDecision(path) : null

  let body: string | undefined
  if (method === 'POST') {
    headers['content-type'] = 'application/json'
    let parsed: Record<string, unknown> = {}
    try {
      const text = await request.text()
      if (text) parsed = JSON.parse(text) as Record<string, unknown>
    } catch {
      parsed = {}
    }
    if (decision) {
      // Klientens decided_by ignoreres alltid - identiteten kommer fra sesjonen.
      parsed.decided_by = buildDecidedBy(actor)
    }
    body = JSON.stringify(parsed)
  }

  try {
    const res = await fetch(url, { method, headers, body, cache: 'no-store' })
    const data = await res.json()

    if (decision) {
      const outcome = res.ok
        ? `proposal.${decision.action}d`
        : 'proposal.decision_failed'
      await recordActivityEvent({
        actorId: actor.id,
        actorType: actor.actorType,
        source: actor.actorType === 'service' ? actor.principal : undefined,
        accessToken: actor.accessToken,
        eventType: outcome,
        objectType: 'action_proposal',
        objectId: decision.id,
        correlationId,
        detail: {
          action: decision.action,
          backend_status: res.status,
          decided_by: buildDecidedBy(actor),
          principal: actor.principal,
          configured_for: actor.configuredFor,
        },
      })
    }

    const response = NextResponse.json(data, { status: res.status })
    response.headers.set('X-Correlation-Id', correlationId)
    return response
  } catch {
    if (decision) {
      await recordActivityEvent({
        actorId: actor.id,
        actorType: actor.actorType,
        source: actor.actorType === 'service' ? actor.principal : undefined,
        accessToken: actor.accessToken,
        eventType: 'proposal.decision_failed',
        objectType: 'action_proposal',
        objectId: decision.id,
        correlationId,
        detail: {
          action: decision.action,
          error: 'backend_unreachable',
          principal: actor.principal,
          configured_for: actor.configuredFor,
        },
      })
    }
    return NextResponse.json(
      { error: 'Backend utilgjengelig', code: 'backend_unavailable' },
      { status: 502 },
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  return forward(request, params, 'GET')
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  return forward(request, params, 'POST')
}
