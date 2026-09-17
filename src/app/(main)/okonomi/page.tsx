// Økonomi.
//
// Fram til 2026-09-17 var denne siden 100 % oppdiktet: tre banksaldoer med
// maskerte kontonumre, MVA-status med beløp og forfallsdato, ti transaksjoner,
// tre ubetalte fakturaer med leverandørnavn, og en månedsoppsummering — alt
// hardkodet, under en undertittel som sa «Fiken-integrasjon».
//
// Det bryter prosjektets egen regel (SS4: «Mock eller seed-data skal aldri
// presenteres som live virkelighet»), og det er verre her enn andre steder:
// noen kan handle på et MVA-beløp eller en forfallsdato. Et oppdiktet tall i et
// regnskapsbilde er ikke en fillerygg — det er feil informasjon til en eier.
//
// Siden står nå tom med navngitte grunner. Den viser formen på det som skal
// komme, og hva hver del venter på.

export const dynamic = "force-dynamic"

type Mangler = {
  navn: string
  hva: string
  venter: string
  krever: "beslutning" | "nøkkel" | "bygging"
}

const MANGLER: Mangler[] = [
  {
    navn: "Bankkontoer",
    hva: "Saldo per konto.",
    venter: "Ingen bankkobling finnes. Fiken har API for bankavstemming, men abonnement og nøkkel er ikke på plass.",
    krever: "nøkkel",
  },
  {
    navn: "MVA-status",
    hva: "Termin, utgående og inngående MVA, til betaling, frist.",
    venter:
      "Hentes fra regnskapet. Fram til nå sto det oppdiktede beløp og en oppdiktet frist her — det er den farligste sorten feil på denne siden.",
    krever: "nøkkel",
  },
  {
    navn: "Transaksjoner",
    hva: "Siste bevegelser med kategori.",
    venter: "Kommer fra samme kilde som MVA-status. Ingen kilde er koblet til.",
    krever: "nøkkel",
  },
  {
    navn: "Ubetalte fakturaer",
    hva: "Leverandør, beløp, forfall.",
    venter:
      "Krever en regnskapskilde. Leverandørfakturaene finnes i dag som e-post og bilag, ikke som data.",
    krever: "bygging",
  },
  {
    navn: "Månedstall",
    hva: "Omsetning, utgifter, resultat, margin.",
    venter:
      "Omsetning finnes allerede i Shopify og vises på Butikken. Utgifter gjør ikke det. Tallene her må derfor vente til regnskapskilden er valgt.",
    krever: "beslutning",
  },
]

const KREVER_TEKST: Record<Mangler["krever"], string> = {
  beslutning: "Venter på en beslutning",
  nøkkel: "Venter på en nøkkel",
  bygging: "Ikke bygget ennå",
}

export default function OkonomiPage() {
  return (
    <>
      <div>
        <h1 className="text-lg font-semibold text-gray-900 sm:text-xl dark:text-gray-50">
          Økonomi
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Ikke koblet til noen regnskapskilde
        </p>
      </div>

      <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/40">
        <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
          Denne siden viste tidligere oppdiktede tall
        </p>
        <p className="mt-1 text-sm text-amber-800 dark:text-amber-300/90">
          Banksaldoer, MVA-beløp med forfallsdato, transaksjoner og
          månedsresultat var hardkodet i koden og så ekte ut. De er fjernet. Et
          oppdiktet MVA-beløp eller en oppdiktet frist er ikke en fillerygg — det
          er feil informasjon til en eier, og noen kan handle på den.
        </p>
        <p className="mt-3 text-sm text-amber-800 dark:text-amber-300/90">
          Det som trengs for å fylle siden er ett vedtak: hvilken kilde skal
          regnskapet leses fra (Fiken, regnskapsfører, eller manuelt ført i
          Supabase). Inntil det er tatt, står siden tom med grunner — ikke med
          tall.
        </p>
      </div>

      <section className="mt-8">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
          Hva som mangler, og hvorfor
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {MANGLER.map((m) => (
            <div
              key={m.navn}
              className="flex flex-col rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-50">
                  {m.navn}
                </p>
                <span className="shrink-0 rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 ring-1 ring-inset ring-gray-200 dark:bg-gray-800/60 dark:text-gray-400 dark:ring-gray-700">
                  {KREVER_TEKST[m.krever]}
                </span>
              </div>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                {m.hva}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                {m.venter}
              </p>
            </div>
          ))}
        </div>
      </section>

      <p className="mt-8 text-xs text-gray-500 dark:text-gray-400">
        Kilde til sannheten for økonomi er bilagene og regnskapet, ikke dette
        dashbordet. Inntil en kilde er koblet til, er denne siden en oversikt
        over hva som mangler — ikke en oversikt over penger.
      </p>
    </>
  )
}
