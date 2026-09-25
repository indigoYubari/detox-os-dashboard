// Rene typer og regler for eiernes kø-poster (tabell koe_poster, migrasjon 0011).
// Ingen Next/Supabase-importer, slik at siden, server action og tester deler
// samme regler.
//
// En post er én ting et menneske skal ta stilling til: et kort som kan
// aktiveres, et råd som kan godkjennes, en tråd som skal håndteres. Hub-jobbene
// skriver postene; eierne setter status; hub-jobbene utfører og kvitterer.

export type Eier = "indigo" | "anniken" | "begge"
export type Handling = "ja-nei" | "gjort"
export type PostStatus = "venter" | "ja" | "nei" | "gjort" | "utgatt"
export type Beslutning = "ja" | "nei" | "gjort"

export type KoePost = {
  id: string
  koe_id: string
  ekstern_id: string
  tittel: string
  detalj: string | null
  lenke: string | null
  prioritet: number
  eier: Eier
  handling: Handling
  status: PostStatus
  avgjort_av: string | null
  avgjort_at: string | null
  utfort_av: string | null
  utfort_at: string | null
  kilde: string
  opprettet: string
  oppdatert: string
}

export const POST_COLUMNS =
  "id, koe_id, ekstern_id, tittel, detalj, lenke, prioritet, eier, handling, status, avgjort_av, avgjort_at, utfort_av, utfort_at, kilde, opprettet, oppdatert"

/** Køene i den rekkefølgen de vises. Ukjente køer kommer etter, alfabetisk. */
export const KOE_REKKEFOLGE = [
  "kundeservice",
  "stemme-utkast",
  "kim-kort",
  "produkt-kandidater",
  "annonse-raad",
] as const

export const KOE_NAVN: Record<string, string> = {
  kundeservice: "Kundeservice",
  "stemme-utkast": "Stemme-utkast",
  "kim-kort": "Kort som venter på ja fra deg",
  "produkt-kandidater": "Guider som venter på ja",
  "annonse-raad": "Annonse-råd",
}

/** Hva et ja og et nei betyr, per kø — teksten på knappene. */
export const JA_TEKST: Record<string, string> = {
  "kim-kort": "Ja, ta kortet i bruk",
  "produkt-kandidater": "Ja, lag utkast",
  "annonse-raad": "Godkjenn",
}
export const NEI_TEKST: Record<string, string> = {
  "kim-kort": "Ikke ennå",
  "produkt-kandidater": "Ikke nå",
  "annonse-raad": "Avvis",
}

/**
 * Én linje under kø-overskriften som sier hva et ja gjør. Ingen linje = ingen
 * forklaring nødvendig. Tekstene bygger på det basen faktisk viser (kilde og
 * utfort_av på postene), ikke på antakelser:
 * - produkt-kandidater skrives av `demandscan`, og et ja utføres av `demandscan-draft`.
 * - annonse-raad skrives av post_ads_report hver natt; ventende poster som ikke
 *   lenger er i toppen av rapporten settes til `utgatt`.
 */
export const KOE_HJELP: Record<string, string> = {
  "kim-kort":
    "Et kort er Indigos oppsummering av én story: hva vi kan si, og hva vi aldri sier. " +
    "Sier du ja, kan DetoxGPT og agentene bruke det. Ingenting publiseres. Les kortet før du svarer.",
  "produkt-kandidater":
    "Etterspørselsskanningen fant temaer kundene spør etter, med antall funn bak hvert. " +
    "Sier du ja, lages det et utkast til guiden. Ingenting publiseres.",
  "annonse-raad":
    "Et ja sender rådet videre til annonsemotoren. Ingenting endres i annonsene uten det. " +
    "Rådene byttes ut hver natt: det som ikke er svart på før neste rapport, kan utgå.",
}

// ── Alder og kvittering ────────────────────────────────────────────────────
// Basen har ingen utløpsdato per post, og vi lager ingen. Det vi kan si sant
// er hvor lenge en post har ventet, hvor mange som utgikk ubesvart, og om
// huben faktisk utførte det eieren avgjorde (utfort_av/utfort_at).

