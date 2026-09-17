import Link from "next/link"

import { fetchQueue } from "@/lib/eiere-server"
import { IKKE_KOBLET_TEKST, fetchKoer, type Koe } from "@/lib/koer-server"
import { fetchKort } from "@/lib/kunnskap-server"
import { fetchAnnonseRaad } from "@/lib/raad-server"
import { DEFAULT_FILTERS, storyOf, type FindingRow } from "@/lib/radar"
import { fetchFindings } from "@/lib/radar-server"
import { fetchRunState } from "@/lib/system-server"

import { AnnonserISeg } from "./AnnonserISeg"
import { ButikkISeg } from "./ButikkISeg"
import { Detaljer } from "./Detaljer"
import { EpostISeg } from "./EpostISeg"
import { Hjelp, Knapper, Linje, Liste, Seksjon, Stille, Svar } from "./Seksjon"
import {
  datoLang,
  koeFersk,
  koen,
  kortStatus,
  lede,
  nattensFunn,
  raadTopp,
  systemStatus,
  varighet,
  venter,
  type Koen,
  type KortStatus,
  type NattensFunn,
  type Raad,
  type SystemStatus,
  type Venter,
} from "./dagens"

// Server-komponent. Alt som ligger i Supabase leses her med eierens egen
// session (koeene, natten, raadene, kortene, run_state); Shopify, annonsetall
// og Klaviyo hentes av klient-oyer mot de eksisterende API-rutene. Formen er
// den samme i alle seksjonene; se Seksjon.tsx.
//
// Arkitekturen (Whatson 17.09): agentene gjoer jobben og leverer inn i
// systemet. Forsiden viser det de har levert. Kundeservice leses derfor fra
// Raphaels koe-rad — ikke fra Gmail direkte.
//
// Ingen mock, ingen fallback: hver seksjon sier selv naar den ikke fikk svar.

const TOM_KOE: Koen = { antall: 0, eldste: null, eldsteAlder: null }
const TOM_NATT: NattensFunn = { funn: [], perAgent: { anakin: 0, indigo: 0 }, siste: null }
const TOM_VENTER: Venter = { totalt: 0, eldsteAlder: null }
const TOM_KORT: KortStatus = { aktive: 0, utkast: 0, nyeste: null, kort: [] }
const TOM_SYSTEM: SystemStatus = { linjer: [], stille: [] }

/** Raphaels rad i `koer`. Han skriver den naar nattpasset er ferdig. */
const KUNDESERVICE_KOE = "kundeservice"

/** Utkastene hans ligger som Gmail-utkast i traadene i kontakt@ — aldri sendt. */
const GMAIL_UTKAST = "https://mail.google.com/mail/?authuser=kontakt@detox.no#drafts"

/**
 * «/» er forsiden. Den skal aldri svare 500. Mangler en grant, eller svarer
 * basen ikke, skal den ene seksjonen si det paa én linje — ikke hele siden bli
 * en feilskjerm. Derfor fanger vi baade det Supabase returnerer som feil og
 * det som kastes.
 */
function feilTekst(e: unknown): string {
  return e instanceof Error && e.message
    ? e.message
    : "Klarte ikke lese fra basen."
}

async function lesKoe(): Promise<{ koe: Koen; feil: string | null }> {
  try {
    const res = await fetchQueue()
    if (!res.ok) return { koe: TOM_KOE, feil: res.error }
    return { koe: koen(res.rows, new Date()), feil: null }
  } catch (e) {
    return { koe: TOM_KOE, feil: feilTekst(e) }
  }
}

async function lesNatt(): Promise<{ natt: NattensFunn; feil: string | null }> {
  try {
    const res = await fetchFindings(DEFAULT_FILTERS, 60)
    const feil = Object.values(res).find((r) => !r.ok)
    if (feil && !feil.ok) return { natt: TOM_NATT, feil: feil.error }
    const rows: FindingRow[] = Object.values(res).flatMap((r) =>
      r.ok ? r.rows : [],
    )
    return { natt: nattensFunn(rows, new Date()), feil: null }
  } catch (e) {
    return { natt: TOM_NATT, feil: feilTekst(e) }
  }
}

/**
 * Eiernes køer. Tabellen «koer» finnes først når migrasjon 0009 er kjørt OG
 * hub-jobben har skrevet én gang. Fram til da er svaret `ikke_koblet_til`, og
 * seksjonen sier det — den later ikke som køen er tom.
 */
async function lesKoer(): Promise<{ koer: Koe[]; v: Venter; feil: string | null }> {
  try {
    const res = await fetchKoer()
    if (!res.ok) {
      return {
        koer: [],
        v: TOM_VENTER,
        feil: res.code === "ikke_koblet_til" ? "ikke_koblet_til" : res.error,
      }
    }
    return { koer: res.koer, v: venter(res.koer, new Date()), feil: null }
  } catch (e) {
    return { koer: [], v: TOM_VENTER, feil: feilTekst(e) }
  }
}

