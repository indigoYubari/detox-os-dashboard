import { describe, expect, it } from "vitest"

import {
  hasScope,
  requiredScopeForProxy,
  scopesForRole,
  type DetoxScope,
} from "../auth-policy"

// Grensen en Custom GPT ALDRI skal krysse. Disse testene beskriver mandatets
// §21: en maskinidentitet skal kunne lese, og skal bli avvist med 403 - ikke
// 401 - når den forsøker å skrive eller godkjenne. 403 er poenget: den ER
// autentisert, den har bare ikke lov.

const SERVICE_SCOPES = scopesForRole("service")

/** Speiler authorize(): null = tillatt, ellers statuskoden som ville blitt gitt. */
function outcomeFor(scopes: readonly DetoxScope[], required: DetoxScope) {
  return hasScope(scopes, required) ? "allowed" : 403
}

describe("Kim GPT (rolle service) - hva den får lov til", () => {
  it("kan lese", () => {
    expect(outcomeFor(SERVICE_SCOPES, "detox:read")).toBe("allowed")
  })

  it("kan foreslå", () => {
    expect(outcomeFor(SERVICE_SCOPES, "action:propose")).toBe("allowed")
  })
})

describe("Kim GPT - hva den ALDRI får lov til", () => {
  it("kan ikke skrive -> 403", () => {
    expect(outcomeFor(SERVICE_SCOPES, "work:write")).toBe(403)
  })

  it("kan ikke godkjenne -> 403 (slicens viktigste negative test)", () => {
    expect(outcomeFor(SERVICE_SCOPES, "action:approve")).toBe(403)
  })

  it("kan ikke administrere -> 403", () => {
    expect(outcomeFor(SERVICE_SCOPES, "admin")).toBe(403)
  })

  it("har ikke admin-scopet som ville implisert alt annet", () => {
    // hasScope gir automatisk tilgang til alt for "admin". At service ikke har
    // det, er nettopp det som gjør de tre testene over meningsfulle.
    expect(SERVICE_SCOPES).not.toContain("admin")
  })

  it("får 403 på approve-ruten i proxyen", () => {
    const required = requiredScopeForProxy("proposals/abc-123/approve", "POST")
    expect(required).toBe("action:approve")
    expect(outcomeFor(SERVICE_SCOPES, required!)).toBe(403)
  })

  it("får 403 på reject-ruten i proxyen", () => {
    const required = requiredScopeForProxy("proposals/abc-123/reject", "POST")
    expect(required).toBe("action:approve")
    expect(outcomeFor(SERVICE_SCOPES, required!)).toBe(403)
  })

  it("slipper ikke gjennom på en ukjent mutasjon (deny by default)", () => {
    expect(requiredScopeForProxy("clients/123/delete", "POST")).toBeNull()
  })
})

describe("scope-settet er akkurat det avtalte", () => {
  it("service har nøyaktig detox:read og action:propose", () => {
    expect([...SERVICE_SCOPES].sort()).toEqual(["action:propose", "detox:read"])
  })

  it("en GPT som hadde arvet en menneskekonto ville fått approve", () => {
    // T20, dokumentert i detox-os-architecture docs/security.md. Dette er
    // grunnen til at GPT-en har egen maskinidentitet i stedet for å logge inn
    // som as.shikoba (admin) eller Kim (founder).
    expect(hasScope(scopesForRole("admin"), "action:approve")).toBe(true)
    expect(hasScope(scopesForRole("founder"), "action:approve")).toBe(true)
    expect(hasScope(SERVICE_SCOPES, "action:approve")).toBe(false)
  })
})
