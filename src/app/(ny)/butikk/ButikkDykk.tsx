"use client"

import { useEffect, useState } from "react"

import { ApiError, getInventory, getMetrics, getShopifyDetail } from "@/lib/detox-api"
import {
  butikkVindu,
  lesButikkTall,
  lesLagerTall,
  lesProduktTall,
  vurderFriskhet,
  type ButikkTall,
  type Datafriskhet,
  type LagerTall,
  type ProduktTall,
} from "@/lib/butikk"

import { Detaljer } from "../Detaljer"
import { Hjelp, Knapper, Linje, Liste, Seksjon, Stille, Svar } from "../Seksjon"
import { kr, tall, varighet } from "../dagens"
import {
  DAGER,
  kundeSvar,
  lagerSvar,
  nettoTekst,
  omsetningHjelp,
  omsetningTekst,
  retning,
  toppProdukt,
} from "./butikk"

// Klient-oeynene for /butikk: tre kilder hos ad-agenten, hver med sin egen
// tilstand. Feiler én, staar de andre. Ingen kilde blir stille til et nulltall.

type Kilde<T> =
  | { slag: "laster" }
  | { slag: "feil"; hint: string }
  | { slag: "tom" }
  | { slag: "ok"; data: T }

const LASTER = { slag: "laster" } as const

