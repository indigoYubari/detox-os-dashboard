// Rene hjelpere for «Funnene» i den nye flaten: porten av (main)/radar.
// Ingen Supabase-, Next- eller React-import. Kildene er de samme som foer
// (findings ⋈ reports via radar.ts / radar-server.ts); det nye er spraaket.

import {
  AGENTS,
  filterHref,
  KINDS,
  kindLabel,
  PERIOD_DAYS,
  type AgentId,
  type FindingRow,
  type RadarFilters,
} from "@/lib/radar"

export const FUNN_STI = "/funn"

/** Lenke til denne siden med ett filter endret. */
export function funnHref(filters: RadarFilters, endring: Partial<RadarFilters>): string {
  return filterHref({ ...filters, ...endring }, FUNN_STI)
}

export type FilterValg = { tekst: string; href: string; valgt: boolean }

export function periodeValg(filters: RadarFilters): FilterValg[] {
  return (["7d", "30d"] as const).map((p) => ({
    tekst: `Siste ${PERIOD_DAYS[p]} dager`,
    href: funnHref(filters, { periode: p }),
    valgt: filters.periode === p,
  }))
}

export function agentValg(filters: RadarFilters): FilterValg[] {
  return [
    { tekst: "Begge", href: funnHref(filters, { agent: "alle" }), valgt: filters.agent === "alle" },
    { tekst: "Anakin", href: funnHref(filters, { agent: "anakin" }), valgt: filters.agent === "anakin" },
    { tekst: "Indigo", href: funnHref(filters, { agent: "indigo" }), valgt: filters.agent === "indigo" },
  ]
}

/** Typene som faktisk finnes i radene — bare de er verdt en knapp. Valgt type staar alltid. */
export function typeValg(filters: RadarFilters, rows: readonly FindingRow[]): FilterValg[] {
  const finnes = new Set(rows.map((r) => r.kind))
  if (filters.kind) finnes.add(filters.kind)
  const ut: FilterValg[] = [
    { tekst: "Alle typer", href: funnHref(filters, { kind: null }), valgt: filters.kind === null },
  ]
  for (const k of KINDS) {
    if (!finnes.has(k)) continue
    ut.push({ tekst: kindLabel(k), href: funnHref(filters, { kind: k }), valgt: filters.kind === k })
  }
  return ut
}

/** Den ene setningen oeverst: hvor mange funn, fra hvem, i hvilket vindu. */
export function funnLede(antall: number, filters: RadarFilters): string {
  const dager = PERIOD_DAYS[filters.periode]
  const hvem =
    filters.agent === "alle" ? "agentene" : AGENTS[agentIdFor(filters.agent)].label
  const type = filters.kind ? ` av typen «${kindLabel(filters.kind)}»` : ""
  if (antall === 0) return `Ingen funn${type} fra ${hvem} siste ${dager} dager.`
  return `${antall} ${antall === 1 ? "funn" : "funn"}${type} fra ${hvem} siste ${dager} dager.`
}

function agentIdFor(a: "anakin" | "indigo"): AgentId {
  return a === "anakin" ? "agent-anakinbot" : "agent-indigobot"
}

/** Nyeste foerst — slik radarserveren leverer, men vi stoler ikke paa det. */
export function nyesteForst(rows: readonly FindingRow[]): FindingRow[] {
  return [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at))
}
