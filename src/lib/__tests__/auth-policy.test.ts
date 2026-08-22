import { describe, expect, it } from "vitest"

import {
  buildDecidedBy,
  hasScope,
  isApiPath,
  isPublicPath,
  parseProposalDecision,
  requiredScopeForProxy,
  scopesForRole,
} from "@/lib/auth-policy"

describe("isPublicPath (eksplisitt allow-list)", () => {
  it("tillater kun /login anonymt", () => {
    expect(isPublicPath("/login")).toBe(true)
    expect(isPublicPath("/login/")).toBe(true)
  })
  it("beskytter alt annet, inkludert alle API-stier", () => {
    expect(isPublicPath("/")).toBe(false)
    expect(isPublicPath("/i-dag")).toBe(false)
    expect(isPublicPath("/api/detox/metrics")).toBe(false)
    expect(isPublicPath("/api/gmail/kundeservice")).toBe(false)
    expect(isPublicPath("/api/v1/me")).toBe(false)
    expect(isPublicPath("/api/analyser-referat")).toBe(false)
  })
  it("lar ikke prefiks-lookalikes slippe gjennom", () => {
    expect(isPublicPath("/loginx")).toBe(false)
  })
})

describe("isApiPath", () => {
  it("identifiserer API-stier for 401-JSON i stedet for redirect", () => {
    expect(isApiPath("/api/detox/metrics")).toBe(true)
    expect(isApiPath("/api")).toBe(true)
    expect(isApiPath("/i-dag")).toBe(false)
    expect(isApiPath("/apikatalog")).toBe(false)
  })
})

describe("scopesForRole (least privilege)", () => {
  it("gir kun detox:read for manglende/ukjent rolle", () => {
    expect(scopesForRole(undefined)).toEqual(["detox:read"])
    expect(scopesForRole(null)).toEqual(["detox:read"])
    expect(scopesForRole("superadmin")).toEqual(["detox:read"])
    expect(scopesForRole(42)).toEqual(["detox:read"])
  })
  it("gir founder approve-tilgang", () => {
    expect(scopesForRole("founder")).toContain("action:approve")
  })
  it("gir ALDRI service-rollen (maskin/GPT) approve-tilgang", () => {
    expect(scopesForRole("service")).not.toContain("action:approve")
    expect(scopesForRole("service")).not.toContain("admin")
  })
  it("gir ikke operator approve-tilgang", () => {
    expect(scopesForRole("operator")).not.toContain("action:approve")
  })
})

describe("hasScope", () => {
  it("krever eksakt scope", () => {
    expect(hasScope(["detox:read"], "action:approve")).toBe(false)
    expect(hasScope(["detox:read", "action:approve"], "action:approve")).toBe(true)
  })
  it("admin impliserer alle scopes", () => {
    expect(hasScope(["admin"], "action:approve")).toBe(true)
    expect(hasScope(["admin"], "detox:read")).toBe(true)
  })
})

describe("requiredScopeForProxy", () => {
  it("krever detox:read for alle GET", () => {
    expect(requiredScopeForProxy("metrics", "GET")).toBe("detox:read")
    expect(requiredScopeForProxy("proposals", "GET")).toBe("detox:read")
    expect(requiredScopeForProxy("proposals/execution-status", "GET")).toBe(
      "detox:read",
    )
  })
  it("krever action:approve for approve og reject", () => {
    expect(requiredScopeForProxy("proposals/abc-123/approve", "POST")).toBe(
      "action:approve",
    )
    expect(requiredScopeForProxy("proposals/abc-123/reject", "POST")).toBe(
      "action:approve",
    )
  })
  it("avviser ukjente POST-stier (deny by default)", () => {
    expect(requiredScopeForProxy("metrics", "POST")).toBeNull()
    expect(requiredScopeForProxy("proposals/abc/execute", "POST")).toBeNull()
    expect(requiredScopeForProxy("proposals//approve", "POST")).toBeNull()
  })
})

describe("parseProposalDecision", () => {
  it("parser id og handling", () => {
    expect(parseProposalDecision("proposals/uuid-1/approve")).toEqual({
      id: "uuid-1",
      action: "approve",
    })
    expect(parseProposalDecision("proposals/uuid-2/reject")).toEqual({
      id: "uuid-2",
      action: "reject",
    })
  })
  it("returnerer null for alt annet", () => {
    expect(parseProposalDecision("proposals/uuid-1")).toBeNull()
    expect(parseProposalDecision("proposals/uuid-1/approve/extra")).toBeNull()
    expect(parseProposalDecision("metrics")).toBeNull()
  })
})

describe("buildDecidedBy (ekte actor-identitet)", () => {
  it("bruker e-post når den finnes", () => {
    expect(buildDecidedBy({ id: "u1", email: "kim@detox.no" })).toBe(
      "kim@detox.no",
    )
  })
  it("faller tilbake til bruker-ID, aldri en syntetisk konstant", () => {
    expect(buildDecidedBy({ id: "u1", email: null })).toBe("u1")
    expect(buildDecidedBy({ id: "u1", email: "" })).toBe("u1")
    expect(buildDecidedBy({ id: "u1" })).not.toBe("detox-os")
  })
})
