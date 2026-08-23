import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"

import { describe, expect, it } from "vitest"

// Denne testen finnes fordi to hendelser i dette repoet hadde samme feilklasse:
// koden NEVNES, men KJORES ikke (middleware i repo-roten, og route-auth-testen
// som besto fordi import-linjen inneholdt funksjonsnavnet). Sjekkene under
// fjerner derfor import-linjer for de leter, og krever faktisk kall-syntaks.
//
// De finnes ogsaa fordi /innhold var 100 % mock fram til 2026-08-23. Hvis noen
// legger inn et hardkodet innholdsarray igjen, skal suiten si fra.

const ROOT = resolve(__dirname, "../../..")
const PAGE = join(ROOT, "src/app/(main)/innhold/page.tsx")

function sourceWithoutImports(path: string): string {
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => !/^\s*(import|export .* from)\b/.test(line))
    .join("\n")
}

describe("/innhold bruker den ekte datakilden", () => {
  it("kaller fetchContentItems — ikke bare importerer den", () => {
    const body = sourceWithoutImports(PAGE)
    expect(body).toMatch(/\bfetchContentItems\s*\(/)
  })

  it("venter paa svaret framfor aa rendre et ubrukt promise", () => {
    expect(sourceWithoutImports(PAGE)).toMatch(/await\s+fetchContentItems\s*\(/)
  })

  it("er en server-komponent, slik at RLS gjelder for brukerens egen session", () => {
    // "use client" ville flyttet lesingen til nettleseren og dermed til
    // anon-nokkelen i bundelen.
    expect(readFileSync(PAGE, "utf8")).not.toMatch(/^\s*["']use client["']/m)
  })

  it("har ingen hardkodet innholdsliste igjen", () => {
    const body = sourceWithoutImports(PAGE)
    expect(body).not.toMatch(/CONTENT_ITEMS/)
    // Et array-literal av objekter med title/status er mock-formen som stod her.
    expect(body).not.toMatch(/\[\s*\{\s*id:\s*["']C-\d/)
  })

  it("haandterer feil og tomt sett eksplisitt", () => {
    const body = sourceWithoutImports(PAGE)
    expect(body).toMatch(/result\.ok/)
    expect(body).toMatch(/items\.length === 0/)
  })

  it("viser provenance/ferskhet", () => {
    const body = sourceWithoutImports(PAGE)
    expect(body).toMatch(/\bfreshnessOf\s*\(/)
    expect(body).toMatch(/\blatestSyncedAt\s*\(/)
  })
})

/** Fjerner kommentarer, slik at en omtale av service_role ikke teller som bruk. */
function codeOnly(path: string): string {
  return readFileSync(join(ROOT, path), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line))
    .join("\n")
}

describe("content-lesingen bruker aldri service_role", () => {
  it("hverken i lib eller i syncen", () => {
    for (const path of [
      "src/lib/content.ts",
      "src/lib/content-server.ts",
      "scripts/sync-content-from-vault.mjs",
    ]) {
      expect(codeOnly(path)).not.toMatch(/SERVICE_ROLE/i)
    }
  })

  it("syncen logger inn som en ekte bruker slik at RLS gjelder", () => {
    const sync = sourceWithoutImports(
      join(ROOT, "scripts/sync-content-from-vault.mjs"),
    )
    expect(sync).toMatch(/signInWithPassword\s*\(/)
    expect(sync).toMatch(/onConflict:\s*["']source_repo,source_path["']/)
  })
})
