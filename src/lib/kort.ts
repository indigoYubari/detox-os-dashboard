// Rene regler for kortene i den nye flaten. Ingen Next-, React- eller
// Supabase-import, slik at sidene, server actions og tester deler samme ord.
//
// To slags kort, med hvert sitt språk mot eierne:
//   - Kim-kort (kim_cards, migrasjon 0010): Indigos oppsummering av én story —
//     hva vi kan si og hva vi aldri sier. Et ja fra eieren tar kortet i bruk;
//     da svarer DetoxGPT og agentene fra det. Ingenting publiseres av et ja.
//   - Idékort (notes, type=ide, project indigo-copilot): én innholdsidé fra
//     Indigo, med claims-lys og Notion-lenke. Eieren kan be Anakin lage utkast.
//
// Ordene her er de eierne ser. «Aktiver kortet» sa ingenting; «ta kortet i
// bruk» sier hva som skjer.

import { ANAKIN_AGENT_ID, clipText } from "./eiere"

// ── Kim-kort ────────────────────────────────────────────────────────────────

export const KIM_KORT_KOE = "kim-kort"

export function kortSti(id: string): string {
  return `/kort/${id}`
}

/** Status slik en eier leser den. */
export function statusTekst(status: string): string {
  if (status === "active") return "I bruk"
  if (status === "draft") return "Venter på ja fra deg"
  if (status === "superseded") return "Erstattet av en nyere versjon"
  return status
}

/** Hva et ja betyr — står ved knappen, ikke bak et klikk. */
export const JA_BETYR =
  "Sier du ja, kan DetoxGPT og agentene bruke det som står under «Dette kan vi si». " +
  "Ingenting publiseres. Sier du «ikke ennå», blir kortet liggende som utkast."

export type Kanal = { navn: string; tekst: string }

export type KortSeksjon = {
  key: string
  /** Kort etikett i venstre kolonne. */
  merkelapp: string
  /** Full overskrift, brukes der det er plass. */
  overskrift: string
  tekst?: string
  punkter?: string[]
  kanaler?: Kanal[]
}

const KANAL_NAVN: Record<string, string> = {
  portal: "På nettsiden",
  reels: "I en reel",
  mail: "I en e-post",
}

/** Kortene skrives i markdown; stjernene skal ikke leses av et menneske. */
export function utenMarkdown(t: string): string {
  return t.replace(/\*\*(.+?)\*\*/g, "$1").replace(/(^|[\s(«])\*(?!\s)(.+?)\*(?=[\s).,;:!?»]|$)/g, "$1$2")
}

function str(v: unknown): string {
  return typeof v === "string" ? utenMarkdown(v.replace(/\s+/g, " ").trim()) : ""
}

function liste(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(str).filter((s) => s.length > 0)
  const s = str(v)
  return s ? [s] : []
}

/**
 * Kortets seksjoner i den rekkefølgen en eier bør lese dem: først hva det
 * betyr, så hva vi kan si, så hva vi aldri sier. Kildene sist — kortet sier
 * selv «ikke les først». Tomme seksjoner vises ikke.
 */
export function kortSeksjoner(body: unknown): KortSeksjon[] {
  if (!body || typeof body !== "object") return []
  const b = body as Record<string, unknown>
  const ut: KortSeksjon[] = []

  const betyr = str(b.betydning_for_detox)
  if (betyr)
    ut.push({ key: "betyr", merkelapp: "Betyr", overskrift: "Hva dette betyr for Detox", tekst: betyr })

  const kanSi = b.kan_si
  const kanaler: Kanal[] = []
  if (kanSi && typeof kanSi === "object") {
    for (const k of ["portal", "reels", "mail"]) {
      const t = str((kanSi as Record<string, unknown>)[k])
      if (t) kanaler.push({ navn: KANAL_NAVN[k], tekst: t })
    }
  } else if (str(kanSi)) {
    kanaler.push({ navn: "Slik", tekst: str(kanSi) })
  }
  if (kanaler.length > 0)
    ut.push({ key: "kan_si", merkelapp: "Kan si", overskrift: "Dette kan vi si", kanaler })

  const aldri = liste(b.aldri_si)
  if (aldri.length > 0)
    ut.push({ key: "aldri_si", merkelapp: "Aldri", overskrift: "Dette sier vi aldri", punkter: aldri })

  const produkt = str(b.produkt)
  if (produkt)
    ut.push({ key: "produkt", merkelapp: "Produkt", overskrift: "Produktet", tekst: produkt })

  const iDag = str(b.gjor_i_dag)
  if (iDag)
    ut.push({ key: "gjor_i_dag", merkelapp: "Vinkel", overskrift: "Vinkelen — gjør dette i dag", tekst: iDag })

  const dor = str(b.dor_naar)
  if (dor)
    ut.push({ key: "dor_naar", merkelapp: "Utløper", overskrift: "Når kortet ikke gjelder lenger", tekst: dor })

  const kilder = liste(b.kilde)
  if (kilder.length > 0)
    ut.push({ key: "kilde", merkelapp: "Kilder", overskrift: "Kildene (les til slutt)", punkter: kilder })

  return ut
}

/** Vinkelen: det kortet ber oss gjøre i dag. Faller tilbake på hva det betyr. */
export function vinkelAv(body: unknown): string {
  if (!body || typeof body !== "object") return ""
  const b = body as Record<string, unknown>
  return str(b.gjor_i_dag) || str(b.betydning_for_detox)
}

