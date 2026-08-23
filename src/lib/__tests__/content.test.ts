import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"

import { describe, expect, it } from "vitest"

import {
  CONTENT_STAGE_STATUSES,
  CONTENT_STAGES,
  countByStage,
  freshnessOf,
  latestSyncedAt,
  STAGE_LABELS,
  STALE_AFTER_MS,
  type ContentItem,
} from "../content"

const ROOT = resolve(__dirname, "../../..")

function item(partial: Partial<ContentItem>): ContentItem {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    title: "T",
    topic: null,
    stage: "brief",
    stage_status: "pending",
    channels: [],
    requested_by: null,
    source_repo: "detox-vault",
    source_path: "p.md",
    data_mode: "live",
    created_at: "2026-08-23T00:00:00Z",
    updated_at: "2026-08-23T00:00:00Z",
    synced_at: null,
    ...partial,
  }
}

describe("freshnessOf", () => {
  const now = Date.parse("2026-08-23T12:00:00Z")

  it("er live rett etter synk", () => {
    expect(freshnessOf("2026-08-23T11:00:00Z", now)).toEqual({
      mode: "live",
      ageMs: 3600_000,
    })
  })

  it("blir stale naar synced_at er eldre enn terskelen", () => {
    const old = new Date(now - STALE_AFTER_MS - 1000).toISOString()
    expect(freshnessOf(old, now).mode).toBe("stale")
  })

  it("er ukjent naar synced_at mangler eller er ugyldig", () => {
    expect(freshnessOf(null, now)).toEqual({ mode: "unknown", ageMs: null })
    expect(freshnessOf("ikke en dato", now)).toEqual({
      mode: "unknown",
      ageMs: null,
    })
  })
})

describe("latestSyncedAt", () => {
  it("velger nyeste, og taaler rader uten synced_at", () => {
    expect(
      latestSyncedAt([
        item({ synced_at: "2026-08-20T00:00:00Z" }),
        item({ synced_at: null }),
        item({ synced_at: "2026-08-23T00:00:00Z" }),
      ]),
    ).toBe("2026-08-23T00:00:00Z")
  })

  it("gir null for tomt sett", () => {
    expect(latestSyncedAt([])).toBeNull()
  })
})

describe("countByStage", () => {
  it("teller per stage og gir 0 for tomme stages", () => {
    expect(
      countByStage([
        item({ stage: "brief" }),
        item({ stage: "brief" }),
        item({ stage: "draft" }),
      ]),
    ).toEqual({ brief: 2, draft: 1, claim_check: 0, voice_channel: 0 })
  })
})

// Vokabularet finnes tre steder: SQL-check i migrasjonen, sync-modulen og denne
// TS-modulen. Testene under feiler hvis de drifter fra hverandre — det er
// billigere enn en runtime-avvisning som ser ut som en RLS-feil.
describe("stage-vokabular mot migrasjon 0007", () => {
  const sql = readFileSync(
    join(ROOT, "supabase/migrations/0007_content_items.sql"),
    "utf8",
  )

  function checkValues(column: string): string[] {
    const re = new RegExp(`check\\s*\\(${column} in \\(([^)]*)\\)\\)`, "i")
    const m = re.exec(sql)
    if (!m) throw new Error(`Fant ingen check-constraint for ${column} i 0007`)
    return m[1].split(",").map((v) => v.trim().replace(/^'|'$/g, ""))
  }

  it("stage-verdiene i TS er de samme som i databasen", () => {
    expect(checkValues("stage").sort()).toEqual([...CONTENT_STAGES].sort())
  })

  it("stage_status-verdiene i TS er de samme som i databasen", () => {
    expect(checkValues("stage_status").sort()).toEqual(
      [...CONTENT_STAGE_STATUSES].sort(),
    )
  })

  it("har en unik constraint paa (source_repo, source_path) slik syncen forutsetter", () => {
    expect(sql).toMatch(/unique\s*\(source_repo,\s*source_path\)/i)
  })

  it("gir ikke rollen service skrivetilgang", () => {
    const writePolicies = sql.match(/detox_role'\)\s*in\s*\(([^)]*)\)/g) ?? []
    expect(writePolicies.length).toBeGreaterThan(0)
    for (const policy of writePolicies) {
      expect(policy).not.toContain("service")
    }
  })

  it("gir ikke anon noen grants", () => {
    expect(sql).toMatch(/revoke all on public\.content_items from anon/i)
    expect(sql).not.toMatch(/grant[^;]*to anon/i)
  })

  it("gir ikke DELETE til authenticated", () => {
    const grant =
      /grant ([^;]*) on public\.content_items to authenticated/i.exec(sql)
    expect(grant).not.toBeNull()
    expect(grant![1]).not.toMatch(/delete|truncate/i)
  })
})

describe("STAGE_LABELS", () => {
  it("dekker hver stage", () => {
    for (const stage of CONTENT_STAGES) {
      expect(STAGE_LABELS[stage]).toBeTruthy()
    }
  })
})
