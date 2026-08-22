// Ren autorisasjonspolicy for Detox API-gatewayen. Ingen Next/Supabase-importer,
// slik at både middleware, route handlers og tester kan bruke den.
// Se detox-os-architecture: decisions/ADR-010-gateway-implementation.md og docs/iam.md.

export type DetoxScope =
  | "detox:read"
  | "work:write"
  | "action:propose"
  | "action:approve"
  | "admin"

export type DetoxRole = "admin" | "founder" | "operator" | "service"

// Rolle -> scopes. Rollen leses fra app_metadata.detox_role i Supabase-JWT
// (settes kun av admin, aldri av brukeren selv). Ukjent/manglende rolle gir
// kun lesetilgang (least privilege). En maskin-/GPT-identitet ("service")
// får aldri action:approve.
export const ROLE_SCOPES: Record<DetoxRole, DetoxScope[]> = {
  admin: ["detox:read", "work:write", "action:propose", "action:approve", "admin"],
  founder: ["detox:read", "work:write", "action:propose", "action:approve"],
  operator: ["detox:read", "work:write", "action:propose"],
  service: ["detox:read", "action:propose"],
}

export const DEFAULT_SCOPES: DetoxScope[] = ["detox:read"]

// Headeren en Custom GPT sender sin maskin-credential i. Ligger her, ikke i
// gpt-auth.ts, fordi middleware kjorer i Edge-runtime og ikke kan importere
// node:crypto / supabase-js.
export const GPT_CREDENTIAL_HEADER = "x-detox-gpt-key"

export function scopesForRole(role: unknown): DetoxScope[] {
  if (typeof role === "string" && role in ROLE_SCOPES) {
    return ROLE_SCOPES[role as DetoxRole]
  }
  return DEFAULT_SCOPES
}

export function hasScope(scopes: readonly string[], scope: DetoxScope): boolean {
  return scopes.includes(scope) || scopes.includes("admin")
}

// ── Offentlige stier ─────────────────────────────────────────────
// Alt er beskyttet by default. Kun stier i denne listen er anonyme.
// (Statiske assets ekskluderes allerede av middleware-matcheren.)
export const PUBLIC_PATHS = ["/login"] as const

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export function isApiPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/")
}

// ── Scope-krav for detox-proxyen ─────────────────────────────────
// path er delene bak /api/detox/, f.eks. "proposals/<id>/approve".
// null = ikke tillatt (deny by default for ukjente mutasjoner).
export type ProposalDecision = { id: string; action: "approve" | "reject" }

const DECISION_RE = /^proposals\/([^/]+)\/(approve|reject)$/

export function parseProposalDecision(path: string): ProposalDecision | null {
  const m = DECISION_RE.exec(path)
  if (!m) return null
  return { id: m[1], action: m[2] as "approve" | "reject" }
}

export function requiredScopeForProxy(
  path: string,
  method: "GET" | "POST",
): DetoxScope | null {
  if (method === "GET") return "detox:read"
  if (parseProposalDecision(path)) return "action:approve"
  // Ukjente POST-stier slippes ikke gjennom med en generell skrivescope:
  // nye mutasjoner må legges til her eksplisitt.
  return null
}

// ── Actor-identitet ──────────────────────────────────────────────
// decided_by settes ALLTID server-side fra faktisk innlogget bruker.
// Klientens innsendte verdi ignoreres.
export function buildDecidedBy(user: { email?: string | null; id: string }): string {
  return user.email && user.email.length > 0 ? user.email : user.id
}