/** Etter så mange dager sier siden fra om at en post har ventet lenge. */
export const VENTET_LENGE_DAGER = 7

/** Etter så mange timer uten utfort_at sier siden fra om at huben ikke har utført avgjørelsen. */
export const UTFORT_SENT_TIMER = 24

export function dagerVentet(post: Pick<KoePost, "opprettet">, naa: Date): number {
  const t = new Date(post.opprettet).getTime()
  if (Number.isNaN(t)) return 0
  return Math.max(0, Math.floor((naa.getTime() - t) / 86_400_000))
}

export function venterLenge(post: Pick<KoePost, "opprettet">, naa: Date): boolean {
  return dagerVentet(post, naa) >= VENTET_LENGE_DAGER
}

/** «har ventet 8 dager» — bare når det er verdt å si (≥ 1 dag). */
export function ventetTekst(post: Pick<KoePost, "opprettet">, naa: Date): string | null {
  const d = dagerVentet(post, naa)
  if (d < 1) return null
  return `har ventet ${d} ${d === 1 ? "dag" : "dager"}`
}

export const BESLUTNING_TEKST: Record<string, string> = {
  ja: "ja",
  nei: "nei",
  gjort: "gjort",
}

export type Kvittering = {
  /** «Du sa ja for 3 dager siden.» */
  avgjort: string
  /** «Utført av demandscan-draft dagen etter.» / «Ikke utført ennå.» */
  utfort: string
  /** true når avgjørelsen er eldre enn UTFORT_SENT_TIMER og fortsatt ikke utført. */
  sent: boolean
}

function timerMellom(a: string, b: string): number | null {
  const ta = new Date(a).getTime()
  const tb = new Date(b).getTime()
  if (Number.isNaN(ta) || Number.isNaN(tb)) return null
  return (tb - ta) / 3_600_000
}

function siden(iso: string, naa: Date): string {
  const h = timerMellom(iso, naa.toISOString())
  if (h === null) return "ukjent"
  if (h < 1) return "under en time siden"
  if (h < 24) return `${Math.floor(h)} ${Math.floor(h) === 1 ? "time" : "timer"} siden`
  const d = Math.floor(h / 24)
  return `${d} ${d === 1 ? "dag" : "dager"} siden`
}

/**
 * Kvitteringen på en avgjort post. Sier hva eieren sa, når, og hva huben
 * gjorde med det — lest fra utfort_av/utfort_at, aldri antatt.
 */
export function kvittering(
  post: Pick<KoePost, "status" | "avgjort_at" | "utfort_av" | "utfort_at">,
  naa: Date,
): Kvittering {
  const hva = BESLUTNING_TEKST[post.status] ?? post.status
  const avgjort = post.avgjort_at
    ? `Du sa ${hva} for ${siden(post.avgjort_at, naa)}.`
    : `Avgjort: ${hva}, tidspunkt ukjent.`
  if (post.utfort_at) {
    const etter = post.avgjort_at ? timerMellom(post.avgjort_at, post.utfort_at) : null
    const naar =
      etter === null
        ? `for ${siden(post.utfort_at, naa)}`
        : etter < 1
          ? "innen en time"
          : etter < 24
            ? `etter ${Math.floor(etter)} ${Math.floor(etter) === 1 ? "time" : "timer"}`
            : `etter ${Math.floor(etter / 24)} ${Math.floor(etter / 24) === 1 ? "dag" : "dager"}`
    return {
      avgjort,
      utfort: `Utført ${naar}${post.utfort_av ? ` av ${post.utfort_av}` : ""}.`,
      sent: false,
    }
  }
  const ventetTimer = post.avgjort_at ? timerMellom(post.avgjort_at, naa.toISOString()) : null
  const sent = ventetTimer !== null && ventetTimer >= UTFORT_SENT_TIMER
  return { avgjort, utfort: "Ikke utført ennå.", sent }
}

