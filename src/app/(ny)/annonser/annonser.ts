// Rene hjelpere for «Annonsene» i den nye flaten: dypdykket i betalt media.
// Tallene kommer fra ad-agenten via /api/detox (metrics, campaign-health,
// search-terms, proposals); raadene kommer fra basen (recommendations,
// agent-ads). Her staar bare setningene og reglene. Ingen React, ingen fetch.

import { CHANNEL_LABELS, healthLevel, roasLabel, type HealthLevel } from "@/lib/ad-format"
import type {
  CampaignHealth,
  ChannelMetrics,
  MetricsResponse,
  Proposal,
  SearchTerm,
} from "@/lib/detox-api"

import { kr, tall } from "../dagens"

/** Hvor mange hele dager dypdykket ser paa. */
export const DAGER = 30

/** Kanalene som faktisk koster penger. Shopify og Klaviyo er egne seksjoner. */
export const BETALTE = ["google_ads", "meta"] as const

export type Kanal = {
  id: string
  navn: string
  brukt: number
  tilbake: number
  roas: number | null
  helse: HealthLevel
  salg: number
  klikk: number
  /** Forbruk mot forrige periode, i prosent. null = ingen sammenligning. */
  bruktDelta: number | null
}

export type BetaltMedia = {
  brukt: number
  tilbake: number
  /** Samlet ROAS over de betalte kanalene: tilbake ÷ brukt. null uten forbruk. */
  roas: number | null
  kanaler: Kanal[]
  /** Kanaler med forbruk og ROAS under 1. */
  tapere: Kanal[]
}

export function betaltMedia(m: MetricsResponse): BetaltMedia {
  const kanaler = m.channels
    .filter((c): c is ChannelMetrics => (BETALTE as readonly string[]).includes(c.channel))
    .map((c) => ({
      id: c.channel,
      navn: CHANNEL_LABELS[c.channel] ?? c.channel,
      brukt: c.spend,
      tilbake: c.revenue,
      roas: c.roas,
      helse: healthLevel(c.roas),
      salg: c.conversions,
      klikk: c.clicks,
      bruktDelta: m.comparison?.channels[c.channel]?.spend.pct ?? null,
    }))
    .sort((a, b) => b.brukt - a.brukt)
  const brukt = kanaler.reduce((s, k) => s + k.brukt, 0)
  const tilbake = kanaler.reduce((s, k) => s + k.tilbake, 0)
  return {
    brukt,
    tilbake,
    roas: brukt > 0 ? tilbake / brukt : null,
    kanaler,
    tapere: kanaler.filter((k) => k.brukt > 0 && (k.roas ?? 0) < 1),
  }
}

/** «Hver krone ga 3,4 tilbake» / «Går med tap» — hooken foer tallet. */
export function betaltHook(b: BetaltMedia): { hook: string; ned: boolean } {
  if (b.roas === null) return { hook: "Ingen forbruk", ned: false }
  if (b.roas < 1) return { hook: "Går med tap", ned: true }
  if (b.roas < 4) return { hook: "Tjener seg inn", ned: false }
  return { hook: "Går godt", ned: false }
}

/** «Hver krone ga 3,40 kr tilbake: 42 000 kr brukt, 142 800 kr tilbake.» */
export function betaltTekst(b: BetaltMedia): string {
  if (b.roas === null) return `Ingen annonseutgifter registrert de siste ${DAGER} dagene.`
  return `${kr(b.brukt)} brukt, ${kr(b.tilbake)} tilbake (${roasLabel(b.roas)}).`
}

export function kanalLinje(k: Kanal): string {
  const delta =
    k.bruktDelta === null
      ? ""
      : ` Forbruk ${k.bruktDelta > 0 ? "+" : k.bruktDelta < 0 ? "-" : ""}${Math.abs(k.bruktDelta).toFixed(0)} % mot forrige periode.`
  return `${kr(k.brukt)} brukt, ${kr(k.tilbake)} tilbake (${roasLabel(k.roas)}), ${tall(k.salg)} salg.${delta}`
}

// ── Kampanjene (Google Ads) ────────────────────────────────────────────────

export type KampanjeStatus = "tap" | "budsjett" | "god" | "ok" | "stille"

export function kampanjeStatus(c: CampaignHealth): KampanjeStatus {
  if (c.spend <= 0) return "stille"
  if (c.roas !== null && c.roas < 1) return "tap"
  if (c.budgetLimited) return "budsjett"
  if (c.roas !== null && c.roas >= 4) return "god"
  return "ok"
}

