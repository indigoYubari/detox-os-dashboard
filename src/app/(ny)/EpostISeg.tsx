"use client"

import { useEffect, useState } from "react"

import { Detaljer } from "./Detaljer"
import { Hjelp, Linje, Liste, Seksjon, Stille, Svar } from "./Seksjon"
import { kr, tall } from "./dagens"

type Klaviyo = {
  emailRevenue7d: number
  listSize: number | null
  listName: string | null
  listSizeReason?: string | null
}

type Tilstand =
  | { slag: "laster" }
  | { slag: "ok"; klaviyo: Klaviyo | null; feil: string | undefined }
  | { slag: "feil"; hint: string }

/**
 * «E-post». Klaviyo driver gjentakelsen: kampanjer og flyter. Ruta svarer med
 * baade tallet og — naar listestørrelsen ikke kan leses — en grunn paa norsk,
 * slik at «mangler tilgang» ikke ser ut som «ingen mottakere».
 */
export function EpostISeg() {
  const [tilstand, setTilstand] = useState<Tilstand>({ slag: "laster" })

  useEffect(() => {
    let avbrutt = false
    fetch("/api/oversikt", { cache: "no-store" })
      .then(async (res) => {
        const body = (await res.json()) as {
          klaviyo?: Klaviyo | null
          errors?: Record<string, string>
        }
        if (!res.ok) {
          return {
            slag: "feil" as const,
            hint: "Klarte ikke hente e-posttallene.",
          }
        }
        return {
          slag: "ok" as const,
          klaviyo: body.klaviyo ?? null,
          feil: body.errors?.klaviyo,
        }
      })
      .then((ny) => {
        if (!avbrutt) setTilstand(ny)
      })
      .catch(() => {
        if (!avbrutt) {
          setTilstand({ slag: "feil", hint: "Fikk ikke kontakt med kilden." })
        }
      })
    return () => {
      avbrutt = true
    }
  }, [])

  if (tilstand.slag === "laster") {
    return (
      <Seksjon merkelapp="E-post">
        <Svar>
          <strong>…</strong>
        </Svar>
        <Hjelp>Henter Klaviyo.</Hjelp>
      </Seksjon>
    )
  }

  if (tilstand.slag === "feil") {
    return (
      <Seksjon merkelapp="E-post">
        <Stille>
          <span className="varsel">Ingen e-posttall.</span> {tilstand.hint}
        </Stille>
      </Seksjon>
    )
  }

  const { klaviyo, feil } = tilstand

  if (!klaviyo) {
    return (
      <Seksjon merkelapp="E-post">
        <Stille>{feil ?? "Klaviyo svarte ikke med tall."}</Stille>
      </Seksjon>
    )
  }

  const listeTekst =
    klaviyo.listSize !== null
      ? `${tall(klaviyo.listSize)} medlemmer${klaviyo.listName ? ` i «${klaviyo.listName}»` : ""}`
      : (klaviyo.listSizeReason ?? "Listestørrelsen er ikke tilgjengelig.")

  return (
    <Seksjon merkelapp="E-post">
      <Svar>
        <strong>{kr(klaviyo.emailRevenue7d)}</strong> siste sju dager
      </Svar>
      <Hjelp>Kampanjer og flyter til sammen.</Hjelp>
      <Detaljer tekst="Se listen">
        <Liste>
          <Linje n="liste">{listeTekst}</Linje>
        </Liste>
      </Detaljer>
    </Seksjon>
  )
}