/** Utgåtte poster per kø innenfor et vindu — det som døde uten svar. */
export function utgaattPerKoe(
  poster: readonly Pick<KoePost, "koe_id" | "status" | "oppdatert">[],
  naa: Date,
  dager: number = 7,
): Record<string, number> {
  const grense = naa.getTime() - dager * 86_400_000
  const ut: Record<string, number> = {}
  for (const p of poster) {
    if (p.status !== "utgatt") continue
    const t = new Date(p.oppdatert).getTime()
    if (Number.isNaN(t) || t < grense) continue
    ut[p.koe_id] = (ut[p.koe_id] ?? 0) + 1
  }
  return ut
}

/** Der posten kan leses i sin helhet i denne flaten. null = bare det som står i posten. */
export function lesLenke(post: Pick<KoePost, "koe_id" | "ekstern_id">): string | null {
  if (post.koe_id === "kim-kort" && /^[0-9a-f-]{36}$/i.test(post.ekstern_id)) return `/kort/${post.ekstern_id}`
  return null
}

/**
 * Køer som har et tall i `koer`, men der postene ikke skrives ennå. Jobben
 * gjøres der tallet kommer fra, og siden sier det i stedet for å vise tomt.
 */
export const UTEN_POSTER: Record<string, { tekst: string; lenke: string | null; knapp: string | null }> = {
  kundeservice: {
    tekst: "Raphael skriver tallet, ikke postene ennå. Utkastene ligger som Gmail-utkast i kontakt@, ingenting er sendt.",
    lenke: "https://mail.google.com/mail/?authuser=kontakt@detox.no#drafts",
    knapp: "Åpne kontakt@",
  },
  "stemme-utkast": {
    tekst: "Dommene settes i Notion-basene, og stemme-løkka henter dem derfra. Postene kommer hit når løkka skriver dem.",
    lenke: null,
    knapp: null,
  },
}

export type EierFilter = "alle" | "indigo" | "anniken"

export function eierFilter(v: unknown): EierFilter {
  return v === "indigo" || v === "anniken" ? v : "alle"
}

export function eierNavn(e: Eier): string {
  if (e === "indigo") return "Indigo"
  if (e === "anniken") return "Anniken"
  return "Indigo og Anniken"
}

/** Poster for én eier — «begge» hører til begge. «alle» filtrerer ikke. */
export function forEier(poster: readonly KoePost[], filter: EierFilter): KoePost[] {
  if (filter === "alle") return [...poster]
  return poster.filter((p) => p.eier === filter || p.eier === "begge")
}

export function erBeslutning(v: unknown): v is Beslutning {
  return v === "ja" || v === "nei" || v === "gjort"
}

/** En ja/nei-post tar ja eller nei; en gjort-post tar bare gjort. */
export function gyldigBeslutning(handling: Handling, b: Beslutning): boolean {
  return handling === "gjort" ? b === "gjort" : b !== "gjort"
}

export type KoeGruppe = { koe_id: string; navn: string; poster: KoePost[] }

function koeRang(id: string): number {
  const i = (KOE_REKKEFOLGE as readonly string[]).indexOf(id)
  return i === -1 ? KOE_REKKEFOLGE.length : i
}

/** Grupperer poster per kø i fast rekkefølge; haster først, deretter eldst først. */
export function grupper(poster: readonly KoePost[]): KoeGruppe[] {
  const perKoe = new Map<string, KoePost[]>()
  for (const p of poster) {
    const liste = perKoe.get(p.koe_id) ?? []
    liste.push(p)
    perKoe.set(p.koe_id, liste)
  }
  return Array.from(perKoe.entries())
    .sort(([a], [b]) => koeRang(a) - koeRang(b) || a.localeCompare(b))
    .map(([koe_id, liste]) => ({
      koe_id,
      navn: KOE_NAVN[koe_id] ?? koe_id,
      poster: [...liste].sort(
        (x, y) => x.prioritet - y.prioritet || x.opprettet.localeCompare(y.opprettet),
      ),
    }))
}

/** 0 = haster, 1 = viktig, 3 = kan vente. 2 er normalt og trenger ingen lapp. */
export function prioritetTekst(p: number): string | null {
  if (p <= 0) return "haster"
  if (p === 1) return "viktig"
  if (p >= 3) return "kan vente"
  return null
}

export const UUID_RE = /^[0-9a-f-]{36}$/i
