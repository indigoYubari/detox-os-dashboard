"use client"

import { useEffect, useState } from "react"

import { labelFor, roasLabel, TYPE_LABEL } from "@/lib/ad-format"
import {
  ApiError,
  getCampaignHealth,
  getMetrics,
  getProposals,
  getSearchTerms,
  type CampaignHealthResponse,
  type MetricsResponse,
  type ProposalsResponse,
  type SearchTermsResponse,
} from "@/lib/detox-api"
import { butikkVindu } from "@/lib/butikk"

import { Detaljer } from "../Detaljer"
import { Hjelp, Linje, Liste, Seksjon, Stille, Svar } from "../Seksjon"
import { kr, tall, varighet } from "../dagens"
import {
  betaltHook,
  betaltMedia,
  betaltTekst,
  DAGER,
  forslag,
  forslagSvar,
  KAMPANJE_TEKST,
  kampanjer,
  kampanjeStatus,
  kampanjeSvar,
  kanalLinje,
  PRIO_TEKST,
  soekeord,
  soekeordSvar,
} from "./annonser"

// Klient-oeynene for /annonser: fire kilder hos ad-agenten, hver med sin egen
// tilstand. Feiler én, staar de andre. Ingen kilde blir stille til et nulltall.

type Kilde<T> = { slag: "laster" } | { slag: "feil"; hint: string } | { slag: "ok"; data: T }

const LASTER = { slag: "laster" } as const

function hint(e: unknown, ellers: string): string {
  if (e instanceof ApiError && e.hint) return e.hint
  if (e instanceof Error && e.message) return e.message
  return ellers
}

function Laster({ merkelapp }: { merkelapp: string }) {
  return (
    <Seksjon merkelapp={merkelapp}>
      <Svar>
        <strong>…</strong>
      </Svar>
      <Hjelp>Henter tallene.</Hjelp>
    </Seksjon>
  )
}

function Feil({ merkelapp, hint: h }: { merkelapp: string; hint: string }) {
  return (
    <Seksjon merkelapp={merkelapp}>
      <Stille>
        <span className="varsel">Ingen tall å vise.</span> {h}
      </Stille>
    </Seksjon>
  )
}