/** Lenke til kortets kilde i ICM-repoet. null når vi ikke vet hvor. */
export function kildeLenke(repo: string | null, path: string | null): string | null {
  if (!repo || !path || !/^[\w.-]+\/[\w.-]+$/.test(repo)) return null
  return `https://github.com/${repo}/blob/main/${path.replace(/^\/+/, "")}`
}

// ── Idékort fra Indigo (notes) ──────────────────────────────────────────────

export const IDE_PROJECT = "indigo-copilot"
export const IDE_TAG = "agent:indigobot"

export type IdeRad = {
  id: string
  title: string
  excerpt: string
  type: string
  tags: string[] | null
  project: string | null
  updated: string | null
  pinned: boolean | null
}

export type Lys = "gronn" | "gul" | "rod"

export function erIde(r: Pick<IdeRad, "type" | "project" | "tags">): boolean {
  if (r.type !== "ide") return false
  return r.project === IDE_PROJECT || (r.tags ?? []).includes(IDE_TAG)
}

export function lysAv(tags: readonly string[] | null | undefined): Lys | null {
  for (const t of tags ?? []) {
    if (t === "lys:gronn" || t === "lys:gul" || t === "lys:rod") return t.slice(4) as Lys
  }
  return null
}

/** Lyset forklart, ikke bare farget. */
export function lysTekst(lys: Lys | null): string {
  if (lys === "gronn") return "🟢 Grønt — kan brukes som det står"
  if (lys === "gul") return "🟡 Gult — må omformuleres eller sjekkes først"
  if (lys === "rod") return "🔴 Rødt — inneholder noe vi ikke kan si"
  return "Uten lys — ikke sjekket ennå"
}

export function merkeAv(tags: readonly string[] | null | undefined): string | null {
  for (const t of tags ?? []) {
    if (t === "merke:detox") return "Detox"
    if (t === "merke:yubari") return "Indigo Yubari"
  }
  return null
}

export function temaAv(tags: readonly string[] | null | undefined): string | null {
  for (const t of tags ?? []) if (t.startsWith("tema:")) return t.slice(5)
  return null
}

export type IdeDeler = {
  notion: string | null
  /** Vinkelen — den ene setningen etter lenken. */
  setning: string
  claims: string | null
  /** Navngitte røde setninger. */
  rode: string[]
}

const NOTION_RE = /^https:\/\/(?:www\.)?[a-z0-9-]*\.?notion\.(?:so|site)\/\S+$/i

/** Idékortets excerpt etter avtalen i indigo-pilot: Notion-URL, setning, claims-linje, røde. */
export function ideDeler(excerpt: string | null | undefined): IdeDeler {
  const linjer = (excerpt ?? "").split("\n").map((l) => l.trim())
  let notion: string | null = null
  let claims: string | null = null
  const rode: string[] = []
  const rest: string[] = []
  for (const l of linjer) {
    if (!l) continue
    if (!notion && NOTION_RE.test(l)) notion = l
    else if (l.toLowerCase().startsWith("claims:")) claims = l.slice(7).trim()
    else if (l.startsWith("🔴")) rode.push(l.slice(2).trim())
    else rest.push(l)
  }
  return { notion, setning: rest[0] ?? "", claims, rode }
}

// ── Bestilling til Anakin ───────────────────────────────────────────────────
// Skrives til `requests` som på /eiere: første linje er hodet (samme form som
// BODY_HEAD_RE der), og hodet må inneholde agent-anakinbot fordi Anakins
// webhook filtrerer på body. Ingen skjema-endring.

export const BESTILLING_TYPE = "lag_innhold"

export type Bestilling =
  | { slag: "kort"; id: string; story: string; title: string; vinkel: string }
  | { slag: "ide"; id: string; title: string; notion: string | null; setning: string; claims: string | null }

export function bestillingRef(b: Pick<Bestilling, "slag" | "id">): string {
  return `${b.slag === "kort" ? "kim_cards" : "notes"}/${b.id}`
}

export function bestillingHode(b: Pick<Bestilling, "slag" | "id">): string {
  return `[${BESTILLING_TYPE}] til: ${ANAKIN_AGENT_ID} · ref ${bestillingRef(b)}`
}

export function bestillingBody(b: Bestilling, requestedBy: string): string {
  const linjer = [bestillingHode(b)]
  if (b.slag === "kort") {
    linjer.push(
      "Lag utkast til innhold fra dette kortet, i Detox' stemme. Bruk bare det som står under «Dette kan vi si», og aldri noe fra «Dette sier vi aldri». Kun utkast — publiser ingenting.",
      `Kort: «${clipText(b.title)}» (story ${b.story}).`,
    )
    if (b.vinkel) linjer.push(`Vinkelen: «${clipText(b.vinkel, 400)}»`)
  } else {
    linjer.push(
      "Lag utkast til innhold fra denne idéen fra Indigo. Følg claims-lyset: gult må omformuleres, rødt fjernes. Kun utkast — publiser ingenting.",
      `kort:${b.id} — «${clipText(b.title)}»`,
    )
    if (b.setning) linjer.push(`Vinkelen: «${clipText(b.setning, 400)}»`)
    if (b.claims) linjer.push(`claims: ${b.claims}`)
    if (b.notion) linjer.push(`Notion: ${b.notion}`)
  }
  linjer.push(`Bestilt fra detox-os-dashboard av ${requestedBy}.`)
  return linjer.join("\n")
}

export const KORT_UUID_RE = /^[0-9a-f-]{36}$/i
/** notes.id er tekst: uuid fra seed, eller gpt-detox-<dato>-<8 hex> fra detox_actions. */
export const NOTE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{3,79}$/
