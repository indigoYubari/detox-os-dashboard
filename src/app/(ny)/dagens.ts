// Rene hjelpere for «Dagens»-siden. Ingen Supabase-, Next- eller React-import,
// slik at reglene under kan testes uten aa rendre noe.
//
// Siden er en leseflate for Kim og Anniken. Den skal svare paa fire ting for
// GAARSDAGEN og NATTEN, og hvert svar skal kunne leses paa én linje. Alt som
// ikke er et svar hoerer bak «Se detaljer».

import type { FindingRow } from "@/lib/radar"
import type { RequestRow } from "@/lib/eiere"

const TZ = "Europe/Oslo"

/** Hvor langt tilbake vi regner noe som «i natt». Ad-agentene kjoerer 03-05. */
export const NATT_TIMER = 20

function deler(naa: Date, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("nb-NO", { timeZone: TZ, ...options }).format(
    naa,
  )
}

/** «16. september» — datoen slik den leses i overskriften. */
export function datoKort(naa: Date): string {
  return deler(naa, { day: "numeric", month: "long" })
}

/** «onsdag 16. september». */
export function datoLang(naa: Date): string {
  return deler(naa, { weekday: "long", day: "numeric", month: "long" })
}

/** Kroner slik de leses i et svar: «38 420 kr». Ingen desimaler. */
export function kr(n: number): string {
  return `${new Intl.NumberFormat("nb-NO", {
    maximumFractionDigits: 0,
  }).format(Math.round(n))} kr`
}

/** Heltall med tusenskille: «1 384». */
export function tall(n: number): string {
  return new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 }).format(n)
}

/** Antall hele timer siden et tidspunkt. null naar tidspunktet er ubrukelig. */
export function timerSiden(
  iso: string | null | undefined,
  naa: Date,
): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return Math.max(0, Math.floor((naa.getTime() - t) / 3_600_000))
}

/** «4 dager» / «3 timer» / «under en time». */
export function varighet(iso: string | null | undefined, naa: Date): string {
  const h = timerSiden(iso, naa)
  if (h === null) return "ukjent"
  if (h < 1) return "under en time"
  if (h < 24) return `${h} ${h === 1 ? "time" : "timer"}`
  const d = Math.floor(h / 24)
  return `${d} ${d === 1 ? "dag" : "dager"}`
}

// ── Natten som var ──────────────────────────────────────────────────────────

export type NattensFunn = {
  /** Funn opprettet innenfor NATT_TIMER, nyeste foerst. */
  funn: FindingRow[]
  perAgent: { anakin: number; indigo: number }
  /** Tidspunktet for det nyeste funnet — grunnlag for ferskhet. */
  siste: string | null
}

/**
 * Funn fra natten. Rapporten skrives én gang i doegnet, saa vinduet maa vaere
 * romsligere enn «i dag»: et funn klokka 03:40 hoerer til natten ogsaa naar
 * siden aapnes klokka 23. Funnet rapporten er tom for funn, er svaret null
 * funn — ikke en feil.
 */
export function nattensFunn(
  rows: readonly FindingRow[],
  naa: Date,
  timer: number = NATT_TIMER,
): NattensFunn {
  const grense = naa.getTime() - timer * 3_600_000
  const innenfor = rows
    .filter((r) => {
      const t = new Date(r.created_at).getTime()
      return !Number.isNaN(t) && t >= grense
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at))

  let anakin = 0
  let indigo = 0
  for (const r of innenfor) {
    if (r.report.agent_id === "agent-anakinbot") anakin++
    else if (r.report.agent_id === "agent-indigobot") indigo++
  }
  return {
    funn: innenfor,
    perAgent: { anakin, indigo },
    siste: innenfor[0]?.created_at ?? null,
  }
}

// ── Køen som venter ─────────────────────────────────────────────────────────

export type Koen = {
  antall: number
  eldste: string | null
  eldsteAlder: string | null
}

/** Alt som venter paa et ja/nei eller et svar. Sortert eldste foerst. */
export function koen(rows: readonly RequestRow[], naa: Date): Koen {
  const sortert = [...rows].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  )
  const eldste = sortert[0]?.created_at ?? null
  return {
    antall: sortert.length,
    eldste,
    eldsteAlder: eldste ? varighet(eldste, naa) : null,
  }
}

// ── Leden ───────────────────────────────────────────────────────────────────

/**
 * Den ene setningen oeverst. Den skal peke paa det som faktisk krever et
 * menneske — ikke paa det stoerste tallet. Rekkefoelgen under er bevisst:
 * en koe som venter gaar foran en omsetning som gikk bra, fordi omsetningen
 * ikke er noe aa bestemme.
 *
 * Returnerer ferdig tekst slik at setningen kan testes som den leses.
 */
export function lede(koe: Koen, natt: NattensFunn): string {
  if (koe.antall > 0) {
    const alder = koe.eldsteAlder
      ? ` Den eldste har ventet ${koe.eldsteAlder}.`
      : ""
    return `${koe.antall} ting venter på et ja eller nei.${alder}`
  }
  if (natt.funn.length > 0) {
    return `Ingenting venter på dere. Agentene la fra seg ${natt.funn.length} funn i natt.`
  }
  return "Ingenting venter på dere, og natten var stille."
}
