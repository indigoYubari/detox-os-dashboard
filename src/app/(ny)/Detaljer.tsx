"use client"

import { useState, type ReactNode } from "react"

/**
 * «Detaljer bak et klikk» — kjernegrepet i denne flaten. Svaret staar alltid
 * synlig; dette er bare utfyllingen. Kollapset innhold er merket aria-hidden
 * saa skjermlesere ikke leser en liste brukeren ikke har aapnet.
 */
export function Detaljer({
  children,
  tekst = "Se detaljer",
}: {
  children: ReactNode
  tekst?: string
}) {
  const [oppe, setOppe] = useState(false)

  return (
    <>
      <button
        type="button"
        className="ny-vis"
        aria-expanded={oppe}
        onClick={() => setOppe((v) => !v)}
      >
        <span className="pil" aria-hidden="true">
          ›
        </span>
        {oppe ? "Skjul" : tekst}
      </button>
      <div
        className={oppe ? "ny-detaljer opp" : "ny-detaljer"}
        aria-hidden={!oppe}
      >
        {children}
      </div>
    </>
  )
}
