"use client"

import Link from "next/link"
import { useState, useTransition } from "react"

import { bestillInnholdAction, type BestillResult } from "./actions"

/**
 * Én knapp: «Be Anakin lage utkast». Skriver en bestilling i requests; Anakin
 * svarer i tråden på /eiere. Etter et svar står kvitteringen — vi later ikke
 * som utkastet finnes før Anakin har levert det.
 */
export function Bestill({ slag, id, tekst = "Be Anakin lage utkast" }: { slag: "kort" | "ide"; id: string; tekst?: string }) {
  const [pending, start] = useTransition()
  const [res, setRes] = useState<BestillResult | null>(null)

  if (res?.ok) {
    return (
      <span className="ny-kvittering">
        {res.duplicate ? "Allerede bestilt. " : "Bestilt. "}
        Anakin svarer i tråden på <Link href="/eiere">/eiere</Link>.
      </span>
    )
  }

  return (
    <>
      <button
        type="button"
        className="ny-knapp primaer"
        disabled={pending}
        onClick={() => start(async () => setRes(await bestillInnholdAction({ slag, id })))}
      >
        {pending ? "Sender…" : tekst}
      </button>
      {res && !res.ok ? <span className="ny-feil">{res.error}</span> : null}
    </>
  )
}
