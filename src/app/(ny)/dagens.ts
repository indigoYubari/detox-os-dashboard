// Rene hjelpere for «Dagens»-siden. Ingen Supabase-, Next- eller React-import,
// slik at reglene under kan testes uten aa rendre noe.
//
// Siden er en leseflate for Kim og Anniken. Den skal svare paa fire ting for
// GAARSDAGEN og NATTEN, og hvert svar skal kunne leses paa én linje. Alt som
// ikke er et svar hoerer bak «Se detaljer».

import type { FindingRow } from "@/lib/radar"
import type { RequestRow } from "@/lib/eiere"
import { utenMarkdown } from "@/lib/kort"
import type { KortRad } from "@/lib/kunnskap-server"
import type { RaadRad } from "@/lib/raad-server"
import type { RunStateRad } from "@/lib/system-server"

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

// ── Det som venter på et menneske ───────────────────────────────────────────

export type Venter = {
  totalt: number
  eldsteAlder: string | null
}

/**
 * Summen av EIERNES køer — `koer` (migrasjon 0009), skrevet av hub-jobben.
 *
 * Dette er den eneste kilden i denne filen som betyr «noe venter på Kim og
 * Anniken». Fram til 2026-09-17 ble `requests` brukt til det, og det var feil:
 * den er agentenes arbeidskø. Er `koer` ikke koblet til ennå, er totalt 0 — og
 * da sier leden ikke at noe venter.
 */
export function venter(
  koer: readonly { antall: number; eldste: string | null }[],
  naa: Date,
): Venter {
  const totalt = koer.reduce((sum, k) => sum + k.antall, 0)
  const tidligste = koer
    .map((k) => k.eldste)
    .filter((x): x is string => Boolean(x))
    .sort()[0]
  return {
    totalt,
    eldsteAlder: tidligste ? varighet(tidligste, naa) : null,
  }
}

// ── Leden ───────────────────────────────────────────────────────────────────

/**
 * Den ene setningen oeverst. Den skal si noe SANT om dagen, ikke noe stort.
 *
 * Rekkefoelgen er bevisst: det som venter paa et menneske gaar foran alt annet,
 * fordi det er det eneste noen kan bestemme noe om. Deretter natten, som er det
 * ferskeste vi vet om, og til slutt agentkoeen — som en tilstand, ikke som en
 * oppgave.
 *
 * «Venter på et ja eller nei» er lov å si nå, men bare fordi `koer` faktisk
 * teller eiernes køer. Den setningen stod her tidligere og telte feil ting.
 */
export function lede(v: Venter, koe: Koen, natt: NattensFunn): string {
  if (v.totalt > 0) {
    const alder = v.eldsteAlder
      ? ` Den eldste har ventet ${v.eldsteAlder}.`
      : ""
    return `${v.totalt} ting venter på et ja eller nei fra dere.${alder}`
  }
  const iKoe = koe.antall > 0 ? ` ${koe.antall} oppdrag står i kø.` : ""
  if (natt.funn.length > 0) {
    return `Ingenting venter på dere. Agentene la fra seg ${natt.funn.length} funn i natt.${iKoe}`
  }
  if (koe.antall > 0) {
    return `Ingenting venter på dere. ${koe.antall} oppdrag står i kø hos agentene.`
  }
  return "Stille natt, og ingenting i kø."
}

// ── Annonse-raadene ─────────────────────────────────────────────────────────

export type Alvor = "critical" | "warning" | "info"

export type Raad = {
  id: string
  tittel: string
  /** Kort kanalnavn, passer i merkelapp-kolonnen: «Google», «Meta», «Klaviyo». */
  kanal: string
  alvor: Alvor
  created_at: string
}

/** Hvor mange raad forsiden viser. Resten finnes i basen — de er ikke borte, de er ikke oeverst. */
export const RAAD_TOPP = 3

const ALVOR_RANG: Record<Alvor, number> = { critical: 0, warning: 1, info: 2 }

const KANAL_NAVN: Record<string, string> = {
  "google-ads": "Google",
  meta: "Meta",
  klaviyo: "Klaviyo",
  samlet: "Samlet",
}

/** «ads.update_suppression_list.warning» → «warning». Alvoret bor sist i kind; ukjent = info. */
export function raadAlvor(kind: string): Alvor {
  const s = kind.slice(kind.lastIndexOf(".") + 1)
  return s === "critical" || s === "warning" ? s : "info"
}

