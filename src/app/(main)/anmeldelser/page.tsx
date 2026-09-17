// Anmeldelser.
//
// Fram til 2026-09-17 var denne siden oppdiktet i sin helhet, under en
// undertittel som sa «Trustpilot-anmeldelser»: snittkarakter 4,82, 651
// anmeldelser, stjernefordeling, «mest nevnte produkter» med antall omtaler, og
// åtte anmeldelser med navn, tittel og fritekst.
//
// Det er den alvorligste varianten av mock i dette dashbordet: oppdiktede
// PERSONER med oppdiktede kundeuttalelser. «Anders T.» skrev aldri at «TUDCA
// reddet magen min». Ingen anmeldelse er koblet til, fordi ingen kilde er
// koblet til — og i et eier-verktøy er en falsk kundeuttalelse noe noen kan
// komme til å tro på, svare på, eller publisere videre.
//
// Siden står nå tom med navngitte grunner.

export const dynamic = "force-dynamic"

type Mangler = {
  navn: string
  hva: string
  venter: string
  status: "kobles til" | "venter på beslutning" | "ikke bygget"
}

const MANGLER: Mangler[] = [
  {
    navn: "Karakter og antall",
    hva: "Gjennomsnitt, totalt antall, utvikling måned for måned.",
    venter:
      "Ingen anmeldelseskilde er koblet til. Trustpilot har API, men nøkkel og abonnement er ikke vurdert.",
    status: "venter på beslutning",
  },
  {
    navn: "Stjernefordeling",
    hva: "Hvor mange 5-, 4-, 3-, 2- og 1-stjerners.",
    venter: "Kommer fra samme kilde som karakteren.",
    status: "kobles til",
  },
  {
    navn: "Svarprosent",
    hva: "Andel anmeldelser som har fått svar.",
    venter:
      "Trustpilot har ikke et åpent API for svarstatus. Kan hentes ved å lese svarene fra butikkens e-post i stedet — samme vei Raphael bruker for kundeservice.",
    status: "ikke bygget",
  },
  {
    navn: "Siste anmeldelser",
    hva: "Personer, tekst, karakter, besvart eller ikke.",
    venter:
      "Her sto det tidligere åtte oppdiktede personer med oppdiktede sitater. Ekte anmeldelser er personopplysninger og skal hentes fra kilden, aldri diktets opp.",
    status: "kobles til",
  },
  {
    navn: "Mest nevnte produkter",
    hva: "Hvilke produkter kundene skriver om.",
    venter:
      "Krever at anmeldelsesteksten er tilgjengelig og kan leses maskinelt. Ingen slik kilde finnes i dag.",
    status: "ikke bygget",
  },
]

const STATUS_STIL: Record<Mangler["status"], string> = {
  "kobles til": "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  "venter på beslutning":
    "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  "ikke bygget":
    "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
}

export default function AnmeldelserPage() {
  return (
    <>
      <div>
        <h1 className="text-lg font-semibold text-gray-900 sm:text-xl dark:text-gray-50">
          Anmeldelser
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Ikke koblet til noen anmeldelseskilde
        </p>
      </div>

      <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/40">
        <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
          Denne siden viste oppdiktede kunder
        </p>
        <p className="mt-1 text-sm text-amber-800 dark:text-amber-300/90">
          Åtte anmeldelser med navn, sitat og karakter var hardkodet i koden, og
          så ekte ut. Ingen av dem er skrevet av en kunde. Alt er fjernet. Ekte
          anmeldelser er personopplysninger og skal komme fra kilden — de skal
          aldri diktes opp, heller ikke som fyll i et grensesnitt.
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
                <span
                  className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_STIL[m.status]}`}
                >
                  {m.status}
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
        Kilde til sannheten for anmeldelser er anmeldelsesplattformen selv, ikke
        dette dashbordet.
      </p>
    </>
  )
}
