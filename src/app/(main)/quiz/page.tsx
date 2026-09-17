// Quiz-analyse.
//
// Fram til 2026-09-17 var denne siden 100 % oppdiktet, under en undertittel som
// sa «Octane AI quiz-analyse»: 2 840 fullføringer, fullføringsrate, e-postfangst,
// konverteringsrate, snittordre, quiz-omsetning, en konverteringstrakt i seks
// steg, seks målkategorier med konverteringsrate og topprodukt per kategori, og
// en tabell over spørsmåls-ytelse.
//
// Verre enn tallene: siden ga en ANBEFALING — «Spørsmål 5 har høyest frafall
// (12%) — vurder forenkling eller rekkefølge-bytte» — utledet av de oppdiktede
// tallene. Det er ikke en fillerygg i et grensesnitt; det er råd til en eier om
// å endre produktet, basert på ingenting.
//
// I tillegg: quizen er ikke bygget, og det er ikke engang vedtatt at den skal
// bygges. Grok-dokumentet 06.09 konkluderte «ingen quiz-app», og arkitekturen
// ble parkert 15. juni. PLATTFORM-SPEC-en forutsetter det motsatte. Å vise
// analyse av en quiz som ikke finnes laver tvil bort.
//
// Siden står nå tom med navngitte grunner, og sier hvem som eier vedtaket.

export const dynamic = "force-dynamic"

type Mangler = {
  navn: string
  hva: string
  venter: string
  status: "blokkert" | "ikke bygget"
}

const MANGLER: Mangler[] = [
  {
    navn: "Fullføringer og rate",
    hva: "Hvor mange starter, hvor mange fullfører.",
    venter:
      "Krever at quizen finnes og at trafikken måles. Ingen analytics-kilde er koblet til Detox OS.",
    status: "blokkert",
  },
  {
    navn: "E-postfangst",
    hva: "Andel fullførte som oppgir e-post.",
    venter:
      "Kommer fra Klaviyo når profilen faktisk settes som property. Den koblingen finnes ikke ennå.",
    status: "ikke bygget",
  },
  {
    navn: "Resultat per behovsprofil",
    hva: "Hvilke profiler folk ender i, og hva de kjøper.",
    venter:
      "De fem profilene er definert i den teoretiske setup-en, men Kim har ikke fylt produktlistene. Uten dem finnes ingen profil å måle.",
    status: "blokkert",
  },
  {
    navn: "Konverteringstrakt",
    hva: "Fra start til kjøp, steg for steg.",
    venter:
      "Forutsetter at hele flyten er bygget og instrumentert. Ingenting av den er i produksjon.",
    status: "ikke bygget",
  },
  {
    navn: "Spørsmåls-ytelse",
    hva: "Frafall og tid per spørsmål.",
    venter:
      "Siden ga tidligere en anbefaling om å endre spørsmål 5, basert på oppdiktede tall. Anbefalingen er fjernet sammen med tallene.",
    status: "ikke bygget",
  },
]

export default function QuizPage() {
  return (
    <>
      <div>
        <h1 className="text-lg font-semibold text-gray-900 sm:text-xl dark:text-gray-50">
          Quiz
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Ikke koblet til noen kilde — og ikke vedtatt bygget
        </p>
      </div>

      <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/40">
        <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
          Denne siden viste tidligere oppdiktede tall — og en anbefaling bygget på dem
        </p>
        <p className="mt-1 text-sm text-amber-800 dark:text-amber-300/90">
          Antall fullføringer, konverteringsrate, trakt og spørsmåls-ytelse var
          hardkodet. Siden konkluderte til og med med at «spørsmål 5 har høyest
          frafall — vurder forenkling». Det var råd om å endre produktet, utledet
          av tall som ikke fantes. Alt er fjernet.
        </p>
      </div>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-50">
          Det åpne vedtaket
        </p>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          Det finnes to dokumenter som sier hver sitt om quizen skal bygges nå.
          Grok-dokumentet av 06.09 konkluderte «Start-her, 5 knapper, ingen
          quiz-app», og arkitekturen ble parkert 15. juni. PLATTFORM-SPEC v0.1
          forutsetter at den bygges. Inntil det er avgjort, er denne siden en
          oversikt over hva som mangler — ikke en analyse av noe som kjører.
        </p>
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
          Eier: Adrian. Faglig innhold (profiler, produkter per nivå): Kim.
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
                  {m.status === "blokkert" ? "Blokkert" : "Ikke bygget"}
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
        Kilde til sannheten for quizen er den teoretiske setup-en og de kanoniske
        dokumentene i <code>detox-helseplattform</code>, ikke dette dashbordet.
      </p>
    </>
  )
}
