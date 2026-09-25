// Rene hjelpere for «Butikken» i den nye flaten: dypdykket i Shopify-tallene.
// Tallene leses av butikk.ts (lesButikkTall, lesProduktTall, lesLagerTall) fra
// ad-agentens /api/metrics, /api/metrics/shopify og /api/metrics/inventory.
// Her staar bare setningene — hook foer tall — og reglene for hva som er verdt
// aa si. Ingen React, ingen fetch.

import type { ButikkTall, LagerTall, ProduktTall } from "@/lib/butikk"

import { kr, tall } from "../dagens"

/** Hvor mange hele dager dypdykket ser paa. Til og med i gaar; se butikkVindu. */
export const DAGER = 30

export type Retning = { hook: string; ned: boolean }

/** Retningen paa omsetningen mot forrige periode. ±1 % er flatt. */
export function retning(pct: number | null | undefined): Retning {
  if (pct === null || pct === undefined) return { hook: "Siste 30 dager", ned: false }
  if (pct > 10) return { hook: "Godt opp", ned: false }
  if (pct > 1) return { hook: "Litt opp", ned: false }
  if (pct < -10) return { hook: "Klart ned", ned: true }
  if (pct < -1) return { hook: "Litt ned", ned: true }
  return { hook: "Flatt", ned: false }
}

/** «195 408 kr på 174 ordrer» */
export function omsetningTekst(b: ButikkTall): string {
  return `${kr(b.omsetning)} på ${tall(b.ordrer)} ${b.ordrer === 1 ? "ordre" : "ordrer"}`
}

function pst(pct: number | null | undefined): string | null {
  if (pct === null || pct === undefined) return null
  // nb-NO skriver minus som U+2212; vi vil ha en vanlig bindestrek, som pctLabel.
  const t = Math.abs(pct).toLocaleString("nb-NO", { maximumFractionDigits: 1 })
  return `${pct > 0 ? "+" : pct < 0 ? "-" : ""}${t} %`
}

/** «Mot forrige 30 dager: omsetning +4,2 %, ordrer −1,0 %. Snittordre 1 123 kr (+5,3 %).» */
export function omsetningHjelp(b: ButikkTall): string {
  const o = pst(b.delta.omsetning?.pct)
  const a = pst(b.delta.ordrer?.pct)
  const s = pst(b.delta.snittordre?.pct)
  const deler: string[] = []
  if (o || a) {
    deler.push(
      `Mot forrige ${DAGER} dager: ${[o ? `omsetning ${o}` : null, a ? `ordrer ${a}` : null].filter(Boolean).join(", ")}.`,
    )
  } else {
    deler.push(`Ingen forrige periode å sammenligne med.`)
  }
  deler.push(`Snittordre ${kr(b.snittordre)}${s ? ` (${s})` : ""}, ${tall(b.enheter)} solgte enheter.`)
  return deler.join(" ")
}

/** Netto: det som staar igjen naar refunderte og annullerte ordrer er tatt ut. */
export function nettoTekst(p: ProduktTall): string {
  const utelatt =
    p.netto.utelatt > 0
      ? ` ${tall(p.netto.utelatt)} ${p.netto.utelatt === 1 ? "ordre" : "ordrer"} holdt utenfor (refundert eller annullert).`
      : " Ingen refunderte eller annullerte ordrer."
  const delvis =
    p.netto.delvisRefundert > 0
      ? ` ${tall(p.netto.delvisRefundert)} delvis refundert, beløpet er ukjent og er med.`
      : ""
  return `Netto ${kr(p.netto.omsetning)} på ${tall(p.netto.ordrer)} ordrer.${utelatt}${delvis}`
}

export type ProduktSvar = { navn: string; omsetning: number; enheter: number } | null

/** Det ene produktet som solgte mest. null naar ingenting ble solgt. */
export function toppProdukt(p: ProduktTall): ProduktSvar {
  const t = [...p.topp].sort((a, b) => b.omsetning - a.omsetning)[0]
  return t ? { navn: t.navn, omsetning: t.omsetning, enheter: t.enheter } : null
}

export type KundeSvar = {
  /** «Flest nye», «Flest returnerende», «Likt fordelt» */
  hook: string
  tekst: string
}

function andel(a: number | null): string {
  return a === null ? "ukjent andel" : `${Math.round(a * 100)} %`
}

export function kundeSvar(p: ProduktTall): KundeSvar {
  const nye = p.kunder.nye
  const ret = p.kunder.returnerende
  const hook =
    nye.ordrer > ret.ordrer ? "Flest nye kunder" : ret.ordrer > nye.ordrer ? "Flest returnerende" : "Likt fordelt"
  const ukjent = p.kunder.ukjent.ordrer > 0 ? ` ${tall(p.kunder.ukjent.ordrer)} uten kundeprofil.` : ""
  return {
    hook,
    tekst: `${tall(nye.ordrer)} ordrer fra nye (${andel(nye.andel)}), ${tall(ret.ordrer)} fra returnerende (${andel(ret.andel)}).${ukjent}`,
  }
}

export type LagerSvar = {
  /** null = ingenting krever oppmerksomhet. */
  varsel: string | null
  tekst: string
}

export function lagerSvar(l: LagerTall): LagerSvar {
  const varsel =
    l.utsolgt > 0
      ? `${tall(l.utsolgt)} ${l.utsolgt === 1 ? "produkt er utsolgt" : "produkter er utsolgt"}`
      : l.lavt > 0
        ? `${tall(l.lavt)} ${l.lavt === 1 ? "produkt har lite igjen" : "produkter har lite igjen"}`
        : null
  return {
    varsel,
    tekst: `${tall(l.enheter)} enheter på lager fordelt på ${tall(l.produkter)} produkter. Lite igjen betyr ${l.terskel} eller færre.`,
  }
}
