import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"

import { describe, expect, it } from "vitest"

// Vakt mot oppdiktede tall i grenseseittet.
//
// Bakgrunn: regelen «mock eller seed-data skal aldri presenteres som live
// virkelighet» ble skrevet fordi fire API-ruter returnerte oppdiktede tall med
// status 200. Rutene ble ryddet — men de HARDKODEDE SIDENE ble stående i ukevis,
// fordi ingen leter i en side som «bare er en tabell». /okonomi hadde bankkontoer
// og MVA-frister, /quiz hadde en anbefaling utledet av oppdiktede trakttall, og
// /anmeldelser hadde oppdiktede personer med oppdiktede kundeuttalelser.
//
// Denne testen leter etter nettopp det mønsteret: en array av objekt-literaler
// som ser ut som datarader — en dato i 2000-tallet, et navn, eller et tresifret
// tall. Den er bevisst grov: en falsk positiv koster en kommentar, en falsk
// negativ koster tillit til hele dashbordet.

const ROT = join(__dirname, "..", "..")

/** Rader som ser ut som ekte data, men er skrevet inn i koden. */
const MISTENKELIGE = [
  { navn: "dato i 2000-tallet", re: /\b20\d{2}-\d{2}-\d{2}\b/ },
  { navn: "personnavn med initial", re: /"[A-ZÆØÅ][a-zæøå]+ [A-ZÆØÅ]\./ },
  { navn: "tresifret tall", re: /[^a-zA-Z0-9_]\d{3,}[^a-zA-Z0-9_]/ },
]

function tsxFiler(mappe: string): string[] {
  const ut: string[] = []
  for (const navn of readdirSync(mappe)) {
    if (navn === "__tests__" || navn === "node_modules") continue
    const sti = join(mappe, navn)
    if (statSync(sti).isDirectory()) ut.push(...tsxFiler(sti))
    else if (navn.endsWith(".tsx")) ut.push(sti)
  }
  return ut
}

/**
 * Er linja en objekt-literal som ser ut som en datarad?
 * `{ name: "X", antall: 12 }` er mistenkelig. `{ href: "/x" }` er det ikke.
 */
function erDatarad(linje: string): { ja: boolean; hvorfor: string } {
  const trimmet = linje.trim()
  if (!trimmet.startsWith("{")) return { ja: false, hvorfor: "" }
  // To eller flere nøkkel: verdi-par skiller en datarad fra en konfigurasjon.
  const par = trimmet.match(/[a-zA-Z_][a-zA-Z0-9_]*\s*:/g) ?? []
  if (par.length < 2) return { ja: false, hvorfor: "" }
  for (const { navn, re } of MISTENKELIGE) {
    if (re.test(trimmet)) return { ja: true, hvorfor: navn }
  }
  return { ja: false, hvorfor: "" }
}

describe("ingen oppdiktede tall i grenseseittet", () => {
  const filer = tsxFiler(ROT)

  it("finner filene den skal se på", () => {
    expect(filer.length).toBeGreaterThan(20)
  })

  it("har ingen objekt-literaler som ser ut som hardkodede datarader", () => {
    const treff: string[] = []
    for (const sti of filer) {
      const linjer = readFileSync(sti, "utf8").split("\n")
      linjer.forEach((linje, i) => {
        const { ja, hvorfor } = erDatarad(linje)
        if (ja) {
          treff.push(
            `${relative(ROT, sti)}:${i + 1} (${hvorfor}) — ${linje.trim().slice(0, 90)}`,
          )
        }
      })
    }
    expect(
      treff,
      treff.length === 0
        ? ""
        : "Hardkodede datarader funnet. Enten hentes de fra en kilde, eller " +
            "siden viser en navngitt grunn — ikke tall som ser ekte ut:\n  " +
            treff.join("\n  "),
    ).toEqual([])
  })
})
