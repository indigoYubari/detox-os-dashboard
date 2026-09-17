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
  "annonse-raad",
] as const

export const KOE_NAVN: Record<string, string> = {
  kundeservice: "Kundeservice",
  "stemme-utkast": "Stemme-utkast",
  "kim-kort": "Kort til godkjenning",
  "annonse-raad": "Annonse-råd",
}

/** Hva et ja og et nei betyr, per kø — teksten på knappene. */
export const JA_TEKST: Record<string, string> = {
  "kim-kort": "Aktiver kortet",
  "annonse-raad": "Godkjenn",
}
export const NEI_TEKST: Record<string, string> = {
  "kim-kort": "Ikke ennå",
  "annonse-raad": "Avvis",
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