function hint(e: unknown, ellers: string): string {
  return e instanceof ApiError && e.hint ? e.hint : ellers
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

export function ButikkDykk() {
  const [hoved, setHoved] = useState<Kilde<{ tall: ButikkTall; friskhet: Datafriskhet }>>(LASTER)
  const [detalj, setDetalj] = useState<Kilde<ProduktTall>>(LASTER)
  const [lager, setLager] = useState<Kilde<LagerTall>>(LASTER)
  const [naa] = useState(() => new Date())

  useEffect(() => {
    let avbrutt = false
    const { since, until } = butikkVindu(naa, DAGER)

    getMetrics(since, until)
      .then((m) => {
        if (avbrutt) return
        const t = lesButikkTall(m)
        setHoved(t ? { slag: "ok", data: { tall: t, friskhet: vurderFriskhet(m.lastSync, naa) } } : { slag: "tom" })
      })
      .catch((e: unknown) => {
        if (!avbrutt) setHoved({ slag: "feil", hint: hint(e, "Klarte ikke hente Shopify-tallene.") })
      })

    getShopifyDetail(since, until, 10)
      .then((d) => {
        if (avbrutt) return
        const t = lesProduktTall(d)
        setDetalj(t ? { slag: "ok", data: t } : { slag: "tom" })
      })
      .catch((e: unknown) => {
        if (!avbrutt) setDetalj({ slag: "feil", hint: hint(e, "Klarte ikke hente produkt- og kundetallene.") })
      })

    getInventory()
      .then((d) => {
        if (!avbrutt) setLager({ slag: "ok", data: lesLagerTall(d) })
      })
      .catch((e: unknown) => {
        if (!avbrutt) setLager({ slag: "feil", hint: hint(e, "Klarte ikke hente lageret fra Shopify.") })
      })

    return () => {
      avbrutt = true
    }
  }, [naa])

  return (
    <>
      {hoved.slag === "laster" ? (
        <Laster merkelapp="Salget" />
      ) : hoved.slag === "feil" ? (
        <Feil merkelapp="Salget" hint={hoved.hint} />
      ) : hoved.slag === "tom" ? (
        <Seksjon merkelapp="Salget">
          <Stille>Ingen ordrer registrert de siste {DAGER} dagene.</Stille>
        </Seksjon>
      ) : (
        (() => {
          const { tall: b, friskhet } = hoved.data
          const r = retning(b.delta.omsetning?.pct)
          return (
            <Seksjon merkelapp="Salget">
              <Svar>
                <span className={r.ned ? "varsel" : undefined}>{r.hook}:</span> {omsetningTekst(b)}
              </Svar>
              <Hjelp>
                {omsetningHjelp(b)}{" "}
                {friskhet.data_mode === "stale" ? (
                  <span className="varsel">
                    {friskhet.sist_synket
                      ? `Sist synket for ${varighet(friskhet.sist_synket, naa)} siden — en synk har hoppet over.`
                      : "Ingen synk registrert."}
                  </span>
                ) : friskhet.sist_synket ? (
                  `Synket for ${varighet(friskhet.sist_synket, naa)} siden.`
                ) : null}
              </Hjelp>
              {detalj.slag === "ok" ? (
                <Detaljer tekst="Se netto">
                  <Liste>
                    <Linje n="netto">{nettoTekst(detalj.data)}</Linje>
                    <Linje n="brutto">
                      {kr(b.omsetning)} på {tall(b.ordrer)} ordrer, alle statuser.
                    </Linje>
                  </Liste>
                </Detaljer>
              ) : null}
              <Knapper>
                <a className="ny-knapp" href="https://admin.shopify.com" target="_blank" rel="noreferrer">
                  Åpne Shopify
                </a>
              </Knapper>
            </Seksjon>
          )
        })()
      )}

      {detalj.slag === "laster" ? (
        <Laster merkelapp="Produktene" />
      ) : detalj.slag === "feil" ? (
        <Feil merkelapp="Produktene" hint={detalj.hint} />
      ) : detalj.slag === "tom" ? (
        <Seksjon merkelapp="Produktene">
          <Stille>Ingen produkter solgt i perioden.</Stille>
        </Seksjon>
      ) : (
        (() => {
          const p = detalj.data
          const topp = toppProdukt(p)
          const k = kundeSvar(p)
          return (
            <>
              <Seksjon merkelapp="Produktene">
                {topp ? (
                  <Svar>
                    Mest solgt: <strong className="ny-svar-tekst">{topp.navn}</strong>
                  </Svar>
                ) : (
                  <Stille>Ingen produkter solgt i perioden.</Stille>
                )}
                <Hjelp>
                  {topp ? `${kr(topp.omsetning)} på ${tall(topp.enheter)} enheter. ` : ""}
                  {tall(p.ulikeProdukter)} ulike produkter solgt.
                </Hjelp>
                {p.topp.length > 0 ? (
                  <Detaljer tekst="Se topp 10">
                    <Liste>
                      {[...p.topp]
                        .sort((a, b) => b.omsetning - a.omsetning)
                        .map((x, i) => (
                          <Linje key={`${x.navn}-${i}`} n={`${i + 1}`}>
                            <b>{x.navn}</b> — {kr(x.omsetning)} · {tall(x.enheter)} stk
                          </Linje>
                        ))}
                    </Liste>
                  </Detaljer>
                ) : null}
              </Seksjon>

              <Seksjon merkelapp="Kundene">
                <Svar>{k.hook}</Svar>
                <Hjelp>{k.tekst}</Hjelp>
              </Seksjon>
            </>
          )
        })()
      )}

      {lager.slag === "laster" ? (
        <Laster merkelapp="Lageret" />
      ) : lager.slag === "feil" ? (
        <Feil merkelapp="Lageret" hint={lager.hint} />
      ) : lager.slag === "tom" ? (
        <Seksjon merkelapp="Lageret">
          <Stille>Ingen lagerdata.</Stille>
        </Seksjon>
      ) : (
        (() => {
          const l = lager.data
          const s = lagerSvar(l)
          return (
            <Seksjon merkelapp="Lageret">
              {s.varsel ? (
                <Svar>
                  <span className="varsel">{s.varsel}</span>
                </Svar>
              ) : (
                <Svar>Ingenting er utsolgt eller lavt</Svar>
              )}
              <Hjelp>
                {s.tekst} Lest for {varighet(l.hentet, naa)} siden.
              </Hjelp>
              {l.lavtListe.length > 0 ? (
                <Detaljer tekst="Se produktene med lite igjen">
                  <Liste>
                    {l.lavtListe.map((x) => (
                      <Linje key={x.navn} n={x.antall <= 0 ? "utsolgt" : `${x.antall} igjen`}>
                        {x.antall <= 0 ? <b className="varsel">{x.navn}</b> : x.navn}
                      </Linje>
                    ))}
                  </Liste>
                </Detaljer>
              ) : null}
            </Seksjon>
          )
        })()
      )}
    </>
  )
}
