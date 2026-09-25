// Rene hjelpere for «Anakin»-siden i den nye flaten: porten av (main)/eiere.
// Ingen Supabase-, Next- eller React-import, slik at reglene kan testes uten aa
// rendre noe. Datakildene er de samme som foer (reports/findings/
// recommendations/requests/content_items via eiere.ts + eiere-server.ts); det
// som er nytt er spraaket: ett svar per seksjon, hook foer tall.

import type { ContentItem } from "@/lib/content"
import {
  aovOf,
  excerpt,
  latestResponse,
  pctLabel,
  stripApprovalMark,
  weekBucketOf,
  type Plan,
  type Puls,
  type RadarRecommendation,
  type Thread,
  type WeekBucket,
} from "@/lib/eiere"

import { kr, tall } from "../dagens"

// ── Pulsen ──────────────────────────────────────────────────────────────────

export type PulsSvar = {
  /** «Litt opp», «Ned», «Flatt» — hooken foer tallet. */
  hook: string
  /** «195 408 kr på 174 ordrer siste uke». */
  tekst: string
  /** true naar uken er svakere enn den foer — seksjonen varsler. */
  ned: boolean
}

/**
 * Retningen foerst, saa tallet. Terskelen er bevisst lav: ±1 % er «flatt»,
 * fordi Anakins tall er ukesummer og én stor ordre flytter dem.
 */
export function pulsSvar(p: Puls): PulsSvar {
  const d = p.revenueDeltaPct
  const hook =
    d === null
      ? "Siste uke"
      : d > 10
        ? "Godt opp"
        : d > 1
          ? "Litt opp"
          : d < -10
            ? "Klart ned"
            : d < -1
              ? "Litt ned"
              : "Flatt"
  return {
    hook,
    tekst: `${kr(p.revenue7d)} på ${tall(p.orders7d)} ${p.orders7d === 1 ? "ordre" : "ordrer"} siste uke`,
    ned: d !== null && d < -1,
  }
}

/** Uken foer, endringene og snittkurven — én linje. */
export function pulsHjelp(p: Puls): string {
  const a = aovOf(p)
  const deler = [
    `Uken før: ${kr(p.revenuePrev)} på ${tall(p.ordersPrev)} ordrer.`,
    `Omsetning ${pctLabel(p.revenueDeltaPct)}, ordrer ${pctLabel(p.ordersDeltaPct)}.`,
  ]
  if (a.aov !== null) {
    deler.push(
      `Snittkurv ${kr(a.aov)}${a.aovDeltaPct !== null ? ` (${pctLabel(a.aovDeltaPct)})` : ""}, beregnet av tallene.`,
    )
  }
  return deler.join(" ")
}

// ── Planen ──────────────────────────────────────────────────────────────────

/** Anbefalingen slik den leses: uten godkjenningsmerket, kuttet paa ordgrense. */
export function anbefalingTekst(r: Pick<RadarRecommendation, "action">, maks = 160): string {
  return excerpt(stripApprovalMark(r.action), maks)
}

export type PlanSvar = {
  /** Det ene neste trekket, eller null naar ingenting venter. */
  neste: string | null
  venter: number
  avgjort: number
}

export function planSvar(plan: Plan): PlanSvar {
  const venter =
    plan.neste.length + plan.sporA.length + plan.sporB.length + plan.utenSpor.length
  return {
    neste: plan.neste[0] ? anbefalingTekst(plan.neste[0]) : null,
    venter,
    avgjort: plan.avgjort,
  }
}

/** «3 venter på avgjørelse, 4 er avgjort. Spor A 2 · spor B 1.» */
export function planHjelp(plan: Plan): string {
  const s = planSvar(plan)
  const spor: string[] = []
  if (plan.sporA.length > 0) spor.push(`spor A ${plan.sporA.length}`)
  if (plan.sporB.length > 0) spor.push(`spor B ${plan.sporB.length}`)
  const rest = spor.length > 0 ? ` Resten av planen: ${spor.join(" · ")}.` : ""
  const avgjort = s.avgjort > 0 ? `, ${s.avgjort} ${s.avgjort === 1 ? "er" : "er"} avgjort` : ""
  return `${s.venter} ${s.venter === 1 ? "anbefaling venter" : "anbefalinger venter"} på avgjørelse${avgjort}.${rest}`
}

// ── Samtalene ───────────────────────────────────────────────────────────────

export type SamtaleStatus = {
  totalt: number
  paagaar: number
  /** Det siste Anakin sa, i noen traad — overskriften. null = hun har ikke svart ennaa. */
  siste: { tekst: string; threadKey: string } | null
}

export function samtaleStatus(threads: readonly Thread[]): SamtaleStatus {
  let siste: SamtaleStatus["siste"] = null
  for (const t of threads) {
    const r = latestResponse(t)
    if (r?.response) {
      siste = { tekst: excerpt(r.response, 140), threadKey: t.key }
      break
    }
  }
  return {
    totalt: threads.length,
    paagaar: threads.filter((t) => t.active).length,
    siste,
  }
}

// ── Uken ────────────────────────────────────────────────────────────────────

export type Uken = {
  totalt: number
  per: Record<WeekBucket, ContentItem[]>
}

export function uken(items: readonly ContentItem[]): Uken {
  const per: Record<WeekBucket, ContentItem[]> = {
    planlagt: [],
    venter: [],
    blokkert: [],
  }
  for (const it of items) per[weekBucketOf(it.stage_status)].push(it)
  return { totalt: items.length, per }
}

/** «7 idéer i arbeid: 2 planlagt, 4 venter, 1 blokkert.» */
export function ukenSvar(u: Uken): string {
  if (u.totalt === 0) return "Ingen idéer i arbeid"
  const deler: string[] = []
  if (u.per.planlagt.length > 0) deler.push(`${u.per.planlagt.length} planlagt`)
  if (u.per.venter.length > 0) deler.push(`${u.per.venter.length} venter`)
  if (u.per.blokkert.length > 0) deler.push(`${u.per.blokkert.length} blokkert`)
  return `${u.totalt} ${u.totalt === 1 ? "idé" : "idéer"} i arbeid: ${deler.join(", ")}`
}
