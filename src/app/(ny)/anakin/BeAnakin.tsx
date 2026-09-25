"use client"

import { useState, useTransition } from "react"

import {
  isRefRequestType,
  REQUEST_TYPES,
  type RequestType,
} from "@/lib/eiere"

import {
  createRefRequestAction,
  createRequestAction,
  type ActionResult,
} from "./actions"

// «Be Anakin …» — én knapp, én rad i requests. Med refId peker bestillingen
// paa én konkret rad (anbefaling, funn, innholdselement) og serveren leser
// teksten fra basen; uten refId er det en generell bestilling. Ingenting
// publiseres. Sperret mens den paagaar og etter at den har lyktes; serveren
// er i tillegg idempotent.
export function BeAnakin({
  type,
  refId,
  period,
  tekst,
  primaer = false,
}: {
  type: RequestType
  refId?: string
  period: string | null
  tekst: string
  primaer?: boolean
}) {
  const [pending, start] = useTransition()
  const [res, setRes] = useState<ActionResult | null>(null)

  function send() {
    start(async () => {
      if (refId && isRefRequestType(type)) {
        setRes(await createRefRequestAction({ type, refId, period }))
      } else {
        setRes(await createRequestAction({ type, period }))
      }
    })
  }

  return (
    <>
      <button
        type="button"
        className={primaer ? "ny-knapp liten primaer" : "ny-knapp liten"}
        disabled={pending || (res?.ok ?? false)}
        onClick={send}
        title={`Legger en «${REQUEST_TYPES[type].label}»-bestilling til Anakin i køen`}
      >
        {pending ? "Legger i kø…" : tekst}
      </button>
      {res ? (
        res.ok ? (
          <span className="ny-kvittering">
            {res.duplicate
              ? "Ligger allerede i køen."
              : "I køen. Anakin plukker den opp."}
          </span>
        ) : (
          <span className="ny-feil">{res.error}</span>
        )
      ) : null}
    </>
  )
}
