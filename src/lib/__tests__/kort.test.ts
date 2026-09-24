import { describe, expect, it } from "vitest"

import {
  bestillingBody,
  bestillingHode,
  erIde,
  ideDeler,
  kildeLenke,
  kortSeksjoner,
  lysAv,
  lysTekst,
  merkeAv,
  statusTekst,
  utenMarkdown,
  vinkelAv,
} from "../kort"
import { parseRequestBody } from "../eiere"

const BODY = {
  betydning_for_detox: "Vi selger Dr. Mercola Ashwagandha. Dataene sier: et signal på stress.",
  kan_si: { portal: "Portal-tekst.", reels: "Reels-tekst.", mail: "Mail-tekst." },
  aldri_si: ["«Mot angst»", "«Balanserer hormoner»"],
  produkt: "Dr. Mercola Ashwagandha (60 kapsler).",
  gjor_i_dag: "Lag presisjons-historien.",
  dor_naar: "Ny SR/MA som endrer bildet.",
  kilde: ["PMC12242034 (2025)", "PMID 42738987"],
}

describe("statusTekst", () => {
  it("sier hva statusen betyr for en eier", () => {
    expect(statusTekst("active")).toBe("I bruk")
    expect(statusTekst("draft")).toBe("Venter på ja fra deg")
    expect(statusTekst("superseded")).toMatch(/nyere/)
  })
})

describe("kortSeksjoner", () => {
  it("leser i eierens rekkefølge: betyr, kan si, aldri, produkt, vinkel, utløper, kilder", () => {
    const s = kortSeksjoner(BODY)
    expect(s.map((x) => x.key)).toEqual([
      "betyr", "kan_si", "aldri_si", "produkt", "gjor_i_dag", "dor_naar", "kilde",
    ])
    expect(s[1].kanaler?.map((k) => k.navn)).toEqual(["På nettsiden", "I en reel", "I en e-post"])
    expect(s[2].punkter).toHaveLength(2)
    expect(s[6].overskrift).toMatch(/til slutt/)
  })

  it("hopper over tomme seksjoner og tåler rart innhold", () => {
    expect(kortSeksjoner(null)).toEqual([])
    expect(kortSeksjoner({ betydning_for_detox: "  ", kan_si: {}, aldri_si: [] })).toEqual([])
    expect(kortSeksjoner({ kan_si: "én streng" })[0].kanaler?.[0].tekst).toBe("én streng")
  })

  it("vinkelen er «gjør i dag», ellers «betyr»", () => {
    expect(vinkelAv(BODY)).toBe("Lag presisjons-historien.")
    expect(vinkelAv({ betydning_for_detox: "B" })).toBe("B")
    expect(vinkelAv(undefined)).toBe("")
  })
})

describe("kildeLenke", () => {
  it("peker på fila i ICM-repoet, ellers null", () => {
    expect(kildeLenke("MindMatter1444/mindmatter-icm", "detox/indigo/jobs/topics/x/kim-kort.md")).toBe(
      "https://github.com/MindMatter1444/mindmatter-icm/blob/main/detox/indigo/jobs/topics/x/kim-kort.md",
    )
    expect(kildeLenke(null, "x")).toBeNull()
    expect(kildeLenke("ikke et repo", "x")).toBeNull()
  })
})

describe("idékort", () => {
  const rad = { type: "ide", project: "indigo-copilot", tags: ["merke:detox", "lys:gul", "tema:magnesium", "agent:indigobot"] }

  it("kjenner Indigos idékort, ikke seed-raden", () => {
    expect(erIde(rad)).toBe(true)
    expect(erIde({ type: "ide", project: "detox.OS", tags: ["mock"] })).toBe(false)
    expect(erIde({ type: "ide", project: "detox.OS", tags: ["agent:indigobot"] })).toBe(true)
    expect(erIde({ type: "forskning", project: "indigo-copilot", tags: [] })).toBe(false)
  })

  it("leser lys og merke som ord", () => {
    expect(lysAv(rad.tags)).toBe("gul")
    expect(lysTekst("gul")).toMatch(/omformuleres/)
    expect(lysTekst(null)).toMatch(/ikke sjekket/)
    expect(merkeAv(rad.tags)).toBe("Detox")
    expect(merkeAv(["merke:yubari"])).toBe("Indigo Yubari")
  })

  it("deler excerpt i Notion, setning, claims og røde", () => {
    const d = ideDeler(
      "https://www.notion.so/x-1\nVinkel: si tretthet, ikke søvn.\n\nclaims: 🟢 1 · 🟡 1 · 🔴 1\n🔴 «kurerer søvnløshet»",
    )
    expect(d.notion).toBe("https://www.notion.so/x-1")
    expect(d.setning).toBe("Vinkel: si tretthet, ikke søvn.")
    expect(d.claims).toBe("🟢 1 · 🟡 1 · 🔴 1")
    expect(d.rode).toEqual(["«kurerer søvnløshet»"])
    expect(ideDeler(null)).toEqual({ notion: null, setning: "", claims: null, rode: [] })
  })
})

describe("bestilling til Anakin", () => {
  it("hodet har samme form som /eiere og nevner Anakin", () => {
    const hode = bestillingHode({ slag: "kort", id: "abc" })
    expect(hode).toBe("[lag_innhold] til: agent-anakinbot · ref kim_cards/abc")
    const p = parseRequestBody(bestillingBody({ slag: "kort", id: "abc", story: "s", title: "T", vinkel: "V" }, "kim@detox.no"))
    expect(p.to).toBe("agent-anakinbot")
    expect(p.ref).toBe("kim_cards/abc")
  })

  it("idé-bestillingen bærer kort:<id>, vinkel, claims og Notion", () => {
    const b = bestillingBody(
      { slag: "ide", id: "gpt-detox-20260924-46192d75", title: "T", notion: "https://www.notion.so/x", setning: "S", claims: "🟢 1 · 🟡 0 · 🔴 0" },
      "kim@detox.no",
    )
    expect(b).toContain("ref notes/gpt-detox-20260924-46192d75")
    expect(b).toContain("kort:gpt-detox-20260924-46192d75")
    expect(b).toContain("Vinkelen: «S»")
    expect(b).toContain("claims: 🟢 1 · 🟡 0 · 🔴 0")
    expect(b).toContain("Notion: https://www.notion.so/x")
    expect(b).toMatch(/publiser ingenting/)
  })
})

describe("utenMarkdown", () => {
  it("fjerner stjerner et menneske ikke skal lese", () => {
    expect(utenMarkdown("**men ikke for søvn** og *hvilke* tilskudd")).toBe("men ikke for søvn og hvilke tilskudd")
    expect(utenMarkdown("2 * 3 = 6")).toBe("2 * 3 = 6")
    expect(kortSeksjoner({ aldri_si: ["Kreatin har **ingen** godkjente"] })[0].punkter?.[0]).toBe("Kreatin har ingen godkjente")
  })
})
