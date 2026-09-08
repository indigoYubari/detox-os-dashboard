import { describe, expect, it } from "vitest"

import { classifyError } from "../eiere-server"

describe("classifyError", () => {
  it("gjenkjenner manglende grants/policyer som no_access", () => {
    expect(classifyError("permission denied for table reports")).toBe("no_access")
    expect(classifyError("42501: permission denied")).toBe("no_access")
  })
  it("alt annet er other", () => {
    expect(classifyError("fetch failed")).toBe("other")
    expect(classifyError("relation \"reports\" does not exist")).toBe("other")
  })
})