async function lesRaad(): Promise<{ raad: Raad[]; feil: string | null }> {
  try {
    const res = await fetchAnnonseRaad()
    if (!res.ok) return { raad: [], feil: res.error }
    return { raad: raadTopp(res.rows), feil: null }
  } catch (e) {
    return { raad: [], feil: feilTekst(e) }
  }
}

async function lesKort(): Promise<{ kort: KortStatus; feil: string | null }> {
  try {
    const res = await fetchKort()
    if (!res.ok) return { kort: TOM_KORT, feil: res.error }
    return { kort: kortStatus(res.rows), feil: null }
  } catch (e) {
    return { kort: TOM_KORT, feil: feilTekst(e) }
  }
}

async function lesSystem(naa: Date): Promise<{ system: SystemStatus; feil: string | null }> {
  try {
    const res = await fetchRunState()
    if (!res.ok) return { system: TOM_SYSTEM, feil: res.error }
    return { system: systemStatus(res.rows, naa), feil: null }
  } catch (e) {
    return { system: TOM_SYSTEM, feil: feilTekst(e) }
  }
}

export default async function DagensSide() {
  const naa = new Date()
  const [
    { koe, feil: koeFeil },
    { natt, feil: nattFeil },
    koerRes,
    { raad, feil: raadFeil },
    { kort, feil: kortFeil },
    { system, feil: systemFeil },
  ] = await Promise.all([
    lesKoe(),
    lesNatt(),
    lesKoer(),
    lesRaad(),
    lesKort(),
    lesSystem(naa),
  ])
  const { koer, v, feil: koerFeil } = koerRes
  const kundeservice = koer.find((k) => k.id === KUNDESERVICE_KOE) ?? null

  return (
    <>
      <div className="ny-hilsen">
        <div className="ny-dato">{datoLang(naa)}</div>
        <h1 className="ny-lede">{lede(v, koe, natt)}</h1>
      </div>

      <Seksjon merkelapp="Venter på dere">
        {koerFeil === "ikke_koblet_til" ? (
          <Stille>{IKKE_KOBLET_TEKST}</Stille>
        ) : koerFeil ? (
          <Stille>
            <span className="varsel">Fikk ikke lest køene.</span> {koerFeil}
          </Stille>
        ) : v.totalt === 0 ? (
          <Svar>Ingenting venter</Svar>
        ) : (
          <>
            <Svar>
              <strong>{v.totalt}</strong> ting venter på et ja eller nei
            </Svar>
            <Hjelp>
              {v.eldsteAlder ? `Den eldste har ventet ${v.eldsteAlder}. ` : ""}
              Alt er skrevet, ingenting er sendt.
            </Hjelp>
            <Detaljer tekst="Se køene">
              <Liste>
                {koer.map((k) => (
                  <Linje key={k.id} n={k.navn}>
                    <b>{k.antall}</b>
                    {k.detalj ? ` — ${k.detalj}` : ""}
                  </Linje>
                ))}
              </Liste>
            </Detaljer>
            <Knapper>
              <Link className="ny-knapp primaer" href="/eiere">
                Gå gjennom køen
              </Link>
            </Knapper>
          </>
        )}
      </Seksjon>

      <ButikkISeg />

      <AnnonserISeg raad={raad} raadFeil={raadFeil} />

      <EpostISeg />

      <Seksjon merkelapp="Kundeservice">
        {koerFeil ? (
          <Stille>
            <span className="varsel">Fikk ikke lest Raphaels kø.</span>{" "}
            {koerFeil === "ikke_koblet_til" ? IKKE_KOBLET_TEKST : koerFeil}
          </Stille>
        ) : !kundeservice ? (
          <Stille>
            Raphael har ikke skrevet køen ennå. Passet går hver natt klokka
            03:00 UTC, og raden kommer når det er ferdig.
          </Stille>
        ) : (
          <>
            {kundeservice.antall === 0 ? (
              <Svar>Ingen tråder venter på et menneske</Svar>
            ) : (
              <Svar>
                <strong>{kundeservice.antall}</strong>{" "}
                {kundeservice.antall === 1 ? "tråd trenger" : "tråder trenger"} et
                menneske
              </Svar>
            )}
            <Hjelp>
              {koeFersk(kundeservice.oppdatert, naa) ? (
                `Raphaels pass for ${varighet(kundeservice.oppdatert, naa)} siden. `
              ) : (
                <span className="varsel">
                  Raphaels siste pass var for{" "}
                  {varighet(kundeservice.oppdatert, naa)} siden — tallet er
                  derfra.{" "}
                </span>
              )}
              Utkastene ligger som Gmail-utkast i kontakt@. Ingenting er sendt.
            </Hjelp>
            {kundeservice.detalj ? (
              <Detaljer tekst="Se passet">
                <Liste>
                  <Linje n="raphael">{kundeservice.detalj}</Linje>
                </Liste>
              </Detaljer>
            ) : null}
            <Knapper>
              <a
                className="ny-knapp"
                href={GMAIL_UTKAST}
                target="_blank"
                rel="noreferrer"
              >
                Åpne utkastene i kontakt@
              </a>
            </Knapper>
          </>
        )}
      </Seksjon>

      <Seksjon merkelapp="Agentkøen">
        {koeFeil ? (
          <Stille>
            <span className="varsel">Fikk ikke lest køen.</span> {koeFeil}
          </Stille>
        ) : koe.antall === 0 ? (
          <Svar>Ingenting står åpent</Svar>
        ) : (
          <>
            <Svar>
              <strong>{koe.antall}</strong> oppdrag står åpne
            </Svar>
            <Hjelp>
              {koe.eldsteAlder
                ? `Eldste har ligget ${koe.eldsteAlder}. `
                : ""}
              Bestillinger til agentene — ingenting dere må svare på.
            </Hjelp>
            <Knapper>
              <Link className="ny-knapp" href="/eiere">
                Åpne eiersiden
              </Link>
            </Knapper>
          </>
        )}
      </Seksjon>

      <Seksjon merkelapp="I natt">
        {nattFeil ? (
          <Stille>
            <span className="varsel">Fikk ikke lest natten.</span> {nattFeil}
          </Stille>
        ) : natt.funn.length === 0 ? (
          <Svar>Ingen funn i natt</Svar>
        ) : (
          <>
            <Svar>
              Anakin fant <strong>{natt.perAgent.anakin}</strong> ting, IndigoBot{" "}
              <strong>{natt.perAgent.indigo}</strong>
            </Svar>
            <Hjelp>
              {natt.siste
                ? `Siste funn kom for ${varighet(natt.siste, naa)} siden.`
                : ""}
            </Hjelp>
            <Detaljer tekst="Se funnene">
              <Liste>
                {natt.funn.slice(0, 5).map((f) => {
                  const story = storyOf(f.report.report_type)
                  return (
                    <Linje
                      key={f.id}
                      n={
                        f.report.agent_id === "agent-anakinbot"
                          ? "anakin"
                          : "indigobot"
                      }
                    >
                      {story ? <span className="story">{story}</span> : null}
                      {f.claim}
                    </Linje>
                  )
                })}
              </Liste>
            </Detaljer>
            <Knapper>
              <Link className="ny-knapp" href="/radar">
                Åpne radar
              </Link>
            </Knapper>
          </>
        )}
      </Seksjon>

      <Seksjon merkelapp="Kunnskapen">
        {kortFeil ? (
          <Stille>
            <span className="varsel">Fikk ikke lest kortene.</span> {kortFeil}
          </Stille>
        ) : kort.kort.length === 0 ? (
          <Stille>
            Ingen kort er synket ennå. Indigos kort ligger i ICM og synkes fra
            hub-en.
          </Stille>
        ) : (
          <>
            <Svar>
              <strong>{kort.aktive}</strong>{" "}
              {kort.aktive === 1 ? "kort er aktivt" : "kort er aktive"},{" "}
              <strong>{kort.utkast}</strong> venter på Indigo
            </Svar>
            <Hjelp>
              Ett kort per story: hva vi kan si, og hva vi aldri sier. GPT-ene
              svarer bare fra aktive kort.
              {kort.nyeste
                ? ` Sist synket for ${varighet(kort.nyeste, naa)} siden.`
                : ""}
            </Hjelp>
            <Detaljer tekst="Se kortene">
              <Liste>
                {kort.kort.map((k) => (
                  <Linje
                    key={k.id}
                    n={k.status === "active" ? "aktivt" : "utkast"}
                  >
                    <span className="story">{k.story}</span>
                    <b>{k.title}</b>
                    {k.utdrag ? ` — ${k.utdrag}` : ""}
                  </Linje>
                ))}
              </Liste>
            </Detaljer>
          </>
        )}
      </Seksjon>

      <Seksjon merkelapp="Systemet">
        {systemFeil ? (
          <Stille>
            <span className="varsel">Fikk ikke lest agentene.</span> {systemFeil}
          </Stille>
        ) : system.linjer.length === 0 ? (
          <Stille>Ingen agent har meldt inn en kjøring ennå.</Stille>
        ) : system.stille.length === 0 ? (
          <>
            <Svar>Alle agentene har kjørt siste døgn</Svar>
            <Hjelp>
              {system.linjer
                .map((l) => `${l.navn} for ${l.alder ?? "ukjent"} siden`)
                .join(" · ")}
              .
            </Hjelp>
          </>
        ) : (
          <>
            <Svar>
              <span className="varsel">{system.stille.join(" og ")}</span>{" "}
              {system.stille.length === 1 ? "har" : "har"} ikke kjørt siste døgn
            </Svar>
            <Hjelp>
              Tallene deres på denne siden er fra sist de kjørte.
            </Hjelp>
            <Detaljer tekst="Se agentene">
              <Liste>
                {system.linjer.map((l) => (
                  <Linje key={l.navn} n={l.ok ? "ok" : "stille"}>
                    {l.navn} · siste kjøring for {l.alder ?? "ukjent"} siden
                    {l.feil ? ` · ${l.feil}` : ""}
                  </Linje>
                ))}
              </Liste>
            </Detaljer>
          </>
        )}
      </Seksjon>
    </>
  )
}
