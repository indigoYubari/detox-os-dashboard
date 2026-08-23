import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  collectContentItems,
  parseFrontmatter,
  sectionParagraph,
  stageStatusFrom,
  toContentItem,
} from "../../../scripts/lib/content-source.mjs"

// Ekte frontmatter fra detox-vault:
// workflows/content/stages/01-brief/output/magnesium-brief.md (2026-08-18).
const MAGNESIUM_BRIEF = `---
tema: magnesium
kanaler: [blogg-detox-no, nyhetsbrev-klaviyo, instagram-post]
dato: 2026-08-18
bestilt-av: Kim
status: klar-til-utkast
---

## Temasetning

Magnesium er ikke ett stoff -- formen avgjor hva kroppen faktisk bruker det til.

## Formal

Opplysning pluss salgsstotte.
`

function makeVault() {
  const root = mkdtempSync(join(tmpdir(), "detox-vault-"))
  for (const dir of [
    "01-brief",
    "02-draft",
    "03-claim-check",
    "04-voice-channel",
  ]) {
    const out = join(root, "workflows", "content", "stages", dir, "output")
    mkdirSync(out, { recursive: true })
    writeFileSync(join(out, ".gitkeep"), "")
  }
  return root
}

describe("parseFrontmatter", () => {
  it("leser skalarer og inline-lister", () => {
    const fm = parseFrontmatter(MAGNESIUM_BRIEF)
    expect(fm.tema).toBe("magnesium")
    expect(fm["bestilt-av"]).toBe("Kim")
    expect(fm.kanaler).toEqual([
      "blogg-detox-no",
      "nyhetsbrev-klaviyo",
      "instagram-post",
    ])
  })

  it("gir tomt objekt uten frontmatter", () => {
    expect(parseFrontmatter("# Bare en overskrift")).toEqual({})
  })
})

describe("sectionParagraph", () => {
  it("henter forste avsnitt under mellomtittelen", () => {
    expect(sectionParagraph(MAGNESIUM_BRIEF, "Temasetning")).toMatch(
      /^Magnesium er ikke ett stoff/,
    )
  })

  it("gir null naar mellomtittelen mangler", () => {
    expect(sectionParagraph(MAGNESIUM_BRIEF, "Finnes ikke")).toBeNull()
  })
})

describe("stageStatusFrom", () => {
  it("mapper kjente vault-statuser", () => {
    expect(stageStatusFrom("klar-til-utkast")).toBe("complete")
    expect(stageStatusFrom("trenger-research")).toBe("needs_research")
    expect(stageStatusFrom("blokkert")).toBe("blocked")
  })

  it("faller til pending framfor aa gjette modenhet", () => {
    expect(stageStatusFrom("noe-helt-nytt")).toBe("pending")
    expect(stageStatusFrom(null)).toBe("pending")
  })
})

describe("toContentItem", () => {
  it("oversetter den ekte briefen til en rad", () => {
    const row = toContentItem({
      raw: MAGNESIUM_BRIEF,
      stage: "brief",
      sourcePath: "workflows/content/stages/01-brief/output/magnesium-brief.md",
      filename: "magnesium-brief.md",
    })
    expect(row).toMatchObject({
      topic: "magnesium",
      stage: "brief",
      stage_status: "complete",
      requested_by: "Kim",
      channels: ["blogg-detox-no", "nyhetsbrev-klaviyo", "instagram-post"],
      source_repo: "detox-vault",
      data_mode: "live",
    })
    expect(row.title).toMatch(/^Magnesium er ikke ett stoff/)
  })

  it("faller tilbake til filnavn som tittel uten Temasetning", () => {
    const row = toContentItem({
      raw: "---\ntema: tudca\n---\n\nBare brodtekst.",
      stage: "draft",
      sourcePath: "x/tudca-utkast.md",
      filename: "tudca-utkast.md",
    })
    expect(row.title).toBe("Tudca utkast")
  })
})

describe("collectContentItems", () => {
  it("ignorerer .gitkeep — tomme stages gir ingen rader", () => {
    expect(collectContentItems(makeVault())).toEqual([])
  })

  it("finner filer i hver stage og utleder stage fra mappenavnet", () => {
    const root = makeVault()
    const stages = join(root, "workflows", "content", "stages")
    writeFileSync(
      join(stages, "01-brief", "output", "magnesium-brief.md"),
      MAGNESIUM_BRIEF,
    )
    writeFileSync(
      join(stages, "03-claim-check", "output", "rapport.md"),
      "# Rapport",
    )

    const items = collectContentItems(root)
    expect(items.map((i) => i.stage)).toEqual(["brief", "claim_check"])
    expect(items[0].source_path).toBe(
      "workflows/content/stages/01-brief/output/magnesium-brief.md",
    )
  })

  it("taaler at en vault mangler content-workflowen helt", () => {
    expect(collectContentItems(mkdtempSync(join(tmpdir(), "tom-")))).toEqual([])
  })

  it("er deterministisk — samme vault gir samme rader", () => {
    const root = makeVault()
    writeFileSync(
      join(
        root,
        "workflows",
        "content",
        "stages",
        "01-brief",
        "output",
        "a.md",
      ),
      MAGNESIUM_BRIEF,
    )
    expect(collectContentItems(root)).toEqual(collectContentItems(root))
  })
})
