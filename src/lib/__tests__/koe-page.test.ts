// Render-test av /koe med datalaget mocket til poster slik de ligger i basen
// 25.09: en kø uten navn (produkt-kandidater), kort som har ventet en uke,
// annonse-råd som utgikk, og avgjørelser med og uten kvittering fra huben.
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const poster = vi.fn()
const koer = vi.fn()

vi.mock("../koe-poster-server", () => ({
  fetchPoster: () => poster(),
  POSTER_IKKE_KOBLET: "Postene er ikke koblet til ennå.",
  UTGAATT_DAGER: 7,
}))
vi.mock("../koer-server", () => ({
  fetchKoer: () => koer(),
  IKKE_KOBLET_TEKST: "Køen er ikke koblet til ennå.",
}))
vi.mock("next/headers", () => ({ cookies: () => ({ getAll: () => [], set: () => {} }) }))
vi.mock("next/cache", () => ({ revalidatePath: () => {} }))

const NAA_ISO = new Date().toISOString()
const dagerSiden = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString()

function post(over: Record<string, unknown>) {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    koe_id: "kim-kort",
    ekstern_id: "x",
    tittel: "Post",
    detalj: null,
    lenke: null,
    prioritet: 2,
    eier: "indigo",
    handling: "ja-nei",
    status: "venter",
    avgjort_av: null,
    avgjort_at: null,
    utfort_av: null,
    utfort_at: null,
    kilde: "test",
    opprettet: NAA_ISO,
    oppdatert: NAA_ISO,
    ...over,
  }
}

async function render(sp?: Record<string, string>) {
  const mod = await import("../../app/(ny)/koe/page")
  const el = await mod.default({ searchParams: sp })
  return renderToStaticMarkup(React.createElement(React.Fragment, null, el)).replace(/[  ]/g, " ")
}

beforeEach(() => {
  koer.mockResolvedValue({ ok: true, koer: [] })
  poster.mockResolvedValue({ ok: true, venter: [], avgjortIkkeUtfort: [], avgjortUtfort: [], utgaatt: {} })
})

describe("/koe", () => {
  it("tomt er tomt, ogsaa for avgjørelsene", async () => {
    const html = await render()
    expect(html).toContain("Ingenting venter")
    expect(html).toContain("Ingen avgjørelser ennå")
  })

  it("produkt-kandidater faar navn, forklaring og egne knappetekster", async () => {
    poster.mockResolvedValue({
      ok: true,
      venter: [post({ id: "00000000-0000-4000-8000-000000000002", koe_id: "produkt-kandidater", eier: "anniken", prioritet: 1, tittel: "Guide: tudca — 112 funn", opprettet: dagerSiden(1) })],
      avgjortIkkeUtfort: [],
      avgjortUtfort: [],
      utgaatt: {},
    })
    const html = await render()
    expect(html).toContain("Guider som venter på ja")
    expect(html).toContain("lages det et utkast til guiden")
    expect(html).toContain("Guide: tudca — 112 funn")
    expect(html).toContain("Ja, lag utkast")
    expect(html).not.toContain(">produkt-kandidater<")
  })

  it("sier fra om poster som har ventet over en uke, og om raad som utgikk", async () => {
    poster.mockResolvedValue({
      ok: true,
      venter: [
        post({ id: "00000000-0000-4000-8000-000000000003", tittel: "Magnesium — søvn", opprettet: dagerSiden(8) }),
        post({ id: "00000000-0000-4000-8000-000000000004", koe_id: "annonse-raad", eier: "anniken", prioritet: 1, tittel: "Pause kampanje X", opprettet: dagerSiden(0) }),
      ],
      avgjortIkkeUtfort: [],
      avgjortUtfort: [],
      utgaatt: { "annonse-raad": 25 },
    })
    const html = await render()
    expect(html).toContain("1 har ventet over en uke.")
    expect(html).toContain("har ventet 8 dager")
    expect(html).toContain("25 utgikk ubesvart siste 7 dager.")
    expect(html).toContain("byttes ut hver natt")
  })

  it("avgjort: kvittering fra huben, og varsel naar den ikke har utført", async () => {
    poster.mockResolvedValue({
      ok: true,
      venter: [],
      avgjortIkkeUtfort: [
        post({ id: "00000000-0000-4000-8000-000000000005", koe_id: "kim-kort", tittel: "Kreatin — form og opptak", status: "ja", avgjort_at: dagerSiden(2), oppdatert: dagerSiden(2) }),
      ],
      avgjortUtfort: [
        post({ id: "00000000-0000-4000-8000-000000000006", koe_id: "produkt-kandidater", eier: "anniken", tittel: "Guide: berberin — 113 funn", status: "ja", avgjort_at: dagerSiden(3), utfort_av: "demandscan-draft", utfort_at: dagerSiden(2), oppdatert: dagerSiden(2) }),
      ],
      utgaatt: {},
    })
    const html = await render()
    expect(html).toContain("2</strong> avgjørelser")
    expect(html).toContain("1 ikke utført ennå")
    expect(html).toContain("Du sa ja for 3 dager siden.")
    expect(html).toContain("Utført etter 1 dag av demandscan-draft.")
    expect(html).toContain("Ikke utført ennå.")
    expect(html).toContain("Kreatin — form og opptak")
  })

  it("feil ser ut som feil", async () => {
    poster.mockResolvedValue({ ok: false, error: "permission denied for table koe_poster", code: "no_access" })
    const html = await render()
    expect(html).toContain("Fikk ikke lest postene.")
    expect(html).toContain("permission denied for table koe_poster")
    expect(html).not.toContain("Ingen avgjørelser ennå")
  })
})