export const KAMPANJE_TEKST: Record<KampanjeStatus, string> = {
  tap: "går med tap",
  budsjett: "begrenset av budsjettet",
  god: "går godt",
  ok: "greit",
  stille: "ingen forbruk",
}

export type Kampanjer = {
  antall: number
  aktive: number
  tap: CampaignHealth[]
  budsjett: CampaignHealth[]
  /** Aktive foerst, saa tap foerst innenfor, saa hoeyest forbruk. */
  sortert: CampaignHealth[]
}

const STATUS_RANG: Record<KampanjeStatus, number> = { tap: 0, budsjett: 1, ok: 2, god: 3, stille: 4 }

export function kampanjer(rows: readonly CampaignHealth[]): Kampanjer {
  const sortert = [...rows].sort(
    (a, b) => STATUS_RANG[kampanjeStatus(a)] - STATUS_RANG[kampanjeStatus(b)] || b.spend - a.spend,
  )
  return {
    antall: rows.length,
    aktive: rows.filter((c) => c.spend > 0).length,
    tap: sortert.filter((c) => kampanjeStatus(c) === "tap"),
    budsjett: sortert.filter((c) => kampanjeStatus(c) === "budsjett"),
    sortert,
  }
}

/** Svaret for kampanjene: det som krever handling foerst. */
export function kampanjeSvar(k: Kampanjer): { hook: string; ned: boolean } {
  if (k.antall === 0) return { hook: "Ingen kampanjer", ned: false }
  if (k.tap.length > 0)
    return {
      hook: `${k.tap.length} ${k.tap.length === 1 ? "kampanje går" : "kampanjer går"} med tap`,
      ned: true,
    }
  if (k.budsjett.length > 0)
    return {
      hook: `${k.budsjett.length} ${k.budsjett.length === 1 ? "kampanje er" : "kampanjer er"} begrenset av budsjettet`,
      ned: false,
    }
  return { hook: `Alle ${k.aktive} aktive kampanjene tjener seg inn`, ned: false }
}

// ── Soekeordene (Google Ads) ───────────────────────────────────────────────

export type Soekeord = {
  antall: number
  bortkastet: SearchTerm[]
  sterke: SearchTerm[]
  /** Kroner brukt paa soek som ikke ga noe. */
  bortkastetKr: number
}

export function soekeord(terms: readonly SearchTerm[]): Soekeord {
  const bortkastet = terms.filter((t) => t.flag === "wasted").sort((a, b) => b.cost - a.cost)
  const sterke = terms.filter((t) => t.flag === "strong").sort((a, b) => b.revenue - a.revenue)
  return {
    antall: terms.length,
    bortkastet,
    sterke,
    bortkastetKr: bortkastet.reduce((s, t) => s + t.cost, 0),
  }
}

export function soekeordSvar(s: Soekeord): { hook: string; ned: boolean } {
  if (s.antall === 0) return { hook: "Ingen søkeord", ned: false }
  if (s.bortkastet.length > 0)
    return {
      hook: `${kr(s.bortkastetKr)} brukt på søk som ikke ga noe`,
      ned: true,
    }
  return { hook: "Ingen bortkastede søk", ned: false }
}

// ── Forslagene (annonsemotoren) ───────────────────────────────────────────

export type Forslag = {
  antall: number
  kritiske: Proposal[]
  /** Kritisk foerst, saa advarsel, saa info; nyeste foerst innenfor. */
  sortert: Proposal[]
}

const PRIO_RANG: Record<Proposal["priority"], number> = { critical: 0, warning: 1, info: 2 }

export function forslag(rows: readonly Proposal[]): Forslag {
  const sortert = [...rows].sort(
    (a, b) => PRIO_RANG[a.priority] - PRIO_RANG[b.priority] || b.created_at.localeCompare(a.created_at),
  )
  return { antall: rows.length, kritiske: sortert.filter((p) => p.priority === "critical"), sortert }
}

export function forslagSvar(f: Forslag): { hook: string; ned: boolean } {
  if (f.antall === 0) return { hook: "Ingen forslag venter", ned: false }
  if (f.kritiske.length > 0)
    return {
      hook: `${f.kritiske.length} ${f.kritiske.length === 1 ? "kritisk forslag" : "kritiske forslag"} av ${f.antall}`,
      ned: true,
    }
  return { hook: `${f.antall} ${f.antall === 1 ? "forslag venter" : "forslag venter"}`, ned: false }
}

export const PRIO_TEKST: Record<Proposal["priority"], string> = {
  critical: "kritisk",
  warning: "advarsel",
  info: "info",
}