export function AnnonserDykk() {
  const [metrics, setMetrics] = useState<Kilde<MetricsResponse>>(LASTER)
  const [helse, setHelse] = useState<Kilde<CampaignHealthResponse>>(LASTER)
  const [soek, setSoek] = useState<Kilde<SearchTermsResponse>>(LASTER)
  const [forslagRes, setForslag] = useState<Kilde<ProposalsResponse>>(LASTER)
  const [naa] = useState(() => new Date())

  useEffect(() => {
    let avbrutt = false
    const { since, until } = butikkVindu(naa, DAGER)
    const sett = <T,>(setter: (k: Kilde<T>) => void, ellers: string) => ({
      ok: (d: T) => {
        if (!avbrutt) setter({ slag: "ok", data: d })
      },
      feil: (e: unknown) => {
        if (!avbrutt) setter({ slag: "feil", hint: hint(e, ellers) })
      },
    })
    const m = sett(setMetrics, "Klarte ikke hente annonsetallene.")
    getMetrics(since, until).then(m.ok).catch(m.feil)
    const h = sett(setHelse, "Klarte ikke hente kampanjene fra Google Ads.")
    getCampaignHealth(since, until).then(h.ok).catch(h.feil)
    const s = sett(setSoek, "Klarte ikke hente søkeordene fra Google Ads.")
    getSearchTerms(DAGER, 100).then(s.ok).catch(s.feil)
    const f = sett(setForslag, "Klarte ikke hente forslagene fra annonsemotoren.")
    getProposals({ status: "pending", limit: 200 }).then(f.ok).catch(f.feil)
    return () => {
      avbrutt = true
    }
  }, [naa])

  return (
    <>
      {metrics.slag === "laster" ? (
        <Laster merkelapp="Betalt media" />
      ) : metrics.slag === "feil" ? (
        <Feil merkelapp="Betalt media" hint={metrics.hint} />
      ) : (
        (() => {
          const b = betaltMedia(metrics.data)
          const hook = betaltHook(b)
          if (b.roas === null) {
            return (
              <Seksjon merkelapp="Betalt media">
                <Stille>{betaltTekst(b)}</Stille>
              </Seksjon>
            )
          }
          return (
            <Seksjon merkelapp="Betalt media">
              <Svar>
                <span className={hook.ned ? "varsel" : undefined}>{hook.hook}:</span> hver krone ga{" "}
                <strong>{roasLabel(b.roas)}</strong> tilbake
              </Svar>
              <Hjelp>
                {betaltTekst(b)}{" "}
                {b.tapere.length > 0 ? (
                  <span className="varsel">
                    {b.tapere.map((k) => k.navn).join(" og ")} går med tap.
                  </span>
                ) : (
                  "Alle kanalene tjener seg inn."
                )}{" "}
                Plattformenes egne tall; synket for {varighet(metrics.data.lastSync, naa)} siden.
              </Hjelp>
              <Detaljer tekst="Se per kanal">
                <Liste>
                  {b.kanaler.map((k) => (
                    <Linje key={k.id} n={k.navn}>
                      {k.helse === "red" ? <b className="varsel">{kanalLinje(k)}</b> : kanalLinje(k)}
                    </Linje>
                  ))}
                </Liste>
              </Detaljer>
            </Seksjon>
          )
        })()
      )}

      {helse.slag === "laster" ? (
        <Laster merkelapp="Kampanjene" />
      ) : helse.slag === "feil" ? (
        <Feil merkelapp="Kampanjene" hint={helse.hint} />
      ) : (
        (() => {
          const k = kampanjer(helse.data.campaigns)
          const sv = kampanjeSvar(k)
          if (k.antall === 0) {
            return (
              <Seksjon merkelapp="Kampanjene">
                <Stille>Ingen kampanjer i Google Ads i perioden.</Stille>
              </Seksjon>
            )
          }
          return (
            <Seksjon merkelapp="Kampanjene">
              <Svar>{sv.ned ? <span className="varsel">{sv.hook}</span> : sv.hook}</Svar>
              <Hjelp>
                {tall(k.aktive)} av {tall(k.antall)} kampanjer har forbruk. Det som går med tap står
                først, så det som er begrenset av budsjettet.
              </Hjelp>
              <Detaljer tekst="Se kampanjene">
                <Liste>
                  {k.sortert.map((c) => {
                    const st = kampanjeStatus(c)
                    return (
                      <Linje key={c.campaignId} n={KAMPANJE_TEKST[st]}>
                        {st === "tap" ? <b className="varsel">{c.name}</b> : <b>{c.name}</b>} — {kr(c.spend)}{" "}
                        brukt, {kr(c.revenue)} tilbake ({roasLabel(c.roas)}), {tall(c.conversions)} salg
                        {c.tempo.pct !== null && c.tempo.pct > 120
                          ? ` · bruker ${c.tempo.pct.toFixed(0)} % av dagsbudsjettet i dag`
                          : ""}
                      </Linje>
                    )
                  })}
                </Liste>
              </Detaljer>
            </Seksjon>
          )
        })()
      )}

      {soek.slag === "laster" ? (
        <Laster merkelapp="Søkeordene" />
      ) : soek.slag === "feil" ? (
        <Feil merkelapp="Søkeordene" hint={soek.hint} />
      ) : (
        (() => {
          const s = soekeord(soek.data.terms)
          const sv = soekeordSvar(s)
          if (s.antall === 0) {
            return (
              <Seksjon merkelapp="Søkeordene">
                <Stille>Ingen søkeord registrert i perioden.</Stille>
              </Seksjon>
            )
          }
          return (
            <Seksjon merkelapp="Søkeordene">
              <Svar>{sv.ned ? <span className="varsel">{sv.hook}</span> : sv.hook}</Svar>
              <Hjelp>
                {tall(s.bortkastet.length)} søk uten salg, {tall(s.sterke.length)} sterke, av{" "}
                {tall(s.antall)} de siste {soek.data.days} dagene. Et bortkastet søk er et negativt
                søkeord som venter.
              </Hjelp>
              {s.bortkastet.length > 0 ? (
                <Detaljer tekst="Se de bortkastede">
                  <Liste>
                    {s.bortkastet.slice(0, 15).map((t) => (
                      <Linje key={t.searchTerm} n={kr(t.cost)}>
                        <b>{t.searchTerm}</b> — {tall(t.clicks)} klikk, ingen salg
                        {t.campaignName ? ` · ${t.campaignName}` : ""}
                      </Linje>
                    ))}
                  </Liste>
                </Detaljer>
              ) : null}
              {s.sterke.length > 0 ? (
                <Detaljer tekst="Se de sterke">
                  <Liste>
                    {s.sterke.slice(0, 15).map((t) => (
                      <Linje key={t.searchTerm} n={roasLabel(t.roas)}>
                        <b>{t.searchTerm}</b> — {kr(t.revenue)} på {tall(t.conversions)} salg
                      </Linje>
                    ))}
                  </Liste>
                </Detaljer>
              ) : null}
            </Seksjon>
          )
        })()
      )}

      {forslagRes.slag === "laster" ? (
        <Laster merkelapp="Forslagene" />
      ) : forslagRes.slag === "feil" ? (
        <Feil merkelapp="Forslagene" hint={forslagRes.hint} />
      ) : (
        (() => {
          const f = forslag(forslagRes.data.proposals)
          const sv = forslagSvar(f)
          if (f.antall === 0) {
            return (
              <Seksjon merkelapp="Forslagene">
                <Svar>Ingen forslag venter</Svar>
                <Hjelp>Annonsemotoren har ikke foreslått noen handling som ikke er avgjort.</Hjelp>
              </Seksjon>
            )
          }
          return (
            <Seksjon merkelapp="Forslagene">
              <Svar>{sv.ned ? <span className="varsel">{sv.hook}</span> : sv.hook}</Svar>
              <Hjelp>
                Konkrete handlinger annonsemotoren vil gjøre i Google eller Meta. Ingenting gjøres
                uten et ja; det gis i køen når rådet er lagt der.
              </Hjelp>
              <Detaljer tekst="Se forslagene">
                <Liste>
                  {f.sortert.map((p) => (
                    <Linje key={p.id} n={PRIO_TEKST[p.priority]}>
                      {p.priority === "critical" ? (
                        <b className="varsel">{p.suggested_action}</b>
                      ) : (
                        <b>{p.suggested_action}</b>
                      )}
                      {" — "}
                      {labelFor(TYPE_LABEL, p.recommendation_type)}
                      {p.entity_name ? ` · ${p.entity_name}` : ""}
                      {p.current_spend !== null ? ` · ${kr(p.current_spend)} brukt` : ""}
                      {p.current_roas !== null ? ` · ${roasLabel(p.current_roas)}` : ""}
                    </Linje>
                  ))}
                </Liste>
              </Detaljer>
            </Seksjon>
          )
        })()
      )}
    </>
  )
}