/** Posteren legger ad-agentens id bakerst i action («… [ad-agent #1506]»). Det er sporing, ikke tekst. */
export function raadTittel(action: string): string {
  return action.replace(/\s*\[ad-agent #[^\]]+\]\s*$/, "").trim()
}

/** «ads-funn:google-ads» → «Google». Kanalen bor i report_type, ikke i kind. */
export function raadKanal(reportType: string | null | undefined): string {
  if (!reportType) return "Annonser"
  const i = reportType.indexOf(":")
  const slug = i > 0 ? reportType.slice(i + 1) : reportType
  return KANAL_NAVN[slug] ?? slug
}

/**
 * De faa raadene som er verdt et menneske: alvorligst foerst, deretter nyest.
 * 82 ventende raad skal aldri staa paa forsiden — tre skal.
 */
export function raadTopp(rows: readonly RaadRad[], n: number = RAAD_TOPP): Raad[] {
  return rows
    .map((r) => ({
      id: r.id,
      tittel: raadTittel(r.action),
      kanal: raadKanal(r.report.report_type),
      alvor: raadAlvor(r.kind),
      created_at: r.created_at,
    }))
    .sort(
      (a, b) =>
        ALVOR_RANG[a.alvor] - ALVOR_RANG[b.alvor] ||
        b.created_at.localeCompare(a.created_at),
    )
    .slice(0, n)
}

// ── Kortene ─────────────────────────────────────────────────────────────────

export type KortVisning = {
  id: string
  story: string
  title: string
  status: string
  utdrag: string
  updated_at: string
}

export type KortStatus = {
  aktive: number
  utkast: number
  /** Nyeste updated_at over alle kort — grunnlag for «sist synket». */
  nyeste: string | null
  /** Aktive foerst, saa utkast; nyeste foerst innenfor hver gruppe. Superseded vises ikke. */
  kort: KortVisning[]
}

/** Foerste setningene av «betydning for Detox» — det kortet egentlig sier. */
export function kortUtdrag(body: unknown, maks: number = 120): string {
  if (!body || typeof body !== "object") return ""
  const v = (body as Record<string, unknown>).betydning_for_detox
  if (typeof v !== "string") return ""
  const t = utenMarkdown(v.replace(/\s+/g, " ").trim())
  return t.length > maks ? `${t.slice(0, maks - 1).trimEnd()}…` : t
}

/** Kutt en tekstrute til `maks` tegn, paa ordgrense, med «…». For ledetraader. */
export function klipp(tekst: string, maks: number = 120): string {
  const t = tekst.replace(/\s+/g, " ").trim()
  if (t.length <= maks) return t
  let ende = maks - 1
  const mellomrom = t.lastIndexOf(" ", ende)
  if (mellomrom > maks * 0.6) ende = mellomrom
  return `${t.slice(0, ende).trimEnd()}…`
}

function kortRang(status: string): number {
  return status === "active" ? 0 : status === "draft" ? 1 : 2
}

export function kortStatus(rows: readonly KortRad[]): KortStatus {
  const synlige = rows.filter((r) => r.status !== "superseded")
  const kort = [...synlige]
    .sort(
      (a, b) =>
        kortRang(a.status) - kortRang(b.status) ||
        b.updated_at.localeCompare(a.updated_at),
    )
    .map((r) => ({
      id: r.id,
      story: r.story,
      title: r.title,
      status: r.status,
      utdrag: kortUtdrag(r.body),
      updated_at: r.updated_at,
    }))
  const tider = rows.map((r) => r.updated_at).sort()
  return {
    aktive: synlige.filter((r) => r.status === "active").length,
    utkast: synlige.filter((r) => r.status === "draft").length,
    nyeste: tider.length > 0 ? tider[tider.length - 1] : null,
    kort,
  }
}

// ── Systemet ────────────────────────────────────────────────────────────────

/**
 * En agent som ikke har kjoert paa saa mange timer, er stille. Nattjobbene gaar
 * én gang i doegnet; 30 timer gir rom for at en kjoering er sen uten at siden
 * roper.
 */
export const STILLE_TIMER = 30

const AGENT_NAVN: Record<string, string> = {
  "agent-indigobot": "IndigoBot",
  "agent-anakinbot": "Anakin",
  "agent-ads": "Annonsemotoren",
}

export type SystemLinje = {
  navn: string
  alder: string | null
  ok: boolean
  feil: string | null
}

export type SystemStatus = {
  linjer: SystemLinje[]
  /** Navnene paa agentene som ikke har kjoert vellykket innenfor STILLE_TIMER. */
  stille: string[]
}

export function systemStatus(
  rows: readonly RunStateRad[],
  naa: Date,
  maksTimer: number = STILLE_TIMER,
): SystemStatus {
  const grense = naa.getTime() - maksTimer * 3_600_000
  const linjer = rows.map((r) => {
    const t = r.last_successful_run
      ? new Date(r.last_successful_run).getTime()
      : Number.NaN
    const fersk = !Number.isNaN(t) && t >= grense
    const status = r.last_run_status ?? "ok"
    return {
      navn: AGENT_NAVN[r.agent_id] ?? r.agent_id,
      alder: r.last_successful_run ? varighet(r.last_successful_run, naa) : null,
      ok: fersk && status === "ok",
      feil: status !== "ok" ? (r.last_error ?? status) : null,
    }
  })
  return { linjer, stille: linjer.filter((l) => !l.ok).map((l) => l.navn) }
}

// ── Kundeservice ────────────────────────────────────────────────────────────

/**
 * Raphaels pass gaar hver natt klokka 03:00 UTC og skriver koe-raden naar det
 * er ferdig. Er raden eldre enn maksTimer, er tallet fra et tidligere pass —
 * og det skal siden si, ikke late som det er dagens.
 */
export function koeFersk(
  oppdatert: string | null | undefined,
  naa: Date,
  maksTimer: number = STILLE_TIMER,
): boolean {
  const h = timerSiden(oppdatert, naa)
  return h !== null && h < maksTimer
}
