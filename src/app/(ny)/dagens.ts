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

// ── Køene ───────────────────────────────────────────────────────────────────

export type Koen = {
  antall: number
  eldste: string | null
  eldsteAlder: string | null
}

/**
 * `requests` er AGENTENES arbeidskø — oppdrag fra Kim og fra detox-gpt til
 * Anakin, med status open/in_progress/done. Den er IKKE eiernes
 * godkjenningskø.
 *
 * Dette ble lest feil 17.09: lede-setningen sa «N ting venter på et ja eller
 * nei» og telte disse radene, mens det som faktisk ventet på Kim og Anniken var
 * 22 stemme-utkast og 8 P0-helsetråder hos Raphael. Funksjonen beholder navnet
 * sitt, men teksten under påstår ikke lenger at et menneske må svare.
 */
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
 * Den ene setningen oeverst. Den skal si noe SANT om dagen, ikke noe stort.
 *
 * Rekkefoelgen er bevisst: nattens funn er det ferskeste vi vet om, og de
 * kommer fra agenter som faktisk har kjort. Agentkoeen nevnes som nummer to,
 * som en tilstand — ikke som en oppgave til et menneske.
 *
 * Det vi ennå IKKE har en kilde for, og derfor ikke sier noe om: hva som venter
 * på et ja/nei fra Kim og Anniken (22 stemme-utkast, 8 P0-helsetråder). Se
 * `prosjekter/detox.no/open/koblingskart-2026-09-17.md` i Brain.
 */
export function lede(koe: Koen, natt: NattensFunn): string {
  const iKoe = koe.antall > 0 ? ` ${koe.antall} oppdrag står i kø.` : ""
  if (natt.funn.length > 0) {
    return `Agentene la fra seg ${natt.funn.length} funn i natt.${iKoe}`
  }
  if (koe.antall > 0) {
    return `${koe.antall} oppdrag står i kø hos agentene.`
  }
  return "Stille natt, og ingenting i kø."
}
