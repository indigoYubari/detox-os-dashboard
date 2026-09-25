import { describe, expect, it } from "vitest"

import { koen } from "@/app/(ny)/dagens"

import {
  parseRequestBody,
  PRIORITIES,
  priorityFromBody,
  priorityOf,
  priorityRank,
  stripBodyTags,
  type RequestRow,
} from "../eiere"
import { REQUEST_ROW_COLUMNS } from "../eiere-server"

// Regresjonstest for kontrakten «priority skal leses av dashbordet» (Whatson
// 25.09). Bakgrunn: indigo-pilot sender priority i POST /request, og
// detox_actions skriver den foerst i body som `[to:…] [prio:…]`. Dashbordet
// leste den ikke — informasjonstap. Denne testen vokter begge sider:
//   1. lesesiden: prioriteten kommer ut av en rad slik den faktisk ligger i kwrj
//   2. overflaten: Agentkoeen sorterer hoey/kritisk foerst
// Body-hodene under er ordrett slik detox_actions skriver dem (verifisert mot
// basen 25.09: 10 av 19 rader baerer `[prio:high]`).

const NAA = new Date("2026-09-25T12:00:00Z")

function rad(
  id: string,
  body: string,
  created_at: string,
  extra: Partial<RequestRow> = {},
): RequestRow {
  return {
    id,
    requester: "detox-gpt",
    kind: "content",
    body,
    status: "open",
    created_at,
    ...extra,
  }
}

describe("priority leses fra raden", () => {
  it("leser [prio:high] fra body-hodet slik detox_actions skriver det", () => {
    const r = rad(
      "a",
      "[to:agent-anakinbot] [prio:high] Neste sak: magnesium og søvn\nLag utkast.",
      "2026-09-24T10:00:00Z",
    )
    expect(priorityOf(r)).toBe("high")
  })

  it("leser alle verdiene skriveren kan sende, og critical", () => {
    for (const p of PRIORITIES) {
      expect(priorityFromBody(`[to:agent-anakinbot] [prio:${p}] kort:x`)).toBe(p)
    }
  })

  it("gir null naar ingen tag — aldri et gjettet «normal»", () => {
    expect(priorityOf(rad("b", "Lag utkast til neste ukes innhold", "2026-09-24T10:00:00Z"))).toBeNull()
    expect(priorityOf(rad("c", "[explain_finding] til: agent-anakinbot · radar 2026-09-24", "2026-09-24T10:00:00Z"))).toBeNull()
  })

  it("gir null paa ukjent verdi i taggen", () => {
    expect(priorityFromBody("[to:agent-anakinbot] [prio:asap] kort:x")).toBeNull()
  })

  it("leser bare foerste linje — en tag lenger nede er tekst, ikke prioritet", () => {
    expect(priorityFromBody("kort:x\nHusk: [prio:high] betyr haster")).toBeNull()
  })

  it("foretrekker en priority-kolonne den dagen basen faar en", () => {
    const r = rad("d", "[to:agent-anakinbot] [prio:low] kort:x", "2026-09-24T10:00:00Z", {
      priority: "high",
    })
    expect(priorityOf(r)).toBe("high")
    // Ugyldig kolonneverdi faller tilbake paa body, ikke paa null.
    expect(priorityOf({ ...r, priority: "p0" })).toBe("low")
  })

  it("selecter ikke en priority-kolonne som ikke finnes (PostgREST 400)", () => {
    // Verifisert 2026-09-25 mot kwrj: requests har 10 kolonner, ingen priority.
    // Kommer kolonnen (med Adrians ja), oppdater baade denne og REQUEST_ROW_COLUMNS.
    expect(REQUEST_ROW_COLUMNS.split(/,\s*/)).not.toContain("priority")
  })

  it("holder serverens tagger ute av sammendraget, men beholder mottakeren", () => {
    const p = parseRequestBody("[to:agent-anakinbot] [prio:high] Neste sak: magnesium\nLag utkast.")
    expect(p.to).toBe("agent-anakinbot")
    expect(p.summary).toBe("Neste sak: magnesium\nLag utkast.")
    expect(stripBodyTags("[to:x] [prio:normal] kort:abc")).toBe("kort:abc")
    expect(stripBodyTags("kort:abc")).toBe("kort:abc")
  })

  it("rangerer kritisk foran hoey foran normal foran lav; ukjent som normal", () => {
    expect(priorityRank("critical")).toBeLessThan(priorityRank("high"))
    expect(priorityRank("high")).toBeLessThan(priorityRank("normal"))
    expect(priorityRank("normal")).toBeLessThan(priorityRank("low"))
    expect(priorityRank(null)).toBe(priorityRank("normal"))
  })
})

describe("Agentkoeen prioriterer", () => {
  const rader = [
    rad("gammel-normal", "[to:agent-anakinbot] [prio:normal] kort:1", "2026-09-20T10:00:00Z"),
    rad("uten-tag", "Lag utkast til neste Klaviyo-e-post", "2026-09-21T10:00:00Z", {
      requester: "kim@detox.no",
    }),
    rad("lav", "[to:agent-anakinbot] [prio:low] kort:2", "2026-09-19T10:00:00Z"),
    rad("ny-hoey", "[to:agent-anakinbot] [prio:high] kort:3", "2026-09-24T10:00:00Z"),
    rad("eldre-hoey", "[to:agent-anakinbot] [prio:high] kort:4", "2026-09-23T10:00:00Z"),
    rad("kritisk", "[to:agent-anakinbot] [prio:critical] kort:5", "2026-09-25T09:00:00Z"),
  ]

  it("legger kritisk og hoey foerst, eldst foerst innenfor samme nivaa", () => {
    const k = koen(rader, NAA)
    expect(k.oppdrag.map((o) => o.id)).toEqual([
      "kritisk",
      "eldre-hoey",
      "ny-hoey",
      "gammel-normal",
      "uten-tag",
      "lav",
    ])
  })

  it("teller det som haster, og beholder antall/eldste som foer", () => {
    const k = koen(rader, NAA)
    expect(k.haster).toBe(3)
    expect(k.antall).toBe(6)
    expect(k.eldste).toBe("2026-09-19T10:00:00Z")
  })

  it("gir lapp bare der prioriteten er sagt, og viser teksten uten tagger", () => {
    const k = koen(rader, NAA)
    const av = (id: string) => k.oppdrag.find((o) => o.id === id)!
    expect(av("kritisk").lapp).toBe("kritisk")
    expect(av("ny-hoey").lapp).toBe("haster")
    expect(av("lav").lapp).toBe("kan vente")
    expect(av("gammel-normal").lapp).toBeNull()
    expect(av("uten-tag").lapp).toBeNull()
    expect(av("uten-tag").fra).toBe("kim@detox.no")
    expect(av("ny-hoey").tekst).toBe("kort:3")
  })

  it("tom koe har ingenting som haster", () => {
    const k = koen([], NAA)
    expect(k.haster).toBe(0)
    expect(k.oppdrag).toEqual([])
  })
})
